import { NextResponse } from "next/server";
import { connectDB } from "../../../../../../lib/mongo";
import OpenAI from "openai";
import { getSlackUserClient } from "../../../../../../lib/integrations/slack";

const openai = process.env.OPEN_AI_API
  ? new OpenAI({ apiKey: process.env.OPEN_AI_API })
  : null;

export async function POST(req: Request) {
  let body: any;

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      body = Object.fromEntries(params.entries());
      // If Slack wraps JSON inside a "payload" field
      if (body.payload) body = JSON.parse(body.payload);
    } else {
      // Unknown content type, skip
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    // Failed to parse body, skip silently
    return NextResponse.json({ ok: true });
  }

  // Handle Slack URL verification
  if (body.type === "url_verification" && body.challenge) {
    return NextResponse.json({ challenge: body.challenge });
  }

  if (body.type === "event_callback") {
    const event = body.event;

    if (event.type === "message" && !event.subtype) {
      try {
        const db = await connectDB();

        // Find user by teamId (OAuth only)
        const user = await db.collection("users").findOne({
          "slack.teamId": body.team_id,
        });

        if (!user) return NextResponse.json({ ok: true });

        // Get Slack bot client (OAuth accessToken)
        const { getSlackBotClient } = await import(
          "../../../../../../lib/integrations/slack"
        );
        const slack = await getSlackBotClient(user._id.toString());
        if (!slack) return NextResponse.json({ ok: true });

        // Convert channel ID → name using bot/user token
        const channelInfo = await slack.conversations.info({
          channel: event.channel,
        });
        const channelName = channelInfo.channel?.name;
        if (!channelName) return NextResponse.json({ ok: true });

        // OAuth: Process all messages from channels where bot is a member
        // No channel filtering needed - bot only receives events from channels it's in

        const collection = db.collection("messages");

        // Skip if message already exists
        const existing = await collection.findOne({
          channel: channelName,
          ts: event.ts,
        });
        if (existing) return NextResponse.json({ ok: true });

        // Generate embedding (if OpenAI is available)
        let embedding: number[] = [];
        if (openai) {
          try {
            const embeddingResp = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: event.text,
            });
            embedding = embeddingResp.data[0].embedding;
          } catch (error) {
            console.error(
              "Failed to generate embedding for Slack message:",
              error
            );
          }
        }

        const doc = {
          channel: channelName,
          user: event.user,
          text: event.text,
          ts: event.ts,
          embedding,
          userId: user._id.toString(),
        };

        await collection.updateOne(
          { channel: doc.channel, ts: doc.ts },
          { $set: doc },
          { upsert: true }
        );
      } catch (err) {
        console.error("Slack event processing error:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
