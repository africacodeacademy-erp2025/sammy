// src/app/api/postings/x-posting/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { refreshTwitterToken } from "../../../../../lib/platforms/twitterPosting";
import { getUserFromRequest } from "../../../../../lib/auth";

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

    // Get user information from the Authorization header
    const authHeader = req.headers.get("Authorization");
    const user = await getUserFromRequest(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: "User authentication failed" },
        { status: 401 }
      );
    }

    console.log("Using Twitter OAuth 2.0 credentials");

    // Use OAuth 2.0 access token
    let accessToken = tokens.twitter.accessToken;
    let client = new TwitterApi(accessToken);

    try {
      const tweet = await client.v2.tweet(post);
      return NextResponse.json({ success: true, tweet });
    } catch (twitterError: any) {
      // Check if it's a 401 error (token expired)
      if (twitterError.code === 401) {
        console.log("Token expired, attempting to refresh...");

        const newAccessToken = await refreshTwitterToken(user._id.toString());

        if (newAccessToken) {
          console.log("Token refreshed successfully, retrying request...");
          client = new TwitterApi(newAccessToken);

          try {
            const tweet = await client.v2.tweet(post);
            return NextResponse.json({ success: true, tweet });
          } catch (retryError: any) {
            console.error("Error after token refresh:", retryError);
            throw retryError;
          }
        } else {
          return NextResponse.json(
            {
              error:
                "Token expired and could not be refreshed. Please reauthenticate.",
            },
            { status: 401 }
          );
        }
      } else {
        throw twitterError;
      }
    }
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
