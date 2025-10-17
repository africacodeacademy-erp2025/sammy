import { NextRequest, NextResponse } from "next/server";
import { saveTwitterConfig } from "../../../../../../lib/integrations/twitter";
import { connectDB } from "../../../../../../lib/mongo";
import { ObjectId } from "mongodb";

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
}

interface PastPostDocument {
  userId: string;
  postId: string;
  message: string;
  embedding: number[] | null;
  platform: string;
  createdAt: Date;
}

const TWEETS_TO_FETCH = 10;
const EMBEDDING_MODEL = "text-embedding-3-small";

async function pullPastTwitterPosts(userId: string): Promise<void> {
  try {
    console.log("🔄 Pulling past Twitter posts for user:", userId);

    const user = await fetchUserFromDatabase(userId);
    if (!user?.twitter?.accessToken) {
      console.error("❌ No Twitter access token found after OAuth");
      return;
    }

    const { decrypt } = await import("../../../../../../lib/crypto");
    const { TwitterApi } = await import("twitter-api-v2");
    const OpenAI = (await import("openai")).default;

    const accessToken = decrypt(user.twitter.accessToken);
    const client = new TwitterApi(accessToken);

    const username = await fetchTwitterUsername(client);
    const tweets = await fetchRecentTweets(client, username);

    if (tweets.length === 0) {
      console.log("✅ No new tweets to pull");
      return;
    }

    const db = await connectDB();
    const newTweets = await filterExistingTweets(db, tweets);

    if (newTweets.length === 0) {
      console.log("✅ No new tweets to save (all already exist)");
      return;
    }

    const embeddingMap = await generateEmbeddings(newTweets, OpenAI);
    const documents = createTweetDocuments(newTweets, userId, embeddingMap);

    await saveTweetsToDatabase(db, documents);
    console.log(`✅ Successfully saved ${documents.length} past tweets`);
  } catch (err) {
    console.error("❌ Error pulling past Twitter posts:", err);
  }
}

async function fetchUserFromDatabase(userId: string) {
  const db = await connectDB();
  return db.collection("users").findOne({ _id: new ObjectId(userId) });
}

async function fetchTwitterUsername(client: any): Promise<string> {
  const { data: me } = await client.v2.me();
  return me.username;
}

async function fetchRecentTweets(
  client: any,
  username: string
): Promise<Tweet[]> {
  const search = await client.v2.search(`from:${username}`, {
    max_results: TWEETS_TO_FETCH,
    "tweet.fields": "id,text,created_at",
  });
  return search.data?.data || [];
}

async function filterExistingTweets(
  db: any,
  tweets: Tweet[]
): Promise<Tweet[]> {
  const collection = db.collection("past_posts");
  const tweetIds = tweets.map((t) => t.id);

  const existingIdsDocs = await collection
    .find({ postId: { $in: tweetIds } })
    .project({ postId: 1 })
    .toArray();

  const existingIdSet = new Set(
    existingIdsDocs.map((d: { postId: string }) => d.postId)
  );
  return tweets.filter((t) => !existingIdSet.has(t.id));
}

async function generateEmbeddings(
  tweets: Tweet[],
  OpenAI: any
): Promise<Map<string, number[]>> {
  const embeddingMap = new Map<string, number[]>();
  const tweetsWithText = tweets.filter((t) => t.text?.trim().length > 0);

  if (tweetsWithText.length === 0) return embeddingMap;

  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });
  const messages = tweetsWithText.map((t) => t.text);
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: messages,
  });

  const embeddings = response.data.map((d: any) => d.embedding);
  tweetsWithText.forEach((tweet, i) => {
    embeddingMap.set(tweet.id, embeddings[i]);
  });

  return embeddingMap;
}

function createTweetDocuments(
  tweets: Tweet[],
  userId: string,
  embeddingMap: Map<string, number[]>
): PastPostDocument[] {
  return tweets.map((tweet) => ({
    userId,
    postId: tweet.id,
    message: tweet.text || "",
    embedding: embeddingMap.get(tweet.id) || null,
    platform: "twitter",
    createdAt: new Date(tweet.created_at || Date.now()),
  }));
}

async function saveTweetsToDatabase(
  db: any,
  documents: PastPostDocument[]
): Promise<void> {
  const collection = db.collection("past_posts");
  await collection.insertMany(documents);
}

/**
 * Handles Twitter OAuth2 callback
 * GET /api/integrations/twitter/callback?code=xxx&state=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Twitter OAuth error:", error);
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_BASE_URL
        }/?twitter_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      console.error("Missing code or state parameter");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=missing_params`
      );
    }

    // Decode state to get userId and code verifier
    let userId: string;
    let codeVerifier: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      userId = stateData.userId;
      codeVerifier = stateData.codeVerifier;

      if (!userId) {
        throw new Error("No userId in state");
      }
      if (!codeVerifier) {
        throw new Error("No codeVerifier in state");
      }

      console.log("Twitter callback: State decoded successfully", {
        userId: userId.substring(0, 8) + "...",
        hasCodeVerifier: !!codeVerifier,
      });
    } catch (err) {
      console.error("Invalid state parameter:", err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=invalid_state`
      );
    }

    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = process.env.TWITTER_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Missing Twitter OAuth configuration");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=config_error`
      );
    }

    console.log("Twitter callback: Exchanging code for tokens", {
      hasCode: !!code,
      hasCodeVerifier: !!codeVerifier,
      redirectUri,
    });

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier, // Use the proper PKCE code verifier
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Twitter token exchange failed:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      console.error("No access token received from Twitter");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=no_access_token`
      );
    }

    // Save tokens to database
    await saveTwitterConfig(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_in
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,
    });

    console.log("Twitter OAuth successful for user:", userId);

    // Pull past posts in the background (don't await to avoid delaying redirect)
    pullPastTwitterPosts(userId).catch((err) => {
      console.error("Background task failed - pulling past tweets:", err);
    });

    // Redirect back to chatbot with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/chatbot?twitter_connected=true`
    );
  } catch (error) {
    console.error("Error in Twitter OAuth callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?twitter_error=callback_error`
    );
  }
}
