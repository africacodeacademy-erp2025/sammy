import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";
import { ObjectId } from "mongodb";

interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: number;
  status?: string;
  threadId?: string;
  platform?: string;
}

interface Conversation {
  _id?: ObjectId;
  userId: string;
  threadId: string;
  title: string;
  messages: Message[];
  messageCount: number;
  platform?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUserMessage?: string;
  lastAiMessage?: string;
}

/**
 * GET /api/chat-history
 * Fetch all conversations for the current user
 * Returns list of conversations with summaries (no full message content for efficiency)
 */
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
    const threadId = searchParams.get("threadId");

    const db = await connectDB();
    const conversations = db.collection<Conversation>("chatHistory");

    // If threadId is provided, fetch specific conversation with full messages
    if (threadId) {
      const conversation = await conversations.findOne({
        userId: user._id.toString(),
        threadId,
      });

      if (!conversation) {
        return NextResponse.json(
          { success: false, error: "Conversation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        conversation,
      });
    }

    // Otherwise, fetch all conversations (summary only - no full messages for efficiency)
    const allConversations = await conversations
      .find(
        { userId: user._id.toString() },
        {
          projection: {
            threadId: 1,
            title: 1,
            messageCount: 1,
            platform: 1,
            createdAt: 1,
            updatedAt: 1,
            lastUserMessage: 1,
            lastAiMessage: 1,
          },
        }
      )
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      conversations: allConversations,
    });
  } catch (error: any) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat-history
 * Save or update a conversation
 * Auto-saves conversation after each AI response
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { threadId, messages, platform } = await req.json();

    if (!threadId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "Invalid request data" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const conversations = db.collection<Conversation>("chatHistory");

    // Extract title from first user message (truncate to 60 chars)
    const firstUserMessage = messages.find((m) => m.sender === "user");
    const title = firstUserMessage
      ? firstUserMessage.content.substring(0, 60) +
        (firstUserMessage.content.length > 60 ? "..." : "")
      : "New Conversation";

    // Get last user and AI messages for quick preview (no need to load full conversation)
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((m) => m.sender === "user")?.content;
    const lastAiMessage = messages
      .slice()
      .reverse()
      .find((m) => m.sender === "ai")?.content;

    // Upsert: update if exists, insert if new
    const result = await conversations.updateOne(
      { userId: user._id.toString(), threadId },
      {
        $set: {
          title,
          messages,
          messageCount: messages.length,
          platform,
          updatedAt: new Date(),
          lastUserMessage,
          lastAiMessage,
        },
        $setOnInsert: {
          userId: user._id.toString(),
          threadId,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      conversationId: result.upsertedId?.toString() || threadId,
      message: result.upsertedCount
        ? "Conversation created"
        : "Conversation updated",
    });
  } catch (error: any) {
    console.error("Error saving chat history:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat-history?threadId=xxx
 * Delete a specific conversation
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "threadId is required" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const conversations = db.collection<Conversation>("chatHistory");

    const result = await conversations.deleteOne({
      userId: user._id.toString(),
      threadId,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted",
    });
  } catch (error: any) {
    console.error("Error deleting chat history:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
