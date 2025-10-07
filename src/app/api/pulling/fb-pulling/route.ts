/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";
import { connectDB } from "../../../../../lib/mongo";
import OpenAI from "openai";

interface FacebookPost {
  id: string;
  message?: string;
  from?: any;
}

async function fetchFacebookPosts(
  pageId: string,
  token: string,
  limit: number
): Promise<FacebookPost[]> {
  const url = `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const params = new URLSearchParams({
    access_token: token,
    limit: limit.toString(),
    fields: "id,message,from",
  });

  const res = await fetch(`${url}?${params}`);
  const data = await res.json();
  if (!res.ok) throw new Error("Facebook API error");
  return data.data || [];
}

// batch embedding function
async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));

    if (!user?.facebook?.pageId || !user.facebook?.accessToken) {
      return NextResponse.json(
        { error: "Facebook not configured" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const count = parseInt(searchParams.get("count") || "5");

    const decryptedToken = decrypt(user.facebook.accessToken);
    const fbPosts = await fetchFacebookPosts(
      user.facebook.pageId,
      decryptedToken,
      count
    );

    const db = await connectDB();
    const collection = db.collection("past_posts");

    // Check for duplicates based on postId
    const existingIdsDocs = await collection
      .find({ postId: { $in: fbPosts.map((p) => p.id) } })
      .project({ postId: 1 })
      .toArray();

    const existingIdSet = new Set(existingIdsDocs.map((d) => d.postId));
    const newPosts = fbPosts.filter((p) => !existingIdSet.has(p.id));

    if (newPosts.length === 0) {
      return NextResponse.json({ success: true, posts: [] });
    }

    // Filter out posts with empty messages and prepare for embeddings
    const postsWithMessages = newPosts.filter(
      (p) => p.message && p.message.trim().length > 0
    );

    if (postsWithMessages.length === 0) {
      // If no posts have messages, still save the posts but without embeddings
      const docs = newPosts.map((post) => ({
        userId: String(user._id),
        postId: post.id,
        message: post.message || "",
        embedding: null, // No embedding for empty messages
        platform: "facebook",
        createdAt: new Date(),
      }));

      const result = await collection.insertMany(docs);
      const insertedPosts = docs.map((doc, idx) => ({
        ...doc,
        _id: result.insertedIds[idx],
      }));

      return NextResponse.json({ success: true, posts: insertedPosts });
    }

    const messages = postsWithMessages.map((p) => p.message!);
    const embeddings = await createEmbeddings(messages);

    // Create a map of postId to embedding for posts with messages
    const embeddingMap = new Map();
    postsWithMessages.forEach((post, i) => {
      embeddingMap.set(post.id, embeddings[i]);
    });

    const docs = newPosts.map((post) => ({
      userId: String(user._id), // <-- ensure userId is stored as string
      postId: post.id,
      message: post.message || "",
      embedding: embeddingMap.get(post.id) || null,
      platform: "facebook",
      createdAt: new Date(),
    }));

    const result = await collection.insertMany(docs);

    const insertedPosts = docs.map((doc, idx) => ({
      ...doc,
      _id: result.insertedIds[idx],
    }));

    return NextResponse.json({ success: true, posts: insertedPosts });
  } catch (err: any) {
    console.error("Error in Facebook GET route:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
