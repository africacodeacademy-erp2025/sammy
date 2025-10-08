// src/app/api/postings/x-posting/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post, platform, tokens } = body;

    if (!post || !platform) {
      return NextResponse.json(
        { error: "Missing 'post' or 'platform' in request body" },
        { status: 400 }
      );
    }

    if (!tokens?.twitter) {
      return NextResponse.json(
        { error: "No Twitter token provided for this user" },
        { status: 400 }
      );
    }

    console.log("Using Twitter OAuth 2.0 credentials");

    // Use OAuth 2.0 access token
    const client = new TwitterApi(tokens.twitter.accessToken);

    const tweet = await client.v2.tweet(post);

    return NextResponse.json({ success: true, tweet });
  } catch (error: any) {
    console.error("Error posting to X/Twitter:", error);
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
