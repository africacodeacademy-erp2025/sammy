/**
 * Posting Queue Worker
 *
 * Processes queued posts in the background.
 * Runs periodically (e.g., every 2 minutes) to attempt posting.
 * This handles intermittent network issues better than synchronous retries.
 */

import {
  getPendingPosts,
  updatePostStatus,
  QueuedPost,
} from "../lib/queue/postingQueue";

/**
 * Process a single LinkedIn post from the queue
 */
async function processLinkedInPost(queuedPost: QueuedPost) {
  try {
    console.log(`📤 Processing LinkedIn post: ${queuedPost._id}`);

    const sharePayload = {
      author: queuedPost.personUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: queuedPost.content,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // Use a longer timeout for background processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds

    const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${queuedPost.accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "User-Agent": "SammyApp/1.0",
      },
      body: JSON.stringify(sharePayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    await updatePostStatus(queuedPost._id!.toString(), "completed");

    console.log(`✅ LinkedIn post successful: ${queuedPost._id}`);
    return { success: true, result };
  } catch (error: any) {
    console.error(
      `❌ LinkedIn post failed (attempt ${queuedPost.attempts + 1}/${
        queuedPost.maxAttempts
      }):`,
      error.message
    );

    // Check if we've exceeded max attempts
    if (queuedPost.attempts + 1 >= queuedPost.maxAttempts) {
      await updatePostStatus(
        queuedPost._id!.toString(),
        "failed",
        error.message
      );
      console.error(
        `💔 LinkedIn post permanently failed after ${queuedPost.maxAttempts} attempts`
      );
    } else {
      await updatePostStatus(
        queuedPost._id!.toString(),
        "pending",
        error.message
      );
      console.log(
        `🔄 Will retry LinkedIn post later (${queuedPost.attempts + 1}/${
          queuedPost.maxAttempts
        })`
      );
    }

    return { success: false, error: error.message };
  }
}

/**
 * Main queue processor
 * Call this periodically (e.g., via cron job or Agenda)
 */
export async function processPostingQueue() {
  console.log("🔄 Starting posting queue processor...");

  try {
    const pendingPosts = await getPendingPosts(10);

    if (pendingPosts.length === 0) {
      console.log("✅ No pending posts in queue");
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`📋 Found ${pendingPosts.length} pending posts`);

    let successful = 0;
    let failed = 0;

    // Process posts sequentially to avoid overwhelming the API
    for (const post of pendingPosts) {
      if (post.platform === "linkedin") {
        const result = await processLinkedInPost(post);
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      }
      // Add other platforms here (Twitter, Facebook)

      // Small delay between posts to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `✅ Queue processing complete: ${successful} successful, ${failed} failed`
    );
    return { processed: pendingPosts.length, successful, failed };
  } catch (error: any) {
    console.error("❌ Queue processor error:", error);
    throw error;
  }
}

/**
 * Setup periodic queue processing (if using in a long-running process)
 */
export function startQueueProcessor(intervalMinutes = 2) {
  console.log(
    `🚀 Starting queue processor (runs every ${intervalMinutes} minutes)`
  );

  // Run immediately
  processPostingQueue().catch(console.error);

  // Then run periodically
  const interval = setInterval(() => {
    processPostingQueue().catch(console.error);
  }, intervalMinutes * 60 * 1000);

  return interval;
}
