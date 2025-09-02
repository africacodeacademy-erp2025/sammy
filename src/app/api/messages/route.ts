import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { connectDB } from "../../../../lib/mongo";
import OpenAI from "openai";

const slack = new WebClient(process.env.SLACK_USER_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

const CHANNELS = ["general", "today-i-learned", "erp2025-announcements"];

type MessageDoc = {
  channel: string;
  user: string;
  text: string;
  ts: string;
  embedding: number[];
};

export async function GET(req: NextRequest) {
  try {
    const db = await connectDB();
    const collection = db.collection<MessageDoc>("messages");
    const results: MessageDoc[] = [];

    for (const channelName of CHANNELS) {
      const list = await slack.conversations.list({ types: "public_channel" });
      const channel = list.channels?.find((c) => c.name === channelName);

      if (!channel?.id) {
        console.warn(`Channel ID not found for ${channelName}`);
        continue;
      }

      const history = await slack.conversations.history({
        channel: channel.id,
        limit: 3,
      });

      if (!history.messages) continue;

      for (const msg of history.messages) {
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
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
