/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

/**
 * Facebook posting endpoint using Graph API.
 * Requires the following env vars:
 * - FACEBOOK_PAGE_ID
 * - FACEBOOK_PAGE_ACCESS_TOKEN (long-lived page access token)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post, platform } = body;

    if (!post) {
      return NextResponse.json(
        { error: "Missing 'post' in request body" },
        { status: 400 }
      );
    }

    if (platform && platform.toLowerCase() !== "facebook") {
      return NextResponse.json(
        { error: `Platform '${platform}' not supported by this endpoint.` },
        { status: 400 }
      );
    }

    const pageId = process.env.FACEBOOK_PAGE_ID as string;
    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN as string;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook credentials are not configured on the server" },
        { status: 500 }
      );
    }

    const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;

    const graphRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: post,
        access_token: pageAccessToken,
      }),
    });

    const data = await graphRes.json();

    if (!graphRes.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Facebook Graph API error", data },
        { status: graphRes.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error posting to Facebook:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
