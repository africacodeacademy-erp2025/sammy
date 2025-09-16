/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { connectDB } from "../../../../../lib/mongo";
import OpenAI from "openai";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

type MessageDoc = {
  channel: string;
  user: string;
  text: string;
  ts: string;
  embedding: number[];
  userId: string;
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user || !user.slack?.userToken || !user.slack.channels?.length) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no Slack credentials" },
        { status: 401 }
      );
    }

    const slackUserToken = decrypt(user.slack.userToken);
    const slack = new WebClient(slackUserToken);

    const db = await connectDB();
    const collection = db.collection<MessageDoc>("messages");

    const results: MessageDoc[] = [];

    for (const channelName of user.slack.channels) {
      const list = await slack.conversations.list({ types: "public_channel" });
      const channel = list.channels?.find((c: any) => c.name === channelName);

      if (!channel?.id) {
        console.warn(`Channel ID not found for ${channelName}`);
        continue;
      }

      // Fetch last 3 messages
      const history = await slack.conversations.history({
        channel: channel.id,
        limit: 3,
      });

      if (!history.messages) continue;

      for (const msg of history.messages as {
        text?: string;
        ts?: string;
        user?: string;
      }[]) {
        if (!msg.text || !msg.ts) continue;

        // Check if message already exists
        const existing = await collection.findOne({
          channel: channelName,
          ts: msg.ts,
        });
        if (existing) {
          results.push(existing);
          continue; // Skip embedding for already stored messages
        }

        // Generate embedding only for new messages
        const embeddingResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: msg.text,
        });

        const embedding = embeddingResp.data[0].embedding;

        const doc: MessageDoc = {
          channel: channelName,
          user: msg.user || "unknown",
          text: msg.text,
          ts: msg.ts,
          embedding,
          userId: user._id.toString(), // <-- save logged-in user
        };

        await collection.updateOne(
          { channel: doc.channel, ts: doc.ts },
          { $set: doc },
          { upsert: true }
        );

        results.push(doc);
      }
    }

    return NextResponse.json({ success: true, messages: results });
  } catch (err: any) {
    console.error("Slack fetch error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to fetch Slack messages",
      },
      { status: 500 }
    );
  }
}
