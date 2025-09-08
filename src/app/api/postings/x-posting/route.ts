/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post, platform } = body;

    if (!post || !platform) {
      return NextResponse.json(
        { error: "Missing 'post' or 'platform' in request body" },
        { status: 400 }
      );
    }

    if (
      platform.toLowerCase() === "x" ||
      platform.toLowerCase() === "twitter"
    ) {
      // Initialize Twitter client
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY as string,
        appSecret: process.env.TWITTER_API_SECRET as string,
        accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
        accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
      });

      const rwClient = client.readWrite;

      // Send the tweet
      const tweet = await rwClient.v2.tweet(post);

      return NextResponse.json({ success: true, tweet });
    }

    return NextResponse.json(
      { error: `Platform '${platform}' not supported yet.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error posting to X/Twitter:", error);

    // Capture more details from Twitter API errors
    return NextResponse.json(
      {
        error: error.message || "Something went wrong",
        code: error.code,
        data: error.data,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
