import { NextRequest, NextResponse } from "next/server";
import { saveLinkedInConfig } from "../../../../../../lib/integrations/linkedin";
import { connectDB } from "../../../../../../lib/mongo";
import { ObjectId } from "mongodb";

interface LinkedInPost {
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

const POSTS_TO_FETCH = 10;
const EMBEDDING_MODEL = "text-embedding-3-small";

async function pullPastLinkedInPosts(userId: string): Promise<void> {
  try {
    console.log("🔄 Pulling past LinkedIn posts for user:", userId);

    const user = await fetchUserFromDatabase(userId);
    if (!user?.linkedin?.accessToken) {
      console.error("❌ No LinkedIn access token found after OAuth");
      return;
    }

    const { decrypt } = await import("../../../../../../lib/crypto");
    const OpenAI = (await import("openai")).default;

    const accessToken = decrypt(user.linkedin.accessToken);
    const personUrn = user.linkedin.personUrn;

    if (!personUrn) {
      console.log("⚠️ No personUrn available, skipping past posts pull");
      return;
    }

    // Fetch user's LinkedIn posts
    const posts = await fetchRecentLinkedInPosts(accessToken, personUrn);

    if (posts.length === 0) {
      console.log("✅ No new LinkedIn posts to pull");
      return;
    }

    const db = await connectDB();
    const newPosts = await filterExistingPosts(db, posts);

    if (newPosts.length === 0) {
      console.log("✅ No new LinkedIn posts to save (all already exist)");
      return;
    }

    const embeddingMap = await generateEmbeddings(newPosts, OpenAI);
    const documents = createPostDocuments(newPosts, userId, embeddingMap);

    await savePostsToDatabase(db, documents);
    console.log(
      `✅ Successfully saved ${documents.length} past LinkedIn posts`
    );
  } catch (err) {
    console.error("❌ Error pulling past LinkedIn posts:", err);
  }
}

async function fetchUserFromDatabase(userId: string) {
  const db = await connectDB();
  return db.collection("users").findOne({ _id: new ObjectId(userId) });
}

async function fetchRecentLinkedInPosts(
  accessToken: string,
  personUrn: string
): Promise<LinkedInPost[]> {
  try {
    // LinkedIn UGC Posts API - proper query format
    const encodedUrn = encodeURIComponent(personUrn);
    const response = await fetch(
      `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodedUrn})&count=${POSTS_TO_FETCH}&sortBy=LAST_MODIFIED`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LinkedIn API error:", errorText);
      // Don't fail the entire OAuth flow if we can't fetch posts
      console.log("⚠️ Skipping past posts pull due to API error");
      return [];
    }

    const data = await response.json();
    const posts: LinkedInPost[] = [];

    if (data.elements) {
      for (const element of data.elements) {
        const text =
          element.specificContent?.["com.linkedin.ugc.ShareContent"]
            ?.shareCommentary?.text || "";
        posts.push({
          id: element.id,
          text,
          created_at: element.created?.time
            ? new Date(element.created.time).toISOString()
            : undefined,
        });
      }
    }

    return posts;
  } catch (error) {
    console.error("Error fetching LinkedIn posts:", error);
    return [];
  }
}

async function filterExistingPosts(
  db: any,
  posts: LinkedInPost[]
): Promise<LinkedInPost[]> {
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
  posts: LinkedInPost[],
  OpenAI: any
): Promise<Map<string, number[]>> {
  const embeddingMap = new Map<string, number[]>();
  const postsWithText = posts.filter((p) => p.text?.trim().length > 0);

  if (postsWithText.length === 0) return embeddingMap;

  const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });
  const messages = postsWithText.map((p) => p.text);
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: messages,
  });

  const embeddings = response.data.map((d: any) => d.embedding);
  postsWithText.forEach((post, i) => {
    embeddingMap.set(post.id, embeddings[i]);
  });

  return embeddingMap;
}

