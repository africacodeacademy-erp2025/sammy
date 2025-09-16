import { GraphState } from "../../src/app/api/agent/route";

export async function facebookPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { post, platform, threadId, tokens, userId, authToken } = state;

  if (!post) throw new Error("Missing 'post' in state");
  if (!userId) throw new Error("User ID missing from state");
  if (!tokens?.facebook)
    throw new Error("No Facebook token found for this user");
  const { pageId, accessToken } = tokens.facebook as unknown as {
    pageId: string;
    accessToken: string;
  };

  if (!pageId || !accessToken) {
    throw new Error("Facebook pageId or accessToken missing from database");
  }

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
    throw new Error(`Facebook API error (${res.status})\n${bodyText}`);
  }

  const data = await res.json();
  console.log("Facebook API success:", data);

  return { ...state, result: data };
}
