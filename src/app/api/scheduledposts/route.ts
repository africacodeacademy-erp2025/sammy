import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";
import { getUserFromRequest } from "../../../../lib/auth";

type ScheduledPost = {
  _id: ObjectId;
  userId: string;
  prompt: string;
  platform: string;
  scheduleTime: string;
  status: "scheduled" | "ready_for_review" | string;
  post?: string;
  threadId?: string;
  updatedAt?: Date;
  jobId?: string;
  jobStatus?: "pending" | "active" | "completed" | "failed";
  executionAttempts?: number;
  lastExecutionAt?: Date;
  processedAt?: Date;
  failureReason?: string;
};

type ScheduledPostsResponse = {
  scheduled: ScheduledPost[];
  readyForReview: ScheduledPost[];
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectDB();
    const scheduledPosts = db.collection<ScheduledPost>("scheduledPosts");

    const allPosts = await scheduledPosts
      .find({ userId: user._id.toString() })
      .toArray();

    const scheduled = allPosts.filter((p) => p.status === "scheduled");
    const readyForReview = allPosts.filter(
      (p) => p.status === "ready_for_review"
    );

    const response: ScheduledPostsResponse = {
      scheduled,
      readyForReview,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching scheduled posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    const db = await connectDB();
    const scheduledPosts = db.collection<ScheduledPost>("scheduledPosts");

    // Find the post first
    const post = await scheduledPosts.findOne({
      _id: new ObjectId(id),
      userId: user._id.toString(),
    });

    if (!post) {
      return NextResponse.json(
        { error: "Post not found or unauthorized" },
        { status: 404 }
      );
    }

    // Cancel the Agenda job if it exists
    if (post.jobId) {
      try {
        const { cancelScheduledPost } = await import(
          "../../../../workers/schedulePostWorker"
        );
        await cancelScheduledPost(post.jobId);
        console.log(`✅ Cancelled Agenda job ${post.jobId}`);
      } catch (err) {
        console.error("Failed to cancel Agenda job:", err);
        // Continue with deletion even if cancellation fails
      }
    }

    // Delete from MongoDB (source of truth)
    const result = await scheduledPosts.deleteOne({
      _id: new ObjectId(id),
      userId: user._id.toString(),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Post not found, already deleted, or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Post deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting scheduled post:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled post" },
      { status: 500 }
    );
  }
}