function createPostDocuments(
  posts: LinkedInPost[],
  userId: string,
  embeddingMap: Map<string, number[]>
): PastPostDocument[] {
  return posts.map((post) => ({
    userId,
    postId: post.id,
    message: post.text || "",
    embedding: embeddingMap.get(post.id) || null,
    platform: "linkedin",
    createdAt: new Date(post.created_at || Date.now()),
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
 * Handles LinkedIn OAuth2 callback
 * GET /api/integrations/linkedin/callback?code=xxx&state=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("LinkedIn OAuth error:", error);
      return NextResponse.redirect(
        `${
          process.env.NEXT_PUBLIC_BASE_URL
        }/?linkedin_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      console.error("Missing code or state parameter");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=missing_params`
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

      console.log("LinkedIn callback: State decoded successfully", {
        userId: userId.substring(0, 8) + "...",
      });
    } catch (err) {
      console.error("Invalid state parameter:", err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=invalid_state`
      );
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("Missing LinkedIn OAuth configuration");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=config_error`
      );
    }

    console.log("LinkedIn callback: Exchanging code for tokens", {
      hasCode: !!code,
      redirectUri,
    });

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("LinkedIn token exchange failed:", errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      console.error("No access token received from LinkedIn");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=no_access_token`
      );
    }

    // Get user profile to obtain personUrn
    let personUrn: string | undefined;
    try {
      console.log("Fetching LinkedIn profile to get personUrn...");

      // Retry logic with timeout for network issues
      const maxRetries = 3;
      const timeout = 30000; // 30 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          console.log(
            `Attempt ${attempt}/${maxRetries} to fetch LinkedIn profile...`
          );

          const profileResponse = await fetch(
            "https://api.linkedin.com/v2/userinfo",
            {
              headers: {
                Authorization: `Bearer ${access_token}`,
                "User-Agent": "SammyApp/1.0",
              },
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log("LinkedIn profile data:", profileData);

            // LinkedIn userinfo returns 'sub' field with the person ID
            if (profileData.sub) {
              personUrn = `urn:li:person:${profileData.sub}`;
              console.log("✅ LinkedIn personUrn obtained:", personUrn);
              break; // Success - exit retry loop
            } else {
              console.error("❌ No 'sub' field in LinkedIn profile response");
              break; // No point retrying if response is missing sub field
            }
          } else {
            const errorText = await profileResponse.text();
            console.error(
              "❌ LinkedIn profile fetch failed:",
              profileResponse.status,
              errorText
            );

            // Retry on server errors (5xx) but not on client errors (4xx)
            if (profileResponse.status >= 500 && attempt < maxRetries) {
              console.log(`Server error, retrying in ${attempt * 1000}ms...`);
              await new Promise((resolve) =>
                setTimeout(resolve, attempt * 1000)
              );
              continue;
            }
            break;
          }
        } catch (fetchError: any) {
          console.error(`Attempt ${attempt} failed:`, {
            name: fetchError?.name,
            message: fetchError?.message,
            code: fetchError?.code,
            cause: fetchError?.cause,
          });

          // Check if it's a timeout/network error that we should retry
          const isRetryableError =
            fetchError?.name === "AbortError" ||
            fetchError?.code === "ETIMEDOUT" ||
            fetchError?.code === "ECONNREFUSED" ||
            fetchError?.code === "ENOTFOUND" ||
            fetchError?.code === "UND_ERR_CONNECT_TIMEOUT";

          if (isRetryableError && attempt < maxRetries) {
            console.log(`Network error, retrying in ${attempt * 1000}ms...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
            continue;
          }

          // Last attempt or non-retryable error
          if (attempt === maxRetries) {
            throw fetchError;
          }
        }
      }
    } catch (profileError) {
      console.error(
        "❌ Error fetching LinkedIn profile after all retries:",
        profileError
      );
    }

    // If personUrn is still not obtained, try alternative v2/me endpoint as fallback
    if (!personUrn) {
      console.log("⚠️ Trying fallback v2/me endpoint...");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const meResponse = await fetch("https://api.linkedin.com/v2/me", {
          headers: {
            Authorization: `Bearer ${access_token}`,
            "User-Agent": "SammyApp/1.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (meResponse.ok) {
          const meData = await meResponse.json();
          console.log("LinkedIn v2/me data:", meData);

          if (meData.id) {
            personUrn = `urn:li:person:${meData.id}`;
            console.log(
              "✅ LinkedIn personUrn obtained from v2/me:",
              personUrn
            );
          }
        } else {
          console.error("❌ v2/me fallback also failed:", meResponse.status);
        }
      } catch (fallbackError) {
        console.error("❌ v2/me fallback error:", fallbackError);
      }
    }

    // If personUrn is still not obtained, log a warning
    if (!personUrn) {
      console.warn(
        "⚠️ WARNING: Could not obtain LinkedIn personUrn. Posting will not work."
      );
    }

    // Save tokens to database
    await saveLinkedInConfig(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_in
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,
      personUrn,
    });

    console.log("LinkedIn OAuth successful for user:", userId);

    // Pull past posts in the background (don't await to avoid delaying redirect)
    pullPastLinkedInPosts(userId).catch((err) => {
      console.error(
        "Background task failed - pulling past LinkedIn posts:",
        err
      );
    });

    // Redirect back to chatbot with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/chatbot?linkedin_connected=true`
    );
  } catch (error) {
    console.error("Error in LinkedIn OAuth callback:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?linkedin_error=callback_error`
    );
  }
}
