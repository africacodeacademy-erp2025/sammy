/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../lib/auth";
import { decrypt } from "../../../../../lib/crypto";
import { connectDB } from "../../../../../lib/mongo";
import OpenAI from "openai";
import { TwitterApi } from "twitter-api-v2";

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

// fetch tweets using v2 search (Basic tier compatible)
async function fetchTweets(
  client: TwitterApi,
  username: string,
  count: number
): Promise<Tweet[]> {
  const search = await client.v2.search(`from:${username}`, {
    max_results: count,
    "tweet.fields": "id,text,created_at", // must be string
  });

  return search.data?.data || [];
}

// retry wrapper to handle 429 rate limits
async function fetchTweetsWithRetry(
  client: TwitterApi,
  username: string,
  count: number
): Promise<Tweet[]> {
  try {
    return await fetchTweets(client, username, count);
  } catch (err: any) {
    if (err.code === 429 && err.rateLimit?.reset) {
      const waitMs = err.rateLimit.reset * 1000 - Date.now();
      console.warn(`⏳ Rate limited. Retrying in ${Math.ceil(waitMs / 1000)}s`);
      await new Promise((res) => setTimeout(res, waitMs));
      return await fetchTweets(client, username, count);
    }
    throw err;
  }
}

// batch embeddings
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

    if (
      !user?.twitter?.appKey ||
      !user.twitter?.appSecret ||
      !user.twitter?.accessToken ||
      !user.twitter?.accessSecret
    ) {
      return NextResponse.json(
        { error: "Twitter not configured" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    let count = parseInt(searchParams.get("count") || "10", 10);

    // Twitter API requires max_results between 10 and 100
    if (count < 10) count = 10;
    if (count > 100) count = 100;

    // init twitter client
    const client = new TwitterApi({
      appKey: user.twitter.appKey,
      appSecret: user.twitter.appSecret,
      accessToken: decrypt(user.twitter.accessToken),
      accessSecret: decrypt(user.twitter.accessSecret),
    });

    // get current user via v2
    const { data: me } = await client.v2.me();
    const username = me.username;

    // fetch tweets with retry logic
    const tweets = await fetchTweetsWithRetry(client, username, count);

    const db = await connectDB();
    const collection = db.collection("past_posts");

    // check for duplicates
    const existingIdsDocs = await collection
      .find({ postId: { $in: tweets.map((t) => t.id) } })
      .project({ postId: 1 })
      .toArray();

    const existingIdSet = new Set(existingIdsDocs.map((d) => d.postId));
    const newTweets = tweets.filter((t) => !existingIdSet.has(t.id));

    if (newTweets.length === 0) {
      return NextResponse.json({ success: true, posts: [] });
    }

    const messages = newTweets.map((t) => t.text || "");
    const embeddings = await createEmbeddings(messages);

    const docs = newTweets.map((tweet, i) => ({
      userId: String(user._id),
      postId: tweet.id,
      message: tweet.text || "",
      embedding: embeddings[i],
      platform: "twitter",
      createdAt: new Date(tweet.created_at || Date.now()),
    }));

    const result = await collection.insertMany(docs);

    const insertedPosts = docs.map((doc, idx) => ({
      ...doc,
      _id: result.insertedIds[idx],
    }));

    return NextResponse.json({ success: true, posts: insertedPosts });
  } catch (err: any) {
    console.error("Error in Twitter GET route:", err);
    if (err.data) {
      console.error("Twitter API error details:", err.data);
    }
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
