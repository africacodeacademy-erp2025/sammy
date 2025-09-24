// src/app/api/pulling/fb-pulling/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";

/**
 * Facebook post pulling endpoint using Graph API per user.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    console.log("Authorization header:", authHeader ? "Present" : "Missing");

    const user = await getUserFromRequest(authHeader);
    console.log("User from auth:", user ? "Found" : "Not found");

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "5");
    const pageId = searchParams.get("pageId");

    // Use pageId from query params or user's default
    const targetPageId = pageId || user.facebook?.pageId;
    const pageAccessToken = user.facebook?.accessToken;

    if (!targetPageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook credentials not configured for this user" },
        { status: 400 }
      );
    }

    console.log(`Fetching ${count} posts from Facebook page: ${targetPageId}`);

    const url = `https://graph.facebook.com/v21.0/${targetPageId}/feed`;
    const params = new URLSearchParams();
    params.append("access_token", pageAccessToken);
    params.append("limit", Math.min(count, 100).toString());
    params.append(
      "fields",
      "id,message,story,created_time,updated_time,likes.summary(true),comments.summary(true),shares,permalink_url,full_picture,attachments,from"
    );

    const graphRes = await fetch(`${url}?${params}`);
    const data = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Facebook Graph API error:", data);
      return NextResponse.json(
        { error: data?.error?.message || "Facebook Graph API error", data },
        { status: graphRes.status }
      );
    }

    console.log("Raw Facebook API response:", {
      data: data.data?.length || 0,
      paging: !!data.paging,
    });

    // Format the response
    const formattedPosts =
      data.data?.map((post: any) => ({
        id: post.id,
        message: post.message || post.story || "",
        created_time: post.created_time,
        updated_time: post.updated_time,
        author: {
          id: post.from?.id,
          name: post.from?.name,
        },
        metrics: {
          likes_count: post.likes?.summary?.total_count || 0,
          comments_count: post.comments?.summary?.total_count || 0,
          shares_count: post.shares?.count || 0,
        },
        permalink_url: post.permalink_url,
        full_picture: post.full_picture,
        attachments: post.attachments?.data || [],
      })) || [];

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      count: formattedPosts.length,
      paging: data.paging,
    });
  } catch (error: any) {
    console.error("Error fetching from Facebook:", error);
    return NextResponse.json(
      { error: error?.message || "Something went wrong while fetching posts" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    console.log("Authorization header:", authHeader ? "Present" : "Missing");

    const body = await req.json();
    const { count = 5, pageId, tokens } = body;

    // Try to get user if auth header exists, but don't require it if tokens are provided
    let user = null;
    if (authHeader) {
      user = await getUserFromRequest(authHeader);
      console.log("User from auth:", user ? "Found" : "Not found");
    }

    // Prefer tokens from request body, fallback to user.facebook
    const targetPageId =
      pageId || tokens?.facebook?.pageId || user?.facebook?.pageId;
    const pageAccessToken =
      tokens?.facebook?.accessToken || user?.facebook?.accessToken;

    if (!targetPageId || !pageAccessToken) {
      return NextResponse.json(
        {
          error:
            "Facebook credentials required. Provide tokens in request body or ensure user has Facebook credentials configured.",
        },
        { status: 400 }
      );
    }

    if (!targetPageId || !pageAccessToken) {
      return NextResponse.json(
        { error: "Facebook credentials not configured for this user" },
        { status: 400 }
      );
    }

    console.log(`Fetching ${count} posts from Facebook page: ${targetPageId}`);

    const url = `https://graph.facebook.com/v21.0/${targetPageId}/feed`;
    const params = new URLSearchParams();
    params.append("access_token", pageAccessToken);
    params.append("limit", Math.min(count, 100).toString());
    params.append(
      "fields",
      "id,message,story,created_time,updated_time,likes.summary(true),comments.summary(true),shares,permalink_url,full_picture,attachments,from"
    );

    const graphRes = await fetch(`${url}?${params}`);
    const data = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Facebook Graph API error:", data);

      // Handle specific Facebook API errors
      if (data.error?.code === 190) {
        return NextResponse.json(
          { error: "Invalid or expired Facebook access token" },
          { status: 401 }
        );
      }

      if (data.error?.code === 100) {
        return NextResponse.json(
          { error: "Invalid Facebook page ID or insufficient permissions" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: data?.error?.message || "Facebook Graph API error", data },
        { status: graphRes.status }
      );
    }

    console.log("Raw Facebook API response:", {
      data: data.data?.length || 0,
      paging: !!data.paging,
    });

    // Format the response
    const formattedPosts =
      data.data?.map((post: any) => ({
        id: post.id,
        message: post.message || post.story || "",
        created_time: post.created_time,
        updated_time: post.updated_time,
        author: {
          id: post.from?.id,
          name: post.from?.name,
        },
        metrics: {
          likes_count: post.likes?.summary?.total_count || 0,
          comments_count: post.comments?.summary?.total_count || 0,
          shares_count: post.shares?.count || 0,
        },
        permalink_url: post.permalink_url,
        full_picture: post.full_picture,
        attachments: post.attachments?.data || [],
      })) || [];

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      count: formattedPosts.length,
      paging: data.paging,
    });
  } catch (error: any) {
    console.error("Error fetching from Facebook:", error);

    // Handle network errors
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return NextResponse.json(
        { error: "Network error connecting to Facebook API" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Something went wrong while fetching posts" },
      { status: 500 }
    );
  }
}
