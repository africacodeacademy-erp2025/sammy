import { NextRequest, NextResponse } from "next/server";
import { saveFacebookConfig } from "../../../../../../lib/integrations/facebook";
import { connectDB } from "../../../../../../lib/mongo";
import { ObjectId } from "mongodb";

interface FacebookPost {
  id: string;
  message?: string;
  from?: any;
}

interface PastPostDocument {
  userId: string;
  postId: string;
  message: string;
  embedding: number[] | null;
  platform: string;
  createdAt: Date;
}

const POSTS_TO_FETCH = 5;
const EMBEDDING_MODEL = "text-embedding-3-small";
const FACEBOOK_API_VERSION = "v21.0";

async function pullPastFacebookPosts(userId: string): Promise<void> {
  try {
    console.log("🔄 Pulling past Facebook posts for user:", userId);

    const user = await fetchUserFromDatabase(userId);
    if (!user?.facebook?.pageId || !user?.facebook?.accessToken) {
      console.error("❌ No Facebook credentials found after OAuth");
      return;
    }

    const { decrypt } = await import("../../../../../../lib/crypto");
    const OpenAI = (await import("openai")).default;

    const decryptedToken = decrypt(user.facebook.accessToken);
    const pageId = user.facebook.pageId;

    const fbPosts = await fetchRecentFacebookPosts(pageId, decryptedToken);

    if (fbPosts.length === 0) {
      console.log("✅ No new Facebook posts to pull");
      return;
    }

    const db = await connectDB();
    const newPosts = await filterExistingPosts(db, fbPosts);

    if (newPosts.length === 0) {
      console.log("✅ No new Facebook posts to save (all already exist)");
      return;
    }

    const embeddingMap = await generateEmbeddings(newPosts, OpenAI);
    const documents = createPostDocuments(newPosts, userId, embeddingMap);

    await savePostsToDatabase(db, documents);
    console.log(
      `✅ Successfully saved ${documents.length} past Facebook posts`
    );
  } catch (err) {
    console.error("❌ Error pulling past Facebook posts:", err);
  }
}

async function fetchUserFromDatabase(userId: string) {
  const db = await connectDB();
  return db.collection("users").findOne({ _id: new ObjectId(userId) });
}

async function fetchRecentFacebookPosts(
  pageId: string,
  accessToken: string
): Promise<FacebookPost[]> {
  const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/feed`;
  const params = new URLSearchParams({
    access_token: accessToken,
    limit: POSTS_TO_FETCH.toString(),
    fields: "id,message,from",
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();

  if (!response.ok) {
    console.error("❌ Facebook API error:", data);
    return [];
  }

  return data.data || [];
}

async function filterExistingPosts(
  db: any,
  posts: FacebookPost[]
): Promise<FacebookPost[]> {
  const collection = db.collection("past_posts");
  const postIds = posts.map((p) => p.id);

  const existingIdsDocs = await collection
    .find({ postId: { $in: postIds } })
    .project({ postId: 1 })
    .toArray();

  const existingIdSet = new Set(
    existingIdsDocs.map((d: { postId: string }) => d.postId)
  );
  return posts.filter((p) => !existingIdSet.has(p.id));
}

async function generateEmbeddings(
  posts: FacebookPost[],
  OpenAI: any
): Promise<Map<string, number[]>> {
  const embeddingMap = new Map<string, number[]>();
  const postsWithMessages = posts.filter(
    (p) => p.message && p.message.trim().length > 0
  );

  if (postsWithMessages.length === 0) return embeddingMap;

  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });
  const messages = postsWithMessages.map((p) => p.message!);
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: messages,
  });

  const embeddings = response.data.map((d: any) => d.embedding);
  postsWithMessages.forEach((post, i) => {
    embeddingMap.set(post.id, embeddings[i]);
  });

  return embeddingMap;
}

function createPostDocuments(
  posts: FacebookPost[],
  userId: string,
  embeddingMap: Map<string, number[]>
): PastPostDocument[] {
  return posts.map((post) => ({
    userId,
    postId: post.id,
    message: post.message || "",
    embedding: embeddingMap.get(post.id) || null,
    platform: "facebook",
    createdAt: new Date(),
  }));
}

async function savePostsToDatabase(
  db: any,
  documents: PastPostDocument[]
): Promise<void> {
  const collection = db.collection("past_posts");
  await collection.insertMany(documents);
}

/**
 * Handles Facebook OAuth2 callback
 * GET /api/integrations/facebook/callback?code=xxx&state=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("Facebook OAuth error:", error);
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_BASE_URL
        }/?facebook_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      console.error("Missing code or state parameter");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=missing_params`
      );
    }

    // Decode state to get userId
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      userId = stateData.userId;

      if (!userId) {
        throw new Error("No userId in state");
      }
    } catch (err) {
      console.error("Invalid state parameter:", err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=invalid_state`
      );
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Missing Facebook OAuth configuration");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=config_error`
      );
    }

    // Exchange code for access token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v18.0/oauth/access_token"
    );
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Facebook token exchange failed:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token } = tokenData;

    if (!access_token) {
      console.error("No access token received from Facebook");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=no_access_token`
      );
    }

    // Get user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${access_token}`
    );

    if (!pagesResponse.ok) {
      console.error("Failed to fetch Facebook pages");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=pages_fetch_failed`
      );
    }

    const pagesData = await pagesResponse.json();
    const pages = pagesData.data || [];

    // If user has pages, get the first page's long-lived token
    let pageAccessToken = access_token;
    let pageId = "";

    if (pages.length > 0) {
      pageId = pages[0].id;
      pageAccessToken = pages[0].access_token;

      // Exchange for long-lived token
      const longLivedUrl = new URL(
        "https://graph.facebook.com/v18.0/oauth/access_token"
      );
      longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
      longLivedUrl.searchParams.set("client_id", clientId);
      longLivedUrl.searchParams.set("client_secret", clientSecret);
      longLivedUrl.searchParams.set("fb_exchange_token", pageAccessToken);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json();
        pageAccessToken = longLivedData.access_token;
      }
    }

    // Save tokens to database
    await saveFacebookConfig(userId, {
      pageId,
      accessToken: pageAccessToken,
      pages: pages.map((p: any) => ({
        id: p.id,
        name: p.name,
        accessToken: p.access_token,
      })),
    });

    console.log("Facebook OAuth successful for user:", userId);

    // Pull past posts in the background (don't await to avoid delaying redirect)
    pullPastFacebookPosts(userId).catch((err) => {
      console.error(
        "Background task failed - pulling past Facebook posts:",
        err
      );
    });

    // Redirect back to chatbot with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/chatbot?facebook_connected=true`
    );
  } catch (error) {
    console.error("Error in Facebook OAuth callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?facebook_error=callback_error`
    );
  }
}
