import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { ObjectId } from "mongodb";

type ScheduledPost = {
  _id: ObjectId;
  prompt: string;
  platform: string;
  scheduleTime: string;
  status: "scheduled" | "ready_for_review" | string;
  post?: string;
  threadId?: string;
  updatedAt?: Date;
};

type ScheduledPostsResponse = {
  scheduled: ScheduledPost[];
  readyForReview: ScheduledPost[];
};

export async function GET() {
  try {
    const db = await connectDB();
    const scheduledPosts = db.collection<ScheduledPost>("scheduledPosts");

    const allPosts = await scheduledPosts.find({}).toArray();

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
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    const db = await connectDB();
    const scheduledPosts = db.collection<ScheduledPost>("scheduledPosts");

    const result = await scheduledPosts.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Post not found or already deleted" },
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
