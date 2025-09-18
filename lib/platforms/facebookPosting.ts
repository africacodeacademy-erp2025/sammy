import { GraphState } from "../../src/app/api/agent/route";

export async function facebookPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { post, platform, threadId, tokens, userId, authToken } = state;

  if (!post)
    throw new Error(
      "Oops! Your Facebook post is empty. Please write something before posting."
    );

  if (!userId)
    throw new Error(
      "User information is missing. Please log in again to continue."
    );

  if (!tokens?.facebook)
    throw new Error(
      "Facebook credentials are missing. Please connect your Facebook account in settings."
    );

  const { pageId, accessToken } = tokens.facebook as unknown as {
    pageId: string;
    accessToken: string;
  };

  if (!pageId || !accessToken)
    throw new Error(
      "Facebook Page ID or Access Token is missing. Please reconnect your Facebook account."
    );

  console.log("📡 Sending post to Facebook endpoint:", {
    post,
    platform,
    threadId,
    userId,
    authToken,
    pageId,
  });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/postings/fb-posting`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${authToken}`,
      },
      body: JSON.stringify({
        post,
        platform: "facebook",
        tokens: { facebook: { pageId, accessToken } },
      }),
    }
  );

  if (!res.ok) {
    let bodyText: string;
    try {
      const errData = await res.json();
      bodyText = JSON.stringify(errData, null, 2);
      console.error("Facebook API failed:", errData);
    } catch {
      bodyText = await res.text();
      console.error("Facebook API failed (raw):", bodyText);
    }
    throw new Error(
      `Could not post to Facebook. ${res.status} error. Please check your credentials or try again later.`
    );
  }

  const data = await res.json();
  console.log("Facebook API success:", data);

  return { ...state, result: data };
}
