import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";
import { ObjectId } from "mongodb";

interface RateLimitInfo {
  count: number;
  firstRequest: number;
  lastReset: number;
}

interface TwitterTokens {
  accessToken?: string;
  accessSecret?: string;
  appKey?: string;
  appSecret?: string;
  bearerToken?: string;
}

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

interface Message {
  user: ObjectId;
  message: string;
  platform: "twitter";
  tweetId: string;
  createdAt?: string;
}

interface TwitterApiError extends Error {
  code?: number;
  rateLimit?: {
    reset?: number;
    limit?: number;
    remaining?: number;
  };
}

interface User {
  _id: ObjectId;
  twitter?: TwitterTokens;
}

const tweetCache = new Map<string, { tweets: Message[]; timestamp: number }>();
const CACHE_DURATION_MS = 5 * 60 * 1000;

const rateLimitStore = new Map<string, RateLimitInfo>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

async function getTwitterClient(tokens: TwitterTokens): Promise<TwitterApi> {
  if (
    tokens?.accessToken &&
    tokens?.accessSecret &&
    tokens.appKey &&
    tokens.appSecret
  ) {
    return new TwitterApi({
      appKey: tokens.appKey,
      appSecret: tokens.appSecret,
      accessToken: decrypt(tokens.accessToken),
      accessSecret: decrypt(tokens.accessSecret),
    });
  } else if (tokens?.bearerToken) {
    return new TwitterApi(decrypt(tokens.bearerToken));
  }
  throw new Error("No valid Twitter credentials found");
}

