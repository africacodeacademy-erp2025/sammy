// src/app/api/pulling/fb-pulling/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";

/**
 * Facebook post pulling endpoint using Graph API per user.
 * Returns only posts from the currently logged-in user.
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

    console.log(
      `Fetching ${count} posts from Facebook page: ${targetPageId} for user: ${user.id}`
    );

    // Fetch more posts to account for filtering
    const fetchLimit = Math.min(count * 3, 100); // Fetch 3x more to account for filtering

    const url = `https://graph.facebook.com/v21.0/${targetPageId}/feed`;
    const params = new URLSearchParams();
    params.append("access_token", pageAccessToken);
    params.append("limit", fetchLimit.toString());
    params.append("fields", "id,message,story,full_picture,from");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    const graphRes = await fetch(`${url}?${params}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FacebookAPI/1.0)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
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

    // Filter posts to only include those from the current user's page
    // and format the response
    const userPosts =
      data.data?.filter((post: any) => post.from?.id === targetPageId) || [];

    const formattedPosts = userPosts
      .slice(0, count) // Limit to requested count after filtering
      .map((post: any) => ({
        id: post.id,
        message: post.message || post.story || "",
        author: {
          id: post.from?.id,
          name: post.from?.name,
        },
        full_picture: post.full_picture,
      }));

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      count: formattedPosts.length,
      total_fetched: data.data?.length || 0,
      filtered_count: userPosts.length,
      paging: data.paging,
    });
  } catch (error: any) {
    console.error("Error fetching from Facebook:", error);

    // Handle network errors including timeout
    if (
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          error:
            "Network error connecting to Facebook API. Please check your internet connection and try again.",
        },
        { status: 503 }
      );
    }

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

    console.log(`Fetching ${count} posts from Facebook page: ${targetPageId}`);

    // Fetch more posts to account for filtering
    const fetchLimit = Math.min(count * 3, 100); // Fetch 3x more to account for filtering

    const url = `https://graph.facebook.com/v21.0/${targetPageId}/feed`;
    const params = new URLSearchParams();
    params.append("access_token", pageAccessToken);
    params.append("limit", fetchLimit.toString());
    params.append("fields", "id,message,story,full_picture,from");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

    const graphRes = await fetch(`${url}?${params}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FacebookAPI/1.0)",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
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

    // Filter posts to only include those from the current user's page
    // and format the response
    const userPosts =
      data.data?.filter((post: any) => post.from?.id === targetPageId) || [];

    const formattedPosts = userPosts
      .slice(0, count) // Limit to requested count after filtering
      .map((post: any) => ({
        id: post.id,
        message: post.message || post.story || "",
        author: {
          id: post.from?.id,
          name: post.from?.name,
        },
        full_picture: post.full_picture,
      }));

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      count: formattedPosts.length,
      total_fetched: data.data?.length || 0,
      filtered_count: userPosts.length,
      paging: data.paging,
    });
  } catch (error: any) {
    console.error("Error fetching from Facebook:", error);

    // Handle network errors including timeout
    if (
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.code === "UND_ERR_CONNECT_TIMEOUT" ||
      error.name === "AbortError"
    ) {
      return NextResponse.json(
        {
          error:
            "Network error connecting to Facebook API. Please check your internet connection and try again.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Something went wrong while fetching posts" },
      { status: 500 }
    );
  }
}
