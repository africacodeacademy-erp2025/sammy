/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";
import { twitterPosting } from "../../../../lib/platforms/twitterPosting";
import { facebookPosting } from "../../../../lib/platforms/facebookPosting";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";
import { decrypt } from "../../../../lib/crypto";
import { ObjectId } from "mongodb";

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
  isRandomPost?: boolean;
  isGreeting?: boolean;
}

function detectPlatform(
  prompt: string,
  platform?: string
): { platform: string | null; error?: string } {
  const normalized = (platform || prompt || "").toLowerCase();

  if (normalized.includes("twitter") || normalized.includes("x"))
    return { platform: "twitter" };
  if (normalized.includes("facebook")) return { platform: "facebook" };

  // Check for unsupported platforms
  const unsupportedPlatforms = [
    "instagram",
    "tiktok",
    "linkedin",
    "youtube",
    "snapchat",
    "pinterest",
  ];
  const detectedUnsupported = unsupportedPlatforms.find((p) =>
    normalized.includes(p)
  );

  if (detectedUnsupported) {
    return {
      platform: null,
      error: `I'd love to help with ${
        detectedUnsupported.charAt(0).toUpperCase() +
        detectedUnsupported.slice(1)
      } posts, but I currently only support Twitter and Facebook. Try asking me to create a Twitter or Facebook post instead! 🚀`,
    };
  }

  // No platform detected
  return {
    platform: null,
    error:
      "I couldn't detect which platform you'd like to post to. Please mention 'Twitter' or 'Facebook' in your request. For example: 'Create a Twitter post about...' or 'Write a Facebook post about...' 📱",
  };
}

function isValidISODate(dateString: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  return isoRegex.test(dateString);
}

