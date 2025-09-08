/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";

// Import modular nodes
import { twitterPosting } from "../../../../lib/platforms/twitterPosting";
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
}

// === Platform Detection Helper ===
function detectPlatform(prompt: string, platform?: string): string | null {
  const normalized = (platform || prompt || "").toLowerCase();

  if (normalized.includes("twitter") || normalized.includes("x")) {
    return "twitter";
  }
  if (
    normalized.includes("facebook") ||
    normalized.includes("instagram") ||
    normalized.includes("tiktok") ||
    normalized.includes("linkedin")
  ) {
    return "unsupported";
  }
  return null; // no platform detected
}

// === Nodes ===

// Node 1: Generate AI post
async function generatePost(state: GraphState): Promise<Partial<GraphState>> {
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
        content: `Make a post for Twitter/X.\n\nContext from database:\n${context}\n\nUser request:\n${prompt}`,
      },
    ],
    max_tokens: 250,
  });

  const postText = completion.choices[0].message?.content ?? "";

  return {
    post: postText,
    threadId: generateThreadId(),
    platform: state.platform,
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

// Workflow 1: Generate only (stops at END for human review)
const generateWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
  },
});
generateWorkflow.addNode("generatePost", generatePost);
generateWorkflow.addEdge(START, "generatePost" as any);
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
postWorkflow.addEdge(START, "twitterPosting" as any);
postWorkflow.addEdge("twitterPosting" as any, END);

const postApp = postWorkflow.compile();

// === API Entry Points ===

// Step 1: Generate post → return to UI for human approval
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
            "This platform is not supported yet. Currently only Twitter/X is supported.",
        },
        { status: 400 }
      );
    }

    const result = await generateApp.invoke({ prompt, platform: "twitter" });

    // Return only the draft for review
    return NextResponse.json({ success: true, review: result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

// Step 2: Approve & post to X
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
            "This platform is not supported yet. Currently only Twitter/X is supported.",
        },
        { status: 400 }
      );
    }

    const result = await postApp.invoke({
      post,
      platform: "twitter",
      threadId,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
