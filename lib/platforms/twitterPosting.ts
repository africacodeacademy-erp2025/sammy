import { GraphState } from "../../src/app/api/agent/route";

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
      return handleTwitterPostError(response);
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
  response: Response
): Promise<Partial<GraphState>> {
  const bodyText = await response.text();
  console.error("Twitter API failed:", bodyText);
  return {
    success: false,
    error: `Could not post to Twitter/X. ${response.status} error.`,
  };
}