function detectGreeting(prompt: string): boolean {
  const normalized = prompt.toLowerCase().trim();
  const greetingPatterns = [
    // Basic greetings
    /^(hi|hello|hey|good morning|good afternoon|good evening|sup|what's up|whatsup|greetings)$/,
    /^(hi|hello|hey)\s+(there|sammy|sammie|there sammy|buddy|friend)$/,
    /^(good morning|good afternoon|good evening|morning|afternoon|evening)\s+(sammy|sammie)?$/,

    // Questions about AI
    /^(how are you|how's it going|what's up|wassup|how do you do)\??$/,
    /^(who are you|what are you|what do you do|what can you do)\??$/,
    /^(are you sammy|are you sammie|are you an ai|are you a bot)\??$/,

    // Casual greetings
    /^(yo|sup|what's good|what's new|what's happening)$/,
    /^(nice to meet you|pleasure to meet you|glad to meet you)$/,

    // Thanks and appreciation
    /^(thanks|thank you|thx|appreciate it|cheers)\s*(sammy|sammie)?$/,
    /^(great|awesome|cool|nice|perfect|excellent)\s*(thanks|thank you|thx)?\s*(sammy|sammie)?$/,

    // Help requests without specifics
    /^(help|can you help|can you help me|i need help)$/,
    /^(what can you do for me|how can you help|how can you help me)\??$/,
  ];

  return greetingPatterns.some((pattern) => pattern.test(normalized));
}

async function handleGreeting(state: GraphState): Promise<Partial<GraphState>> {
  const { prompt } = state;
  const normalized = prompt.toLowerCase().trim();

  // Different responses based on greeting type
  let responses: string[] = [];

  if (
    normalized.includes("thank") ||
    normalized.includes("thx") ||
    normalized.includes("appreciate")
  ) {
    responses = [
      "You're very welcome! 😊 I'm always happy to help with your social media needs. Anything else I can create for you?",
      "My pleasure! 🌟 That's what I'm here for. Ready to craft another amazing post?",
      "Glad I could help! ✨ Feel free to ask me to create more content anytime!",
      "You're welcome! 🚀 I love helping you create engaging social media content. What's next?",
    ];
  } else if (
    normalized.includes("who are you") ||
    normalized.includes("what are you") ||
    normalized.includes("what do you do")
  ) {
    responses = [
      "I'm SaMMy! 🤖 I'm your AI social media assistant specialized in creating personalized posts for Twitter and Facebook. I analyze your Slack messages and past posts to match your unique style and voice!",
      "Hi! I'm SaMMy, your social media AI! ✨ I help you create engaging posts by learning from your communication style in Slack and your previous social media content. Pretty cool, right?",
      "I'm SaMMy! 🌟 Think of me as your personal social media writer. I study how you communicate and create posts that sound authentically like you for Twitter and Facebook!",
    ];
  } else if (
    normalized.includes("how are you") ||
    normalized.includes("how's it going")
  ) {
    responses = [
      "I'm doing great, thanks for asking! 😊 Ready to help you create some amazing social media content. How can I assist you today?",
      "Fantastic! 🌟 I'm energized and ready to craft some engaging posts for you. What would you like to share with your audience?",
      "I'm excellent! ✨ Always excited to help with social media creativity. What kind of post are you thinking about?",
    ];
  } else if (
    normalized.includes("help") ||
    normalized.includes("what can you do")
  ) {
    responses = [
      "I can help you create personalized social media posts! 🚀 Here's what I do:\n\n• Analyze your Slack messages to understand your communication style\n• Create Twitter and Facebook posts that sound like you\n• Schedule posts for specific times\n• Learn from your past posts to match your voice\n\nJust tell me what you want to post about!",
      "Great question! ✨ I'm your social media AI assistant. I can:\n\n� Write engaging posts for Twitter and Facebook\n⏰ Schedule posts for later\n🎯 Match your unique writing style using your Slack data\n📊 Learn from your posting history\n\nWhat would you like to create today?",
    ];
  } else {
    // General greetings
    responses = [
      "Hello! �👋 I'm SaMMy, your social media AI assistant. I can help you create and schedule posts for Twitter and Facebook. What would you like to post about?",
      "Hey there! 🌟 Great to see you! I'm here to help you craft amazing social media posts. Just tell me what you'd like to share and on which platform!",
      "Hi! 😊 I'm SaMMy, ready to help you create engaging content for your social media. Whether it's Twitter or Facebook, I've got you covered!",
      "Hello! ✨ I'm your friendly social media AI. I can help you write posts, schedule content, and make your social media presence shine. What can I create for you today?",
      "Hey! 🚀 Nice to meet you! I specialize in creating personalized social media posts. Just let me know what you want to share and I'll craft something perfect for your audience!",
    ];
  }

  const randomResponse =
    responses[Math.floor(Math.random() * responses.length)];

  return {
    post: randomResponse,
    success: true,
    isGreeting: true,
  };
}

async function checkGreeting(state: GraphState): Promise<Partial<GraphState>> {
  const { prompt } = state;

  if (detectGreeting(prompt)) {
    return await handleGreeting(state);
  }

  return state;
}

async function extractScheduleTime(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt } = state;
  const now = new Date().toISOString();
  const currentDate = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an advanced time-normalization assistant with enhanced temporal understanding.
Current UTC datetime: ${now}
Current local timezone: ${timezone}
Current day: ${currentDate.toLocaleDateString("en-US", { weekday: "long" })}
Current date: ${currentDate.toLocaleDateString()}

Your task is to extract and normalize time expressions from user input. Return a JSON object with key "scheduleTime".

Enhanced time understanding patterns:
- Relative times: "in 30 minutes", "in 2 hours", "tomorrow", "next week", "this afternoon"
- Specific times: "at 3pm", "at 15:30", "today at noon", "tomorrow morning"
- Day references: "Monday", "next Friday", "this weekend"
- Time periods: "morning" (9 AM), "afternoon" (2 PM), "evening" (6 PM), "night" (9 PM)
- Contextual times: "lunch time" (12 PM), "end of day" (5 PM), "business hours"
- Geographic/timezone references: "EST time", "PST", "Lesotho time", "London time"

Rules:
1. Convert all times to UTC format: YYYY-MM-DDTHH:mm:ssZ
2. If timezone is mentioned, convert accordingly
3. If no specific time given but day is mentioned, default to 12:00 PM local time
4. For relative times like "tomorrow", assume same time as now if no time specified
5. If only day mentioned (e.g., "Monday"), schedule for next occurrence at 12:00 PM
6. If no time found at all, set "scheduleTime" to null

Be intelligent about context clues and implicit time references.`,
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 100,
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

export async function generatePost(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt, userId, platform } = state;

  if (!userId) {
    console.error("Error: userId is missing from graph state.");
    return {
      success: false,
      error:
        "I couldn't identify your account. Please try logging out and back in! 👤",
    };
  }

  const db = await connectDB();
  const queryEmbedding = await getEmbedding(prompt);

  try {
    // --- 1. Retrieve context from Slack messages (RAG) ---
    const contextResults = await db
      .collection("messages")
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

    const RELEVANCE_THRESHOLD = 0.65;
    const relevantContext = contextResults
      .filter((d) => d.score >= RELEVANCE_THRESHOLD)
      .map((d) => `- ${d.text}`)
      .join("\n");

    // --- 2. Retrieve posting style examples from past_posts ---
    const styleResults = await db
      .collection("past_posts")
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 3,
            filter: { userId: { $eq: userId }, platform: { $eq: platform } },
          },
        },
        {
          $project: {
            message: 1,
            postId: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray();

    const relevantStyle = styleResults
      .filter((d) => d.score >= RELEVANCE_THRESHOLD)
      .map((d) => `- ${d.message}`)
      .join("\n");

    // --- 3. Generate post - use context/style if available, otherwise generate random post ---
    let systemMessage =
      "You are an expert at writing concise, professional social media posts.";
    let userMessage = `User request:\n${prompt}\n\n`;
    let isRandomPost = false;

    if (relevantContext || relevantStyle) {
      // User has credentials and relevant data
      systemMessage +=
        " Use the context to match the user's tone and style for the specified platform.";
      userMessage +=
        (relevantContext
          ? `Context from Slack messages:\n${relevantContext}\n\n`
          : "") +
        (relevantStyle
          ? `User's past posts for style:\n${relevantStyle}\n\n`
          : "") +
        `Write the post in a style consistent with the past posts above for platform: ${platform}.`;
    } else {
      // User lacks credentials - generate random post with helpful message
      systemMessage +=
        " Since no user data is available, create a generic but engaging post based on the request. Keep it professional and platform-appropriate.";
      userMessage += `Create a generic but engaging ${platform} post about: ${prompt}. Make it professional and suitable for the platform.`;
      isRandomPost = true;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: 250,
    });

    const post = completion.choices[0].message?.content ?? "";
    const finalPost = isRandomPost
      ? `${post}\n\n💡 Configure sources and platforms for curated posts`
      : post;

    return {
      post: finalPost,
      threadId: generateThreadId(),
      platform: platform,
      success: true,
      isRandomPost,
    };
  } catch (dbError: any) {
    console.error("Database or OpenAI error in generatePost:", dbError);
    return {
      success: false,
      error:
        "I'm having trouble generating your post right now. This might be a temporary issue with our AI service. Please try again in a moment! 🤖",
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
generateWorkflow.addNode("checkGreeting", checkGreeting);
generateWorkflow.addNode("extractScheduleTime", extractScheduleTime);
generateWorkflow.addNode("generatePost", generatePost);
generateWorkflow.addEdge(START, "checkGreeting" as any);
generateWorkflow.addConditionalEdges("checkGreeting" as any, (s) =>
  s.isGreeting ? "END" : "extractScheduleTime"
);
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

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      console.error("Unauthorized attempt: getUserFromRequest failed.");
      return NextResponse.json(
        {
          success: false,
          error:
            "It looks like your session has expired. Please log in again to continue using SaMMy! 🔐",
        },
        { status: 401 }
      );
    }
    const userId = user._id.toString();

    const { prompt, platform } = await req.json();

    // Check for greetings first - no platform needed
    if (detectGreeting(prompt)) {
      const greetingResult = await handleGreeting({
        prompt,
        platform: "",
        userId,
      });
      return NextResponse.json({
        success: true,
        greeting: true,
        message: greetingResult.post,
      });
    }

    const platformResult = detectPlatform(prompt, platform);
    if (!platformResult.platform || platformResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: platformResult.error || "Could not detect platform",
        },
        { status: 400 }
      );
    }

    const result = await generateApp.invoke({
      prompt,
      platform: platformResult.platform,
      userId,
    });

    if (result.success === false)
      return NextResponse.json(result, { status: 400 });

    const db = await connectDB();

    // Handle greeting responses
    if (result.isGreeting) {
      return NextResponse.json({
        success: true,
        greeting: true,
        message: result.post,
      });
    }

    if (result.scheduleTime) {
      const inserted = await db.collection("scheduledPosts").insertOne({
        userId,
        prompt,
        platform: platformResult.platform,
        scheduleTime: result.scheduleTime,
        status: "scheduled",
        createdAt: new Date(),
      });

      const { enqueueScheduledPost } = await import(
        "../../../../workers/schedulePostWorker"
      );
      await enqueueScheduledPost({
        _id: inserted.insertedId.toString(),
        userId,
        prompt,
        platform: platformResult.platform,
        scheduleTime: result.scheduleTime,
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
    return NextResponse.json({
      success: false,
      error:
        "Oops! Something went wrong while processing your request. Please try again, and if the problem persists, check your internet connection or try a different request. 🔄",
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req.headers.get("authorization"));
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your session has expired. Please log in again to publish your post! 🔐",
        },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    const { post, platform, threadId, isScheduled, _id } = await req.json();

    const platformResult = detectPlatform(post, platform);
    if (!platformResult.platform || platformResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: platformResult.error || "Could not detect platform",
        },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const userDoc = await db.collection("users").findOne({ _id: user._id });
    if (!userDoc) {
      return NextResponse.json(
        {
          success: false,
          error:
            "I couldn't find your account details. Please try logging out and back in, or contact support if the issue persists. 👤",
        },
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
      platform: platformResult.platform,
      threadId,
      userId,
      tokens,
      authToken: authHeader,
    });

    if (postResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: `I couldn't publish your post to ${platformResult.platform}. This could be due to platform API issues, credential problems, or connectivity issues. Please check your ${platformResult.platform} connection in settings and try again. 📱`,
        },
        { status: 500 }
      );
    }

    if (isScheduled && _id) {
      const deleteResult = await db.collection("scheduledPosts").deleteOne({
        _id: new ObjectId(_id),
      });
      console.log(`Delete attempted for ${_id}, result:`, deleteResult);
    }

    return NextResponse.json({
      success: true,
      posted: true,
      result: postResult,
    });
  } catch (err: any) {
    console.error("PUT request failed:", err);
    return NextResponse.json({
      success: false,
      error:
        "I couldn't publish your post right now. This might be due to platform connectivity issues or credential problems. Please check your platform connections in settings and try again. 📱",
    });
  }
}
