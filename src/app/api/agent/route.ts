/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";

// Import modular nodes
import { twitterPosting } from "../../../../lib/platforms/twitterPosting";
import { facebookPosting } from "../../../../lib/platforms/facebookPosting";
import { connectDB } from "../../../../lib/mongo";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

// Generate thread IDs for tracking posts
function generateThreadId() {
  return Math.random().toString(36).substring(2, 12);
}

// === Define State Schema ===
export interface GraphState {
  prompt: string;
  platform: string;
  post?: string;
  threadId?: string;
  result?: any;
  scheduleTime?: string | null;
  success?: boolean;
  error?: string;
}

// === Platform Detection Helper ===
function detectPlatform(prompt: string, platform?: string): string | null {
  const normalized = (platform || prompt || "").toLowerCase();

  if (normalized.includes("twitter") || normalized.includes("x")) {
    return "twitter";
  }
  if (normalized.includes("facebook")) {
    return "facebook";
  }
  if (
    normalized.includes("instagram") ||
    normalized.includes("tiktok") ||
    normalized.includes("linkedin")
  ) {
    return "unsupported";
  }
  return null;
}

// === Helper: Validate ISO string ===
function isValidISODate(dateString: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  return isoRegex.test(dateString);
}

// === Nodes ===

// Node 1: Extract schedule time from prompt
async function extractScheduleTime(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt } = state;

  const now = new Date().toISOString();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a time-normalization assistant. 
The current UTC datetime is ${now}.
Return a JSON object with key "scheduleTime".
- If the user specifies a relative time like "today" or "tomorrow", resolve it relative to the current UTC datetime.
- Output ISO 8601 UTC datetime (YYYY-MM-DDTHH:mm:ssZ).
- If no time is found, set "scheduleTime" to null.`,
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 50,
  });

  let scheduleTime: string | null = null;

  try {
    const raw = completion.choices[0].message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    if (
      parsed.scheduleTime &&
      typeof parsed.scheduleTime === "string" &&
      isValidISODate(parsed.scheduleTime)
    ) {
      scheduleTime = parsed.scheduleTime;
    }
  } catch (err) {
    console.error("Failed to parse scheduleTime:", err);
  }

  return { scheduleTime };
}

// Node 2: Generate AI post (only if posting immediately)
export async function generatePost(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt } = state;
  const db = await connectDB();
  const collection = db.collection("messages");

  const queryEmbedding = await getEmbedding(prompt);

  const vectorSearchResults = await collection
    .aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: 3,
        },
      },
      {
        $project: {
          text: 1,
          channel: 1,
          ts: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  // Set similarity threshold
  const RELEVANCE_THRESHOLD = 0.6;

  const topResult = vectorSearchResults[0];
  if (!topResult || topResult.score < RELEVANCE_THRESHOLD) {
    return {
      success: false,
      error: "Prompt is irrelevant to stored posts",
    };
  }

  const context = vectorSearchResults.map((d) => `- ${d.text}`).join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an expert at writing concise, professional social media posts. Always write as if posting directly to the specified platform.",
      },
      {
        role: "user",
        content: `Make a post for ${state.platform}.\n\nContext from database:\n${context}\n\nUser request:\n${prompt}`,
      },
    ],
    max_tokens: 250,
  });

  const postText = completion.choices[0].message?.content ?? "";

  return {
    post: postText,
    threadId: generateThreadId(),
    platform: state.platform,
    success: true,
  };
}

async function getEmbedding(text: string) {
  const embeddingResp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return embeddingResp.data[0].embedding;
}

// === Build LangGraph Workflows ===

// Workflow 1: Extract time + optionally generate draft
const generateWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
    scheduleTime: null,
    success: null,
    error: null,
  },
});

generateWorkflow.addNode("extractScheduleTime", extractScheduleTime);
generateWorkflow.addNode("generatePost", generatePost);
generateWorkflow.addEdge(START, "extractScheduleTime" as any);
generateWorkflow.addConditionalEdges("extractScheduleTime" as any, (state) =>
  state.scheduleTime ? "END" : "generatePost"
);
generateWorkflow.addEdge("generatePost" as any, END);

const generateApp = generateWorkflow.compile();

// Workflow 2: Post only (after approval)
const postWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
  },
});
postWorkflow.addNode("twitterPosting", twitterPosting as any);
postWorkflow.addNode("facebookPosting", facebookPosting as any);
postWorkflow.addConditionalEdges(START, (state) =>
  state.platform === "facebook" ? "facebookPosting" : "twitterPosting"
);
postWorkflow.addEdge("twitterPosting" as any, END);
postWorkflow.addEdge("facebookPosting" as any, END);

const postApp = postWorkflow.compile();

// === API Entry Points ===

// Step 1: Generate or schedule
export async function POST(req: NextRequest) {
  try {
    const { prompt, platform } = await req.json();

    const detectedPlatform = detectPlatform(prompt, platform);

    if (!detectedPlatform) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No supported platform detected. Please specify one (e.g., Twitter/X).",
        },
        { status: 400 }
      );
    }

    if (detectedPlatform === "unsupported") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This platform is not supported yet. Currently only Twitter/X and Facebook are supported.",
        },
        { status: 400 }
      );
    }

    const result = await generateApp.invoke({
      prompt,
      platform: detectedPlatform,
    });

    // Auto-reject irrelevant prompts
    if (result.success === false) {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    const db = await connectDB();
    const scheduledPosts = db.collection("scheduledPosts");

    if (result.scheduleTime) {
      await scheduledPosts.insertOne({
        prompt,
        platform: detectedPlatform,
        scheduleTime: result.scheduleTime,
        status: "scheduled",
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        message: `Post scheduled for ${result.scheduleTime}`,
      });
    }

    return NextResponse.json({
      success: true,
      review: {
        post: result.post,
        threadId: result.threadId,
        platform: result.platform,
        scheduleTime: null,
      },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

// Step 2: Approve & post
export async function PUT(req: NextRequest) {
  try {
    const { post, platform, threadId } = await req.json();

    const detectedPlatform = detectPlatform(post, platform);

    if (!detectedPlatform) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No supported platform detected. Please specify one (e.g., Twitter/X).",
        },
        { status: 400 }
      );
    }

    if (detectedPlatform === "unsupported") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This platform is not supported yet. Currently only Twitter/X and Facebook are supported.",
        },
        { status: 400 }
      );
    }

    const result = await postApp.invoke({
      post,
      platform: detectedPlatform,
      threadId,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
