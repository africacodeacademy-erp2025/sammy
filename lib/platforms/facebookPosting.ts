import { GraphState } from "../../src/app/api/agent/route";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";

const FACEBOOK_POSTING_ENDPOINT = "/api/postings/fb-posting";

interface FacebookPostRequest {
  post: string;
  platform: string;
  tokens: {
    facebook: {
      pageId: string;
      accessToken: string;
    };
  };
}

export async function facebookPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const validationError = validateFacebookPostState(state);
    if (validationError) return validationError;

    const { post, authToken, tokens, attachments } = state;
    const { pageId, accessToken } = tokens!.facebook!;

    logFacebookPostAttempt(state, pageId);

    console.log("=== FacebookPosting Debug ===");
    console.log("Attachments in state:", attachments?.length || 0);
    if (attachments) {
      attachments.forEach((file, index) => {
        console.log(
          `FacebookPosting attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
        );
      });
    }

    const formData = new FormData();
    formData.append("post", post!);
    formData.append("platform", "facebook");
    formData.append(
      "tokens",
      JSON.stringify({
        facebook: {
          pageId,
          accessToken,
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
      `${process.env.NEXT_PUBLIC_BASE_URL}${FACEBOOK_POSTING_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Authorization: authToken!,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      return await handleFacebookPostError(response, state);
    }

    const data = await response.json();
    console.log("Facebook API success:", data);

    return { ...state, result: data, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

function validateFacebookPostState(
  state: GraphState
): Partial<GraphState> | null {
  const { post, userId, tokens } = state;

  if (!post) {
    return { success: false, error: "Oops! Your Facebook post is empty." };
  }

  if (!userId) {
    return { success: false, error: "User information is missing." };
  }

  if (!tokens?.facebook) {
    return { success: false, error: "Facebook credentials are missing." };
  }

  const { pageId, accessToken } = tokens.facebook;

  if (!pageId || !accessToken) {
    return {
      success: false,
      error: "Facebook Page ID or Access Token is missing.",
    };
  }

  return null;
}

function logFacebookPostAttempt(state: GraphState, pageId: string): void {
  const { post, platform, threadId, userId, authToken } = state;
  console.log("📡 Sending post to Facebook endpoint:", {
    post,
    platform,
    threadId,
    userId,
    authToken,
    pageId,
  });
}

async function handleFacebookPostError(
  response: Response,
  state: GraphState
): Promise<Partial<GraphState>> {
  let errorData;
  let errorMessage;

  try {
    errorData = await response.json();
    errorMessage = JSON.stringify(errorData, null, 2);
    console.error("Facebook API failed:", errorData);
  } catch {
    errorMessage = await response.text();
    console.error("Facebook API failed (raw):", errorMessage);
    return {
      success: false,
      error: `Could not post to Facebook. ${response.status} error.`,
    };
  }

  // Check for expired token (error code 190 is common for this)
  if (errorData?.data?.error?.code === 190) {
    console.log("Facebook token expired. Attempting to refresh...");
    const newAccessToken = await refreshFacebookToken(state.userId!);

    if (newAccessToken) {
      console.log("Facebook token refreshed successfully. Retrying post...");
      // Update state with the new token and retry
      const newTokens = { ...state.tokens! };
      newTokens.facebook!.accessToken = newAccessToken;
      return facebookPosting({ ...state, tokens: newTokens });
    } else {
      return {
        success: false,
        error:
          "Facebook token is expired and could not be refreshed. Please re-authenticate.",
      };
    }
  }

  return {
    success: false,
    error: `Could not post to Facebook. ${response.status} error.`,
  };
}

/**
 * Exchanges a short-lived Facebook user access token for a long-lived one.
 * Updates the user's document in the database with the new token.
 */
export async function refreshFacebookToken(
  userId: string
): Promise<string | null> {
  try {
    const db = await connectDB();
    const users = db.collection("users");

    const user = await users.findOne({ _id: new ObjectId(userId) });
    const shortLivedToken = user?.facebook?.accessToken;

    if (!shortLivedToken) {
      console.error("No Facebook access token found for user to refresh.");
      return null;
    }

    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Facebook client ID or secret not configured.");
      return null;
    }

    const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${shortLivedToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error(
        "Failed to refresh Facebook token:",
        data.error?.message || "Unknown error"
      );
      return null;
    }

    const longLivedToken = data.access_token;

    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { "facebook.accessToken": longLivedToken } }
    );

    console.log("Successfully exchanged for a long-lived Facebook token.");
    return longLivedToken;
  } catch (error: any) {
    console.error("Error refreshing Facebook token:", error.message);
    return null;
  }
}
