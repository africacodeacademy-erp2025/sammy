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

// === Define Nodes ===

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
        content: "You are an internal posting expert.",
      },
      {
        role: "user",
        content: `You are an internal communications and posting expert. Write a concise professional Post. Context:\n${context}\nUser request:\n${prompt}`,
      },
    ],
    max_tokens: 250,
  });

  const postText = completion.choices[0].message?.content ?? "";
  console.log(postText);

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

    if (!prompt || !platform) {
      return NextResponse.json(
        { success: false, error: "Missing 'prompt' or 'platform'" },
        { status: 400 }
      );
    }

    const result = await generateApp.invoke({ prompt, platform });

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

    if (!post || !platform || !threadId) {
      return NextResponse.json(
        { success: false, error: "Missing 'post', 'platform' or 'threadId'" },
        { status: 400 }
      );
    }

    const result = await postApp.invoke({ post, platform, threadId });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
