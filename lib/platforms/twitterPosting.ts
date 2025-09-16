import { GraphState } from "../../src/app/api/agent/route";

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { post, platform, threadId, tokens, userId, authToken } = state;

  if (!post) throw new Error("Missing 'post' in state");
  if (!userId) throw new Error("User ID missing from state");
  if (!tokens?.twitter)
    throw new Error("No Twitter/X token found for this user");

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
    throw new Error(`Twitter API error (${res.status})\n${bodyText}`);
  }

  const data = await res.json();
  console.log("Twitter API success:", data);

  return { ...state, result: data };
}
