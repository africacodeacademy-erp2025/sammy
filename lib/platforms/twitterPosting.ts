import { GraphState } from "../../src/app/api/agent/route";

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  try {
    const { post, platform, threadId, tokens, userId, authToken } = state;

    if (!post)
      return { success: false, error: "Oops! Your Twitter/X post is empty." };

    if (!userId)
      return { success: false, error: "User information is missing." };

    if (!tokens?.twitter)
      return { success: false, error: "Twitter/X credentials are missing." };

    console.log("📡 Sending post to Twitter/X endpoint:", {
      post,
      platform,
      threadId,
      authToken,
    });

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/postings/x-posting`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${authToken}`,
        },
        body: JSON.stringify({ post, platform: "twitter", tokens }),
      }
    );

    if (!res.ok) {
      const bodyText = await res.text();
      console.error("Twitter API failed:", bodyText);
      return {
        success: false,
        error: `Could not post to Twitter/X. ${res.status} error.`,
      };
    }

    const data = await res.json();
    console.log("Twitter API success:", data);

    return { ...state, result: data, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Unknown error" };
  }
}
