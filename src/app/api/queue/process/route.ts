/**
 * POST /api/queue/process
 * Manually trigger queue processing (can also be called by cron)
 *
 * GET /api/queue/status?postId=xxx
 * Check status of a queued post
 */

import { NextRequest, NextResponse } from "next/server";
import { processPostingQueue } from "../../../../../workers/postingQueueWorker";
import {
  getPostStatus,
  retryPost,
} from "../../../../../lib/queue/postingQueue";
import { getUserFromRequest } from "../../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Optional: Add authentication or cron secret validation
    const { action, postId } = await req.json();

    if (action === "process") {
      // Trigger queue processing
      const result = await processPostingQueue();
      return NextResponse.json({
        success: true,
        ...result,
      });
    } else if (action === "retry" && postId) {
      // Retry a specific post
      const user = await getUserFromRequest(req.headers.get("authorization"));
      if (!user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      await retryPost(postId);
      return NextResponse.json({
        success: true,
        message: "Post queued for retry",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Queue API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "postId required" },
        { status: 400 }
      );
    }

    const post = await getPostStatus(postId);

    if (!post) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    // Only return post if it belongs to the user
    if (post.userId !== user._id.toString()) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      post: {
        id: post._id,
        status: post.status,
        attempts: post.attempts,
        maxAttempts: post.maxAttempts,
        lastError: post.lastError,
        createdAt: post.createdAt,
        lastAttemptAt: post.lastAttemptAt,
        completedAt: post.completedAt,
      },
    });
  } catch (error: any) {
    console.error("Queue status error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
