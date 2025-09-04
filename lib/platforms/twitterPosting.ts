import { GraphState } from "../../src/app/api/agent/route";

function sanitizePost(post: string, maxLength = 280) {
  let sanitized = post;

  // Remove Slack/Discord-style mentions like <@U12345>
  sanitized = sanitized.replace(/<@[^>]+>/g, "");

  // Remove zero-width spaces or control characters
  sanitized = sanitized.replace(/\u200B/g, ""); // zero-width space
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, ""); // control chars

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + "...";
  }

  return sanitized;
}

export async function twitterPosting(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { post, platform, threadId } = state;

  if (!post || !platform) {
    throw new Error("Missing 'post' or 'platform' in state");
  }

  // Sanitize the post before sending
  const sanitizedPost = sanitizePost(post);

  console.log("📡 Sending sanitized post to external endpoint:", {
    post: sanitizedPost,
    platform,
  });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/postings/x-posting`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post: sanitizedPost, platform }),
    }
  );

  if (!res.ok) {
    let bodyText: string;

    try {
      // Try to parse JSON error first
      const errorData = await res.json();
      console.error("External API failed with JSON:", errorData);
      bodyText = JSON.stringify(errorData, null, 2);
    } catch {
      // If it's not JSON, fallback to raw text
      bodyText = await res.text();
      console.error("External API failed with raw response:", bodyText);
    }

    throw new Error(
      `External API error (status: ${res.status})\nResponse: ${bodyText}`
    );
  }
  const data = await res.json();

  return {
    ...state,
    post: sanitizedPost,
    platform,
    threadId,
    result: data,
  };
}
