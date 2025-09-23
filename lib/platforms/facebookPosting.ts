import { GraphState } from "../../src/app/api/agent/route";
export async function facebookPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const { post, platform, threadId, tokens, userId, authToken } = state;

    if (!post)
      return { success: false, error: "Oops! Your Facebook post is empty." };

    if (!userId)
      return { success: false, error: "User information is missing." };

    if (!tokens?.facebook)
      return { success: false, error: "Facebook credentials are missing." };

    const { pageId, accessToken } = tokens.facebook as unknown as {
      pageId: string;
      accessToken: string;
    };

    if (!pageId || !accessToken)
      return {
        success: false,
        error: "Facebook Page ID or Access Token is missing.",
      };

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
      return {
        success: false,
        error: `Could not post to Facebook. ${res.status} error.`,
      };
    }

    const data = await res.json();
    console.log("Facebook API success:", data);

    return { ...state, result: data, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}
