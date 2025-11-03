import { GraphState } from "../../src/app/api/agent/route";
import { handleExpiredToken } from "../auth";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { decrypt, encrypt } from "../crypto";

const LINKEDIN_POSTING_ENDPOINT = "/api/postings/linkedin-posting";

export async function refreshLinkedInToken(
  userId: string
): Promise<string | null> {
  const db = await connectDB();
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId) });

  if (!user || !user.linkedin || !user.linkedin.refreshToken) {
    console.error("No refresh token found for user:", userId);
    return null;
  }

  const refreshToken = decrypt(user.linkedin.refreshToken);

  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("LinkedIn OAuth credentials not configured");
      return null;
    }

    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error(
        "LinkedIn token refresh failed:",
        await tokenResponse.text()
      );
      return null;
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Encrypt and save the new tokens
    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "linkedin.accessToken": encrypt(access_token),
          "linkedin.refreshToken": refresh_token
            ? encrypt(refresh_token)
            : user.linkedin.refreshToken, // Keep old one if not provided
          "linkedin.expiresAt": new Date(Date.now() + expires_in * 1000),
        },
      }
    );

    console.log("Successfully refreshed LinkedIn token for user:", userId);
    return access_token;
  } catch (error) {
    console.error("Error refreshing LinkedIn token:", error);
    // If refresh token is invalid or revoked, clear it
    if ((error as any).message?.includes("invalid_grant")) {
      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        {
          $unset: {
            "linkedin.accessToken": "",
            "linkedin.refreshToken": "",
            "linkedin.expiresAt": "",
          },
        }
      );
      console.error(
        "LinkedIn refresh token was invalid. User needs to re-authenticate."
      );
    }
    return null;
  }
}

export async function linkedinPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const validationError = validateLinkedInPostState(state);
    if (validationError) return validationError;

    const { post, authToken, tokens, attachments } = state;

    logLinkedInPostAttempt(state);

    console.log("=== LinkedInPosting Debug ===");
    console.log("Attachments in state:", attachments?.length || 0);
    if (attachments) {
      attachments.forEach((file, index) => {
        console.log(
          `LinkedInPosting attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
        );
      });
    }

    const formData = new FormData();
    formData.append("post", post!);
    formData.append("platform", "linkedin");
    formData.append(
      "tokens",
      JSON.stringify({
        linkedin: {
          accessToken: tokens!.linkedin!.accessToken,
          personUrn: tokens!.linkedin!.personUrn,
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
      `${process.env.NEXT_PUBLIC_BASE_URL}${LINKEDIN_POSTING_ENDPOINT}`,
      {
        method: "POST",
        headers: {
          Authorization: authToken!,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      return handleLinkedInPostError(response, state);
    }

    const data = await response.json();
    console.log("LinkedIn API success:", data);

    return { ...state, result: data, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}

function validateLinkedInPostState(
  state: GraphState
): Partial<GraphState> | null {
  const { post, userId, tokens } = state;

  if (!post) {
    return { success: false, error: "Oops! Your LinkedIn post is empty." };
  }

  if (!userId) {
    return { success: false, error: "User information is missing." };
  }

  if (!tokens?.linkedin?.accessToken) {
    return { success: false, error: "LinkedIn credentials are missing." };
  }

  return null;
}

function logLinkedInPostAttempt(state: GraphState): void {
  const { post, platform, threadId, authToken, tokens } = state;
  console.log("📡 Sending post to LinkedIn endpoint:", {
    post,
    platform,
    threadId,
    authToken,
    hasAccessToken: !!tokens?.linkedin?.accessToken,
  });
}

async function handleLinkedInPostError(
  response: Response,
  state: GraphState
): Promise<Partial<GraphState>> {
  const { userId } = state;
  const errorData = await response.json();
  console.error("LinkedIn API error:", errorData);

  if (response.status === 401 && userId) {
    const expiredTokenHandled = await handleExpiredToken(userId, "linkedin");
    if (expiredTokenHandled) {
      return {
        success: false,
        error:
          "Your LinkedIn session expired, but we've refreshed it. Please try posting again! ✨",
      };
    }
  }

  return {
    success: false,
    error:
      errorData.error ||
      "Failed to post to LinkedIn. Please check your credentials and try again.",
  };
}
