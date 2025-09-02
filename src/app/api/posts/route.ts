// app/api/generate-post/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import OpenAI from "openai";
import { Graph } from "@langchain/langgraph";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

function generateThreadId() {
  return Math.random().toString(36).substring(2, 12);
}

export async function GET(req: NextRequest) {
  try {
    const prompt = req.nextUrl.searchParams.get("prompt");
    if (!prompt)
      return NextResponse.json({ success: false, error: "Missing prompt" });

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

    // Create the graph
    const graph = new Graph();

    // Run the graph nodes inline
    const input = prompt;
    const context = (() => {
      const contextText = vectorSearchResults
        .map((d) => `- ${d.text}`)
        .join("\n");
      return `You are an internal communications and posting expert agent. Write a concise professional Post. Context:\n${contextText}\nUser request:\n${input}`;
    })();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an internal posting expert.",
        },
        { role: "user", content: context },
      ],
      max_tokens: 250,
    });

    const postText = completion.choices[0].message?.content ?? "";
    const threadId = generateThreadId();

    return NextResponse.json({
      success: true,
      post: postText,
      thread_id: threadId,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

async function getEmbedding(text: string) {
  const embeddingResp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return embeddingResp.data[0].embedding;
}
