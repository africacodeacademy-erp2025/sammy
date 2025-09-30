import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function POST(req: NextRequest) {
  try {
    const { appKey, appSecret, accessToken, accessSecret } = await req.json();

    if (!appKey || !appSecret || !accessToken || !accessSecret) {
      return NextResponse.json(
        { error: "Missing Twitter credentials" },
        { status: 400 }
      );
    }

    const client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });

    try {
      // This fetches the authenticated user's account info
      const user = await client.currentUser();

      return NextResponse.json({
        message: `X credentials are valid ✅ (user: @${user.screen_name})`,
      });
    } catch (apiError: any) {
      console.error("Twitter API error:", apiError);
      return NextResponse.json(
        {
          error:
            apiError?.data?.errors?.[0]?.message ||
            "Invalid Twitter credentials",
        },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("Twitter test error:", err);
    return NextResponse.json(
      { error: "Failed to test Twitter credentials" },
      { status: 500 }
    );
  }
}