function checkRateLimit(userId: string): {
  allowed: boolean;
  resetTime?: number;
  remaining?: number;
} {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit) {
    rateLimitStore.set(userId, { count: 1, firstRequest: now, lastReset: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (now - userLimit.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(userId, { count: 1, firstRequest: now, lastReset: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetTime = userLimit.firstRequest + RATE_LIMIT_WINDOW_MS;
    return { allowed: false, resetTime, remaining: 0 };
  }

  userLimit.count++;
  const remaining = MAX_REQUESTS_PER_WINDOW - userLimit.count;
  return { allowed: true, remaining };
}

function createErrorResponse(
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, ...details }, { status });
}

function parseCountParam(searchParams: URLSearchParams): number {
  const countParam = searchParams.get("count") || "5";
  const count = parseInt(countParam);
  return Math.max(1, Math.min(isNaN(count) ? 5 : count, 100));
}

function getCacheKey(userId: string, count: number): string {
  return `tweets:${userId}:${count}`;
}

function getCachedTweets(userId: string, count: number): Message[] | null {
  const cacheKey = getCacheKey(userId, count);
  const cached = tweetCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.tweets;
  }

  return null;
}

function cacheTweets(userId: string, count: number, tweets: Message[]): void {
  const cacheKey = getCacheKey(userId, count);
  tweetCache.set(cacheKey, { tweets, timestamp: Date.now() });
}

function mapTweetsToMessages(
  tweets: Tweet[],
  systemUserId: ObjectId
): Message[] {
  return tweets
    .filter((tweet) => tweet.text && !tweet.text.startsWith("RT @"))
    .map((tweet) => ({
      user: systemUserId,
      message: tweet.text,
      platform: "twitter" as const,
      tweetId: tweet.id,
      createdAt: tweet.created_at,
    }));
}

function isTwitterApiError(error: unknown): error is TwitterApiError {
  return error instanceof Error && "code" in error;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const user = (await getUserFromRequest(
      req.headers.get("authorization")
    )) as User | null;
    const userId = user?._id?.toString();

    if (!user || !userId) {
      return createErrorResponse("Authentication required", 401);
    }

    if (!user.twitter) {
      return createErrorResponse("Twitter not configured", 400);
    }

    const searchParams = new URL(req.url).searchParams;
    const count = parseCountParam(searchParams);

    // Check cache first
    const cachedTweets = getCachedTweets(userId, count);
    if (cachedTweets) {
      return NextResponse.json({
        success: true,
        messages: cachedTweets,
        info: "Serving from cache",
        meta: { cached: true, count: cachedTweets.length },
      });
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      const resetInMinutes = Math.ceil(
        (rateLimitCheck.resetTime! - Date.now()) / 60000
      );
      return createErrorResponse(
        `Rate limit exceeded. Please try again in ${resetInMinutes} minutes.`,
        429,
        {
          retryAfter: resetInMinutes * 60,
          remaining: rateLimitCheck.remaining,
        }
      );
    }

    const client = await getTwitterClient(user.twitter);
    const currentUser = await client.currentUser();
    const twitterUserId = String(currentUser.id);
    const twitterUsername = currentUser.screen_name;

    console.log(
      `Fetching tweets for user: ${twitterUsername} (${currentUser.statuses_count} total tweets)`
    );

    try {
      // With Basic access, we can't use timeline endpoints
      // Let's try approaches that work with Basic tier

      console.log("Using Basic tier compatible approaches...");

      // Approach 1: Try recent search (available on Basic)
      try {
        console.log(`Searching for recent tweets from @${twitterUsername}...`);
        const searchResults = await client.v2.search(
          `from:${twitterUsername}`,
          {
            max_results: Math.min(count * 2, 100),
            "tweet.fields": ["id", "text", "created_at", "author_id"],
          }
        );

        if (searchResults?.data?.data && searchResults.data.data.length > 0) {
          console.log(`Search found ${searchResults.data.data.length} tweets`);

          const messages = mapTweetsToMessages(
            searchResults.data.data,
            user._id
          );
          const limitedMessages = messages.slice(0, count);

          cacheTweets(userId, count, limitedMessages);

          return NextResponse.json({
            success: true,
            messages: limitedMessages,
            meta: {
              totalTweets: searchResults.data.data.length,
              finalCount: limitedMessages.length,
              responseTime: `${Date.now() - startTime}ms`,
              remainingRequests: rateLimitCheck.remaining,
              cached: false,
              apiVersion: "v2-search",
              note: "Using search API due to Basic tier limitations",
            },
          });
        } else {
          console.log("Search API returned no results:", {
            hasData: !!searchResults?.data,
            hasDataArray: !!searchResults?.data?.data,
            dataLength: searchResults?.data?.data?.length || 0,
            meta: searchResults?.data?.meta,
          });
        }
      } catch (searchError) {
        console.log("Search API failed:", searchError);

        // If search also fails, try a different search approach
        try {
          console.log("Trying alternative search query...");
          const altSearch = await client.v2.search(
            `@${twitterUsername} OR from:${twitterUsername}`,
            {
              max_results: 10,
            }
          );

          if (altSearch?.data?.data && altSearch.data.data.length > 0) {
            const userTweets = altSearch.data.data.filter(
              (tweet) =>
                tweet.author_id === twitterUserId ||
                tweet.text.includes(`@${twitterUsername}`)
            );

            if (userTweets.length > 0) {
              const messages = userTweets.slice(0, count).map((tweet) => ({
                user: user._id,
                message: tweet.text,
                platform: "twitter" as const,
                tweetId: tweet.id,
                createdAt: tweet.created_at,
              }));

              cacheTweets(userId, count, messages);

              return NextResponse.json({
                success: true,
                messages,
                meta: {
                  totalTweets: userTweets.length,
                  finalCount: messages.length,
                  responseTime: `${Date.now() - startTime}ms`,
                  remainingRequests: rateLimitCheck.remaining,
                  cached: false,
                  apiVersion: "v2-alt-search",
                  note: "Using alternative search due to Basic tier limitations",
                },
              });
            }
          }
        } catch (altSearchError) {
          console.log("Alternative search also failed:", altSearchError);
        }
      }

      // If we get here, no approaches worked
      console.log(
        `No tweets retrievable with Basic tier access for user ${twitterUsername}`
      );
      const emptyMessages: Message[] = [];
      cacheTweets(userId, count, emptyMessages);

      return NextResponse.json({
        success: true,
        messages: emptyMessages,
        info: `Unable to retrieve tweets with Basic tier access. User has ${currentUser.statuses_count} total tweets.`,
        meta: {
          userInfo: {
            username: twitterUsername,
            totalTweets: currentUser.statuses_count,
            protected: currentUser.protected,
          },
          limitation: "Timeline endpoints require Elevated access",
          suggestion:
            "Apply for Elevated access at https://developer.x.com/en/portal/product",
        },
      });

      return NextResponse.json({
        success: true,
        messages: emptyMessages,
        info: `No tweets found. User has ${currentUser.statuses_count} total tweets.`,
        meta: {
          userInfo: {
            username: twitterUsername,
            totalTweets: currentUser.statuses_count,
            protected: currentUser.protected,
          },
        },
      });
    } catch (apiError) {
      if (isTwitterApiError(apiError) && apiError.code === 429) {
        const resetTime = apiError.rateLimit?.reset
          ? apiError.rateLimit.reset * 1000
          : Date.now() + RATE_LIMIT_WINDOW_MS;
        rateLimitStore.set(userId, {
          count: MAX_REQUESTS_PER_WINDOW,
          firstRequest: Date.now() - RATE_LIMIT_WINDOW_MS + 1000,
          lastReset: resetTime,
        });

        const resetInMinutes = Math.ceil((resetTime - Date.now()) / 60000);
        return createErrorResponse(
          "Twitter API rate limit exceeded. Please try again later.",
          429,
          {
            retryAfter: Math.max(60, resetInMinutes * 60),
            resetTime: new Date(resetTime).toISOString(),
          }
        );
      }

      throw apiError;
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (isTwitterApiError(error)) {
      if (error.code === 401 || error.code === 403) {
        return createErrorResponse(
          "Twitter authentication failed. Please reconnect your Twitter account.",
          401
        );
      }

      if (error.code === 404) {
        return createErrorResponse("Twitter user not found", 404);
      }
    }

    console.error("Twitter fetch error:", error);

    return createErrorResponse("Failed to fetch tweets from Twitter", 500, {
      details: error instanceof Error ? error.message : "Unknown error",
      responseTime: `${responseTime}ms`,
    });
  }
}
