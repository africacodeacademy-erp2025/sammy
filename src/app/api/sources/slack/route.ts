import { NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { connectDB } from "../../../../../lib/mongo";
import OpenAI from "openai";

const slack = new WebClient(process.env.SLACK_USER_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

type MessageDoc = {
  channel: string;
  user: string;
  text: string;
  ts: string;
  embedding: number[];
};

export async function GET(req: Request) {
  try {
    const db = await connectDB();
    const collection = db.collection<MessageDoc>("messages");
    const results: MessageDoc[] = [];

    const { searchParams } = new URL(req.url);
    const channelsParam = searchParams.get("channels");

    const CHANNELS: string[] = channelsParam ? channelsParam.split(",") : [];

    if (CHANNELS.length === 0) {
      return NextResponse.json(
        { success: false, error: "No channels specified." },
        { status: 400 }
      );
    }

    for (const channelName of CHANNELS) {
      const list = await slack.conversations.list({ types: "public_channel" });
      const channel = list.channels?.find((c: any) => c.name === channelName);

      if (!channel?.id) {
        console.warn(`Channel ID not found for ${channelName}`);
        continue;
      }

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
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
