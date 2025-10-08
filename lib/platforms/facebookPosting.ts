import { GraphState } from "../../src/app/api/agent/route";

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

    const { post, authToken, tokens } = state;
    const { pageId, accessToken } = tokens!.facebook!;

    logFacebookPostAttempt(state, pageId);

    const requestBody = createFacebookPostRequest(post!, pageId, accessToken);
    const response = await sendFacebookPostRequest(requestBody, authToken!);

    if (!response.ok) {
      return await handleFacebookPostError(response);
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

function createFacebookPostRequest(
  post: string,
  pageId: string,
  accessToken: string
): FacebookPostRequest {
  return {
    post,
    platform: "facebook",
    tokens: {
      facebook: {
        pageId,
        accessToken,
      },
    },
  };
}

async function sendFacebookPostRequest(
  requestBody: FacebookPostRequest,
  authToken: string
): Promise<Response> {
  return fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}${FACEBOOK_POSTING_ENDPOINT}`,
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

async function handleFacebookPostError(
  response: Response
): Promise<Partial<GraphState>> {
  let errorMessage: string;

  try {
    const errData = await response.json();
    errorMessage = JSON.stringify(errData, null, 2);
    console.error("Facebook API failed:", errData);
  } catch {
    errorMessage = await response.text();
    console.error("Facebook API failed (raw):", errorMessage);
  }

  return {
    success: false,
    error: `Could not post to Facebook. ${response.status} error.`,
  };
}
