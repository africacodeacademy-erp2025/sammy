/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const count = parseInt(searchParams.get("count") || "5");

    // Get tokens from request headers or body
    const authHeader = req.headers.get("authorization");
    let tokens;

    if (authHeader) {
      // Expecting tokens in Authorization header as JSON
      try {
        tokens = JSON.parse(authHeader.replace("Bearer ", ""));
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid authorization header format" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "No authorization header provided" },
        { status: 401 }
      );
    }

    if (!tokens?.twitter) {
      return NextResponse.json(
        { error: "No Twitter token provided for this user" },
        { status: 400 }
      );
    }

    console.log("Using Twitter credentials to fetch posts");

    // Try Bearer Token first (simpler authentication)
    let client;
    if (tokens.twitter.bearerToken) {
      client = new TwitterApi(tokens.twitter.bearerToken);
    } else {
      // Fallback to OAuth 1.0a
      client = new TwitterApi({
        appKey: tokens.twitter.appKey,
        appSecret: tokens.twitter.appSecret,
        accessToken: tokens.twitter.accessToken,
        accessSecret: tokens.twitter.accessSecret,
      });
    }

    const roClient = client.readOnly;

    let tweets;

    if (userId) {
      // Get tweets from a specific user
      tweets = await roClient.v2.userTimeline(userId, {
        max_results: Math.min(count, 100), // Twitter API limit
        exclude: ["retweets", "replies"], // Optional: exclude retweets and replies
        "tweet.fields": [
          "created_at",
          "author_id",
          "public_metrics",
          "context_annotations",
        ],
        "user.fields": ["username", "name", "profile_image_url"],
        expansions: ["author_id"],
      });
    } else {
      // Get home timeline tweets (user's feed)
      tweets = await roClient.v2.homeTimeline({
        max_results: Math.min(count, 100),
        "tweet.fields": [
          "created_at",
          "author_id",
          "public_metrics",
          "context_annotations",
        ],
        "user.fields": ["username", "name", "profile_image_url"],
        expansions: ["author_id"],
      });
    }

    // Format the response
    const formattedTweets =
      tweets.data.data?.map((tweet: any) => {
        const author = tweets.includes?.users?.find(
          (user: any) => user.id === tweet.author_id
        );

        return {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author: {
            id: tweet.author_id,
            username: author?.username,
            name: author?.name,
            profile_image_url: author?.profile_image_url,
          },
          metrics: tweet.public_metrics,
          url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      tweets: formattedTweets,
      count: formattedTweets.length,
      meta: tweets.data.meta,
    });
  } catch (error: any) {
    console.error("Error fetching from X/Twitter:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      data: error.data,
      errors: error.errors,
      type: error.type,
      request: error.request,
      response: error.response,
    });

    // Handle specific Twitter API errors
    if (error.code === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (error.code === 401 || error.code === 403) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Please check your Twitter credentials and app permissions.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Something went wrong while fetching tweets",
        code: error.code,
        data: error.data,
        errors: error.errors,
        type: error.type,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, count = 5, tokens } = body;

    if (!tokens?.twitter) {
      return NextResponse.json(
        { error: "No Twitter token provided for this user" },
        { status: 400 }
      );
    }

    console.log("Using Twitter credentials to fetch posts");

    // Try Bearer Token first (simpler authentication)
    let client;
    if (tokens.twitter.bearerToken) {
      client = new TwitterApi(tokens.twitter.bearerToken);
    } else {
      // Fallback to OAuth 1.0a
      client = new TwitterApi({
        appKey: tokens.twitter.appKey,
        appSecret: tokens.twitter.appSecret,
        accessToken: tokens.twitter.accessToken,
        accessSecret: tokens.twitter.accessSecret,
      });
    }

    const roClient = client.readOnly;

    let tweets;

    if (userId) {
      // Get tweets from a specific user
      tweets = await roClient.v2.userTimeline(userId, {
        max_results: Math.min(count, 100),
        exclude: ["retweets", "replies"],
        "tweet.fields": [
          "created_at",
          "author_id",
          "public_metrics",
          "context_annotations",
        ],
        "user.fields": ["username", "name", "profile_image_url"],
        expansions: ["author_id"],
      });
    } else {
      // Get home timeline tweets
      tweets = await roClient.v2.homeTimeline({
        max_results: Math.min(count, 100),
        "tweet.fields": [
          "created_at",
          "author_id",
          "public_metrics",
          "context_annotations",
        ],
        "user.fields": ["username", "name", "profile_image_url"],
        expansions: ["author_id"],
      });
    }

    // Format the response
    const formattedTweets =
      tweets.data.data?.map((tweet: any) => {
        const author = tweets.includes?.users?.find(
          (user: any) => user.id === tweet.author_id
        );

        return {
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.created_at,
          author: {
            id: tweet.author_id,
            username: author?.username,
            name: author?.name,
            profile_image_url: author?.profile_image_url,
          },
          metrics: tweet.public_metrics,
          url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
        };
      }) || [];

    return NextResponse.json({
      success: true,
      tweets: formattedTweets,
      count: formattedTweets.length,
      meta: tweets.data.meta,
    });
  } catch (error: any) {
    console.error("Error fetching from X/Twitter:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      data: error.data,
      errors: error.errors,
      type: error.type,
      request: error.request,
      response: error.response,
    });

    if (error.code === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    if (error.code === 401 || error.code === 403) {
      return NextResponse.json(
        {
          error:
            "Unauthorized. Please check your Twitter credentials and app permissions.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || "Something went wrong while fetching tweets",
        code: error.code,
        data: error.data,
        errors: error.errors,
        type: error.type,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
