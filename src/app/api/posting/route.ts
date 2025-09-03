// src/app/api/posting/route.ts
import { NextRequest, NextResponse } from "next/server";
import TwitterApi from "twitter-api-v2";

export async function POST(req: NextRequest) {
  try {
    // Read raw body safely
    const bodyText = await req.text();

    if (!bodyText) {
      return NextResponse.json({
        success: false,
        error: "Request body is empty",
      });
    }

    let data: { post?: string; platform?: string };
    try {
      data = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({
        success: false,
        error: "Invalid JSON format",
      });
    }

    const { post, platform } = data;

    if (!post || typeof post !== "string") {
      return NextResponse.json({
        success: false,
        error: "Missing or invalid 'post' content",
      });
    }

    const targetPlatform = platform || "twitter";

    if (targetPlatform === "twitter") {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY!,
        appSecret: process.env.TWITTER_APP_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_SECRET!,
      });

      const rwClient = client.readWrite;
      const tweet = await rwClient.v2.tweet(post);

      return NextResponse.json({
        success: true,
        platform: "twitter",
        tweetId: tweet.data.id,
        url: `https://x.com/i/web/status/${tweet.data.id}`,
      });
    }

    return NextResponse.json({
      success: false,
      error: `Platform '${targetPlatform}' not supported yet.`,
    });
  } catch (err: unknown) {
    console.error("Posting error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ success: false, error: message });
  }
}
