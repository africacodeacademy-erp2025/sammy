import { GraphState } from "../../src/app/api/agent/route";
import { handleExpiredToken } from "../auth";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { TwitterApi } from "twitter-api-v2";
import { decrypt, encrypt } from "../crypto";

const TWITTER_POSTING_ENDPOINT = "/api/postings/x-posting";

export async function refreshTwitterToken(
  userId: string
): Promise<string | null> {
  const db = await connectDB();
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId) });

  if (!user || !user.twitter || !user.twitter.refreshToken) {
    console.error("No refresh token found for user:", userId);
    return null;
  }

  const refreshToken = decrypt(user.twitter.refreshToken);

  try {
    const client = new TwitterApi({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    });

    const {
      client: refreshedClient,
      accessToken,
      refreshToken: newRefreshToken,
    } = await client.refreshOAuth2Token(refreshToken);

    // Encrypt and save the new tokens
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "twitter.accessToken": encrypt(accessToken),
          "twitter.refreshToken": newRefreshToken
            ? encrypt(newRefreshToken)
            : user.twitter.refreshToken, // Keep old one if not provided
          "twitter.expiresAt": new Date(Date.now() + 7200 * 1000), // 2 hours from now
        },
      }
    );

    console.log("Successfully refreshed Twitter token for user:", userId);
    return accessToken;
  } catch (error) {
    console.error("Error refreshing Twitter token:", error);
    // Optionally, handle token revocation or other specific errors
    if ((error as any).data?.error === "invalid_grant") {
      // The refresh token is invalid or revoked, clear it
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        {
          $unset: {
            "twitter.accessToken": "",
            "twitter.refreshToken": "",
            "twitter.expiresAt": "",
          },
        }
      );
      console.error(
        "Twitter refresh token was invalid. User needs to re-authenticate."
      );
    }
    return null;
  }
}

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const validationError = validateTwitterPostState(state);
    if (validationError) return validationError;

    const { post, authToken, tokens, attachments } = state;

    logTwitterPostAttempt(state);

    console.log("=== TwitterPosting Debug ===");
    console.log("Attachments in state:", attachments?.length || 0);
    if (attachments) {
      attachments.forEach((file, index) => {
        console.log(
          `TwitterPosting attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
        );
      });
    }

    const formData = new FormData();
    formData.append("post", post!);
    formData.append("platform", "twitter");
    formData.append(
      "tokens",
      JSON.stringify({
        twitter: {
          accessToken: tokens!.twitter!.accessToken,
        },
      })
    );

    if (attachments) {
      attachments.forEach((file, index) => {
        console.log(`Adding attachment ${index} to FormData: ${file.name}`);
        formData.append("attachments", file);
      });
    }

    console.log("FormData entries being sent:");
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(
          `${key}: File(${value.name}, ${value.size} bytes, ${value.type})`
        );
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}${TWITTER_POSTING_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Authorization: authToken!,
        },
        body: formData,
      }
    );

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

async function handleTwitterPostError(
  response: Response,
  state: GraphState
): Promise<Partial<GraphState>> {
  const { userId } = state;
  const errorData = await response.json();
  console.error("Twitter API error:", errorData);

  if (response.status === 401 && userId) {
    const expiredTokenHandled = await handleExpiredToken(userId, "twitter");
    if (expiredTokenHandled) {
      return {
        success: false,
        error:
          "Your Twitter/X session expired, but we've refreshed it. Please try posting again! ✨",
      };
    }
  }

  return {
    success: false,
    error:
      errorData.error ||
      "Failed to post to Twitter/X. Please check your credentials and try again.",
  };
}
