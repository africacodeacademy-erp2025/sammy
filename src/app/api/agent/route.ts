/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";
import { twitterPosting } from "../../../../lib/platforms/twitterPosting";
import { facebookPosting } from "../../../../lib/platforms/facebookPosting";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";
import { decrypt } from "../../../../lib/crypto";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

function generateThreadId() {
  return Math.random().toString(36).substring(2, 12);
}

export interface GraphState {
  prompt: string;
  platform: string;
  post?: string;
  threadId?: string;
  result?: any;
  scheduleTime?: string | null;
  success?: boolean;
  error?: string;
  userId?: string;
  tokens?: { twitter?: string; facebook?: string };
  authToken?: string;
}

function detectPlatform(prompt: string, platform?: string): string | null {
  const normalized = (platform || prompt || "").toLowerCase();
  if (normalized.includes("twitter") || normalized.includes("x"))
    return "twitter";
  if (normalized.includes("facebook")) return "facebook";
  if (["instagram", "tiktok", "linkedin"].some((p) => normalized.includes(p))) {
    return "unsupported";
  }
  return null;
}

function isValidISODate(dateString: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  return isoRegex.test(dateString);
}

// === Nodes ===
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
    const parsed = JSON.parse(completion.choices[0].message?.content ?? "{}");
    if (parsed.scheduleTime && isValidISODate(parsed.scheduleTime)) {
      scheduleTime = parsed.scheduleTime;
    }
  } catch {}
  return { scheduleTime };
}

// Generate AI draft using user’s embeddings
export async function generatePost(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt, userId } = state;

  if (!userId) {
    console.error("Error: userId is missing from graph state.");
    return { success: false, error: "User ID is missing for vector search." };
  }

  const db = await connectDB();
  const collection = db.collection("messages");

  const queryEmbedding = await getEmbedding(prompt);

  try {
    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 3,
            filter: { userId: { $eq: userId } },
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

    const context =
      results.length > 0 ? results.map((d) => `- ${d.text}`).join("\n") : "";

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
          content: `Make a post for ${state.platform}.\n\nContext from your Slack messages:\n${context}\n\nUser request:\n${prompt}`,
        },
      ],
      max_tokens: 250,
    });

    return {
      post: completion.choices[0].message?.content ?? "",
      threadId: generateThreadId(),
      platform: state.platform,
      success: true,
    };
  } catch (dbError: any) {
    console.error("Database or OpenAI error in generatePost:", dbError);
    return {
      success: false,
      error: `Failed to generate post: ${dbError.message}`,
    };
  }
}

async function getEmbedding(text: string) {
  const embeddingResp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return embeddingResp.data[0].embedding;
}

// === Workflows ===
const generateWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
    scheduleTime: null,
    success: null,
    error: null,
    userId: null,
  },
});
generateWorkflow.addNode("extractScheduleTime", extractScheduleTime);
generateWorkflow.addNode("generatePost", generatePost);
generateWorkflow.addEdge(START, "extractScheduleTime" as any);
generateWorkflow.addConditionalEdges("extractScheduleTime" as any, (s) =>
  s.scheduleTime ? "END" : "generatePost"
);
generateWorkflow.addEdge("generatePost" as any, END);
const generateApp = generateWorkflow.compile();

const postWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
    tokens: null,
    userId: null,
    authToken: null,
  },
});
postWorkflow.addNode("twitterPosting", twitterPosting as any);
postWorkflow.addNode("facebookPosting", facebookPosting as any);
postWorkflow.addConditionalEdges(START, (s) =>
  s.platform === "facebook" ? "facebookPosting" : "twitterPosting"
);
postWorkflow.addEdge("twitterPosting" as any, END);
postWorkflow.addEdge("facebookPosting" as any, END);
const postApp = postWorkflow.compile();

// === API ===

// Step 1: Generate or schedule
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      console.error("Unauthorized attempt: getUserFromRequest failed.");
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: User not found or invalid token.",
        },
        { status: 401 }
      );
    }
    const userId = user._id.toString();

    const { prompt, platform } = await req.json();
    const detectedPlatform = detectPlatform(prompt, platform);
    if (!detectedPlatform || detectedPlatform === "unsupported") {
      return NextResponse.json(
        { success: false, error: "Unsupported platform" },
        { status: 400 }
      );
    }

    const result = await generateApp.invoke({
      prompt,
      platform: detectedPlatform,
      userId,
    });

    if (result.success === false)
      return NextResponse.json(result, { status: 400 });

    const db = await connectDB();
    if (result.scheduleTime) {
      await db.collection("scheduledPosts").insertOne({
        userId,
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
        userId,
      },
    });
  } catch (err: any) {
    console.error("POST request failed:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}

// Step 2: Approve & post
export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: User not found or invalid token.",
        },
        { status: 401 }
      );
    }

    const userId = user._id.toString();

    const { post, platform, threadId } = await req.json();
    const detectedPlatform = detectPlatform(post, platform);
    if (!detectedPlatform || detectedPlatform === "unsupported") {
      return NextResponse.json(
        { success: false, error: "Unsupported platform" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const userDoc = await db.collection("users").findOne({ _id: user._id });
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: "User not found in database" },
        { status: 404 }
      );
    }

    const tokens = {
      twitter: userDoc?.twitter
        ? {
            appKey: userDoc.twitter.appKey,
            appSecret: userDoc.twitter.appSecret,
            accessToken: decrypt(userDoc.twitter.accessToken),
            accessSecret: decrypt(userDoc.twitter.accessSecret),
          }
        : null,
      facebook: userDoc?.facebook
        ? {
            pageId: userDoc.facebook.pageId,
            accessToken: decrypt(userDoc.facebook.accessToken),
          }
        : null,
      slack: userDoc?.slack?.userToken
        ? decrypt(userDoc.slack.userToken)
        : null,
    };

    const authHeader = req.headers.get("authorization") ?? "";
    const postResult = await postApp.invoke({
      post,
      platform: detectedPlatform,
      threadId,
      userId,
      tokens,
      authToken: authHeader,
    });

    if (postResult.error) {
      return NextResponse.json(postResult, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      posted: true,
      result: postResult,
    });
  } catch (err: any) {
    console.error("PUT request failed:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
