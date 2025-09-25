/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";

async function getTwitterClient(tokens: any) {
  if (tokens?.bearerToken) {
    return new TwitterApi(decrypt(tokens.bearerToken)).readOnly;
  }
  return new TwitterApi({
    appKey: tokens.appKey,
    appSecret: tokens.appSecret,
    accessToken: decrypt(tokens.accessToken),
    accessSecret: decrypt(tokens.accessSecret),
  }).readOnly;
}

export async function GET(req: NextRequest) {
  try {
    // Get logged-in user from JWT
    const user = await getUserFromRequest(req.headers.get("authorization"));

    if (!user?.twitter) {
      return NextResponse.json(
        { error: "Twitter not configured" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "5");

    const client = await getTwitterClient(user.twitter);

    // Fetch tweets for the currently logged-in user's Twitter ID
    const timeline = await client.v2.userTimeline(user.twitter.userId, {
      max_results: Math.min(count, 100),
      exclude: ["retweets", "replies"],
    });

    const messages =
      timeline.data.data?.map((tweet: any) => ({
        user: user._id,
        message: tweet.text,
        platform: "twitter",
      })) || [];

    return NextResponse.json({ success: true, messages });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
