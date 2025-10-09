import { GraphState } from "../../src/app/api/agent/route";
import { handleExpiredToken } from "../auth";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";

const TWITTER_POSTING_ENDPOINT = "/api/postings/x-posting";

interface TwitterPostRequest {
  post: string;
  platform: string;
  tokens: {
    twitter: {
      accessToken: string;
    };
  };
}

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const validationError = validateTwitterPostState(state);
    if (validationError) return validationError;

    const { post, authToken, tokens } = state;

    logTwitterPostAttempt(state);

    const requestBody = createTwitterPostRequest(post!, tokens!);
    const response = await sendTwitterPostRequest(requestBody, authToken!);

    if (!response.ok) {
      return handleTwitterPostError(response, state);
    }

    const data = await response.json();
    console.log("Twitter API success:", data);

    return { ...state, result: data, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

function validateTwitterPostState(
  state: GraphState
): Partial<GraphState> | null {
  const { post, userId, tokens } = state;

  if (!post) {
    return { success: false, error: "Oops! Your Twitter/X post is empty." };
  }

  if (!userId) {
    return { success: false, error: "User information is missing." };
  }

  if (!tokens?.twitter?.accessToken) {
    return { success: false, error: "Twitter/X credentials are missing." };
  }

  return null;
}

function logTwitterPostAttempt(state: GraphState): void {
  const { post, platform, threadId, authToken, tokens } = state;
  console.log("📡 Sending post to Twitter/X endpoint:", {
    post,
    platform,
    threadId,
    authToken,
    hasAccessToken: !!tokens?.twitter?.accessToken,
  });
}

function createTwitterPostRequest(
  post: string,
  tokens: GraphState["tokens"]
): TwitterPostRequest {
  return {
    post,
    platform: "twitter",
    tokens: {
      twitter: {
        accessToken: tokens!.twitter!.accessToken,
      },
    },
  };
}

async function sendTwitterPostRequest(
  requestBody: TwitterPostRequest,
  authToken: string
): Promise<Response> {
  return fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}${TWITTER_POSTING_ENDPOINT}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${authToken}`,
      },
      body: JSON.stringify(requestBody),
    }
  );
}

async function handleTwitterPostError(
  response: Response,
  state: GraphState
): Promise<Partial<GraphState>> {
  const bodyText = await response.text();
  console.error("Twitter API failed:", bodyText);

  // Check for expired token
  const tokenError = handleExpiredToken({ code: response.status }, "twitter");

  if (tokenError.expired) {
    console.log("Attempting to refresh Twitter token...");
    const newAccessToken = await refreshTwitterToken(state.userId!);

    if (newAccessToken) {
      console.log("Token refreshed successfully. Retrying request...");
      state.tokens!.twitter!.accessToken = newAccessToken;
      return twitterPosting(state); // Retry the request
    }

    return {
      success: false,
      error: "Token expired and could not be refreshed. Please reauthenticate.",
    };
  }

  return {
    success: false,
    error: `Could not post to Twitter/X. ${response.status} error.`,
  };
}

/**
 * Refreshes the Twitter access token using the stored refresh token.
 * Updates the user object in the database with the new tokens.
 */
export async function refreshTwitterToken(
  userId: string
): Promise<string | null> {
  try {
    const db = await connectDB();
    const users = db.collection("users");

    // Fetch the user's refresh token
    const user = await users.findOne({ _id: new ObjectId(userId) });
    const refreshToken = user?.twitter?.refreshToken;

    if (!refreshToken) {
      console.error("No refresh token found for user.");
      return null;
    }

    console.log("Found refresh token, attempting to refresh access token...");

    // Call Twitter's token refresh endpoint (OAuth 2.0)
    const clientId = process.env.TWITTER_CLIENT_ID!;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET!;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64"
    );

    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        "Failed to refresh Twitter token:",
        JSON.stringify(errorData)
      );

      // If the refresh token is invalid, clear it from the database
      if (errorData.error === "invalid_request") {
        console.log("Invalid refresh token. Clearing tokens from database.");
        await users.updateOne(
          { _id: new ObjectId(userId) },
          {
            $unset: {
              "twitter.accessToken": "",
              "twitter.refreshToken": "",
              "twitter.expiresAt": "",
            },
          }
        );
      }

      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    // Update the user's tokens in the database
    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "twitter.accessToken": newAccessToken,
          "twitter.refreshToken": newRefreshToken,
        },
      }
    );

    return newAccessToken;
  } catch (error) {
    console.error("Error refreshing Twitter token:", error);
    return null;
  }
}
