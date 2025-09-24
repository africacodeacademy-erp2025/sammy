// src/app/api/postings/fb-posting/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";

/**
 * Facebook posting endpoint using Graph API per user.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { post, platform, tokens } = body;

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

    // Prefer tokens from request body, fallback to user.facebook
    const pageId = tokens?.facebook?.pageId || user.facebook?.pageId;
    const pageAccessToken =
      tokens?.facebook?.accessToken || user.facebook?.accessToken;

    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook credentials not configured for this user" },
        { status: 400 }
      );
    }

    const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
    const params = new URLSearchParams();
    params.append("message", post);
    params.append("access_token", pageAccessToken);

    const graphRes = await fetch(url, {
      method: "POST",
      body: params,
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
