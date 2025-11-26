import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";
import { getUserFromRequest } from "../../../../lib/auth";

type ScheduledPost = {
  _id: ObjectId;
  userId: string;
  prompt: string;
  platform?: string; // Legacy single platform
  platforms?: string[]; // New multi-platform array
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

/**
 * PUT - Update a scheduled post (prompt and/or scheduleTime)
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, prompt, scheduleTime } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Scheduled post ID is required" },
        { status: 400 }
      );
    }

    // At least one field must be provided
    if (!prompt && !scheduleTime) {
      return NextResponse.json(
        { error: "At least one field (prompt or scheduleTime) is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const scheduledPosts = db.collection<ScheduledPost>("scheduledPosts");

    // Verify ownership and get current post
    const existingPost = await scheduledPosts.findOne({
      _id: new ObjectId(id),
      userId: user._id.toString(),
    });

    if (!existingPost) {
      return NextResponse.json(
        { error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    // Only allow editing posts that are still "scheduled" (not yet processed)
    if (existingPost.status !== "scheduled") {
      return NextResponse.json(
        { error: "Cannot edit a post that has already been processed" },
        { status: 400 }
      );
    }

    // Build update object
    const updateFields: Partial<ScheduledPost> = {
      updatedAt: new Date(),
    };

    if (prompt) {
      updateFields.prompt = prompt;
    }

    // If scheduleTime is changing, we need to reschedule the Agenda job
    let newJobId: string | undefined;
    if (scheduleTime) {
      // Validate the new schedule time is in the future
      const newScheduleDate = new Date(scheduleTime);
      if (newScheduleDate <= new Date()) {
        return NextResponse.json(
          { error: "Schedule time must be in the future" },
          { status: 400 }
        );
      }

      updateFields.scheduleTime = scheduleTime;

      // Cancel the old job if it exists
      if (existingPost.jobId) {
        try {
          const { cancelScheduledPost } = await import(
            "../../../../workers/schedulePostWorker"
          );
          await cancelScheduledPost(existingPost.jobId);
          console.log(`✅ Cancelled old Agenda job ${existingPost.jobId}`);
        } catch (err) {
          console.error("Failed to cancel old Agenda job:", err);
        }
      }

      // Schedule a new job with the new time
      try {
        const { schedulePost } = await import(
          "../../../../workers/schedulePostWorker"
        );
        newJobId = await schedulePost(id, newScheduleDate);
        updateFields.jobId = newJobId;
        console.log(
          `📅 Rescheduled post ${id} for ${scheduleTime}, new job: ${newJobId}`
        );
      } catch (err) {
        console.error("Failed to reschedule post:", err);
        return NextResponse.json(
          { error: "Failed to reschedule the post" },
          { status: 500 }
        );
      }
    }

    // Update the document
    await scheduledPosts.updateOne(
      { _id: new ObjectId(id), userId: user._id.toString() },
      { $set: updateFields }
    );

    // Format response message
    const localTimeString = scheduleTime
      ? new Date(scheduleTime).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : null;

    return NextResponse.json({
      success: true,
      message: scheduleTime
        ? `Post updated and rescheduled for ${localTimeString}`
        : "Post updated successfully",
      scheduleTime: scheduleTime || existingPost.scheduleTime,
      jobId: newJobId || existingPost.jobId,
    });
  } catch (error) {
    console.error("Error updating scheduled post:", error);
    return NextResponse.json(
      { error: "Failed to update scheduled post" },
      { status: 500 }
    );
  }
}
