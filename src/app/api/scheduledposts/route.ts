  /* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";

type ScheduledPostDoc = {
  id: string;
  content: string;
  timestamp: number;
  platform: string;
  status: "scheduled" | "posted" | "cancelled" | "failed";
  threadId?: string;
  createdAt: number;
  scheduledFor: number;
};

export async function GET() {
  try {
    const db = await connectDB();
    const collection = db.collection<ScheduledPostDoc>("scheduled_posts");

    // Fetch all scheduled posts, sorted by scheduled time
    const scheduledPosts = await collection
      .find({})
      .sort({ scheduledFor: 1 })
      .toArray();

    return NextResponse.json({ 
      success: true, 
      scheduledPosts: scheduledPosts.map((post: ScheduledPostDoc) => ({
        id: post.id,
        content: post.content,
        timestamp: post.timestamp,
        platform: post.platform,
        status: post.status,
        threadId: post.threadId
      }))
    });
  } catch (err: unknown) {
    console.error("Error fetching scheduled posts:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { content, platform, scheduledFor, threadId } = await req.json();

    if (!content || !platform || !scheduledFor) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: content, platform, scheduledFor" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const collection = db.collection<ScheduledPostDoc>("scheduled_posts");

    const scheduledPost: ScheduledPostDoc = {
      id: Math.random().toString(36).substring(2, 12),
      content,
      timestamp: scheduledFor,
      platform,
      status: "scheduled",
      threadId,
      createdAt: Date.now(),
      scheduledFor,
    };

    await collection.insertOne(scheduledPost);

    return NextResponse.json({ 
      success: true, 
      scheduledPost: {
        id: scheduledPost.id,
        content: scheduledPost.content,
        timestamp: scheduledPost.timestamp,
        platform: scheduledPost.platform,
        status: scheduledPost.status,
        threadId: scheduledPost.threadId
      }
    });
  } catch (err: unknown) {
    console.error("Error creating scheduled post:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: id, status" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const collection = db.collection<ScheduledPostDoc>("scheduled_posts");

    const result = await collection.updateOne(
      { id },
      { $set: { status, updatedAt: Date.now() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error updating scheduled post:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const collection = db.collection<ScheduledPostDoc>("scheduled_posts");

    const result = await collection.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Scheduled post not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error deleting scheduled post:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}