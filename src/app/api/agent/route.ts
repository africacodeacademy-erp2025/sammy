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
// The node must take the entire state object and return a partial state update.
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

  // Access the content correctly.
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

// === Build LangGraph ===
// Instantiate the StateGraph with a `fields` object that maps keys to `null`
// and defines a `channels` object to specify how state updates are handled.
const workflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
  },
});

workflow.addNode("generatePost", generatePost);
workflow.addNode("twitterPosting", twitterPosting as any);

workflow.addEdge(START, "generatePost" as any);
workflow.addEdge("generatePost" as any, "twitterPosting" as any);
workflow.addEdge("twitterPosting" as any, END);

// Compile the graph into a runnable object
const app = workflow.compile();

// === API Entry Point ===
export async function POST(req: NextRequest) {
  try {
    const { prompt, platform } = await req.json();

    if (!prompt || !platform) {
      return NextResponse.json(
        { success: false, error: "Missing 'prompt' or 'platform'" },
        { status: 400 }
      );
    }

    // Invoke the compiled graph with the initial state
    const result = await app.invoke({ prompt, platform });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
