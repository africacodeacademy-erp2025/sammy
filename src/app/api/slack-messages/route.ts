import { WebClient } from "@slack/web-api";
import { NextResponse } from "next/server";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.SLACK_USER_TOKEN as string;
const client = new WebClient(token);

interface Channel {
  id: string;
  name: string;
}

async function listChannels(): Promise<Channel[]> {
  const result = await client.conversations.list({
    types: "public_channel",
    limit: 1000,
  });

  if (!result.channels) return [];

  return result.channels
    .filter((c): c is { id: string; name: string } => Boolean(c?.id && c?.name))
    .map((c) => ({ id: c.id, name: c.name }));
}

export async function GET() {
  try {
    const channels = await listChannels();

    const allMessages = await Promise.all(
      channels.map(async (channel) => {
        try {
          const res = await client.conversations.history({
            channel: channel.id,
            limit: 5,
          });

          return {
            channel: channel.name,
            messages:
              res.messages?.map((m) => ({
                user: m.user,
                text: m.text,
              })) || [],
          };
        } catch {
          return { channel: channel.name, messages: [] };
        }
      })
    );

    return NextResponse.json(allMessages);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
