import { GraphState } from "../../src/app/api/agent/route";

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { post, platform, threadId, tokens, userId, authToken } = state;

  if (!post)
    throw new Error(
      "Oops! Your Twitter/X post is empty. Please write something before posting."
    );

  if (!userId)
    throw new Error(
      "User information is missing. Please log in again to continue."
    );

  if (!tokens?.twitter)
    throw new Error(
      "Twitter/X credentials are missing. Please connect your Twitter/X account in settings."
    );

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
    throw new Error(
      `Could not post to Twitter/X. ${res.status} error. Please check your credentials or try again later.`
    );
  }

  const data = await res.json();
  console.log("Twitter API success:", data);

  return { ...state, result: data };
}
