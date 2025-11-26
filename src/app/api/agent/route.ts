/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";
import { decrypt } from "../../../../lib/crypto";
import { ObjectId } from "mongodb";
import { getModelConfig } from "../../../../lib/modelConfig";
import {
  detectGreeting,
  handleGreeting,
} from "../../../../lib/greetingHandler";
import {
  createThread,
  addMessageToThread,
  getThreadMessages,
} from "../../../../lib/openaiThreads";
import {
  distributeToMultiplePlatforms,
  validatePlatforms,
  AVAILABLE_PLATFORMS,
} from "../../../../lib/platformDistributor";

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_API });

export interface GraphState {
  prompt: string;
  post?: string;
  threadId?: string;
  result?: any;
  scheduleTime?: string | null;
  success?: boolean;
  error?: string;
  userId?: string;
  availablePlatforms?: string[];
  isGreeting?: boolean;
  model?: string;
  maxTokens?: number;
  // For PUT endpoint only
  platforms?: string[];
  tokens?: {
    twitter?: {
      accessToken: string;
    };
    facebook?: {
      pageId: string;
      accessToken: string;
    };
    linkedin?: {
      accessToken: string;
      personUrn?: string;
    };
  };
  authToken?: string;
  attachments?: File[];
}

// Platform detection removed - users select platforms via UI after post generation

function isValidISODate(dateString: string): boolean {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  return isoRegex.test(dateString);
}

function detectRecurrence(prompt: string): {
  hasRecurrence: boolean;
  frequency: "daily" | "weekly" | "monthly" | null;
} {
  const normalized = prompt.toLowerCase().trim();

  // Days of the week - if mentioned with "every", it's daily recurrence (specific days)
  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ];

  // Check for specific day patterns (e.g., "every wednesday", "every monday")
  // These are treated as DAILY with specific day selection
  for (const day of daysOfWeek) {
    if (
      new RegExp(`\\b(every|each)\\s+${day}\\b`, "i").test(normalized) ||
      (new RegExp(`\\b${day}s?\\b`, "i").test(normalized) &&
        /\b(every|each)\b/i.test(normalized))
    ) {
      return { hasRecurrence: true, frequency: "daily" };
    }
  }

  // Check for daily patterns
  if (/\b(daily|every day|each day|everyday)\b/i.test(normalized)) {
    return { hasRecurrence: true, frequency: "daily" };
  }

  // Check for weekly patterns (general - means once a week, no specific day)
  if (/\b(weekly|every week|each week)\b/i.test(normalized)) {
    return { hasRecurrence: true, frequency: "weekly" };
  }

  // Check for monthly patterns
  if (/\b(monthly|every month|each month)\b/i.test(normalized)) {
    return { hasRecurrence: true, frequency: "monthly" };
  }

  return { hasRecurrence: false, frequency: null };
}

function detectSpecificDays(prompt: string): number[] {
  const normalized = prompt.toLowerCase().trim();
  const detectedDays: number[] = [];

  // Map day names to day numbers (0 = Sunday, 1 = Monday, etc.)
  const dayMap: { [key: string]: number } = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };

  // Check for each day in the prompt
  for (const [dayName, dayNumber] of Object.entries(dayMap)) {
    if (new RegExp(`\\b${dayName}\\b`, "i").test(normalized)) {
      if (!detectedDays.includes(dayNumber)) {
        detectedDays.push(dayNumber);
      }
    }
  }

  return detectedDays.sort();
}

async function checkGreeting(state: GraphState): Promise<Partial<GraphState>> {
  const { prompt } = state;

  if (detectGreeting(prompt)) {
    const result = handleGreeting({ prompt, platform: "" });
    return {
      post: result.post,
      success: result.success,
      isGreeting: result.isGreeting,
    };
  }

  return state;
}

async function extractRecurrenceTime(
  state: GraphState
): Promise<Partial<GraphState>> {
  const { prompt } = state;
  const now = new Date().toISOString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a time extraction assistant for recurring scheduled posts.
Current UTC datetime: ${now}
Current local timezone: ${timezone}

Your task is to extract the time from the user's prompt for recurring posts. Return a JSON object with:
{
  "time": "HH:mm" (24-hour format, e.g., "14:30" for 2:30 PM),
  "timestamp": ISO 8601 timestamp (YYYY-MM-DDTHH:mm:ssZ) for the next occurrence
}

Time understanding patterns:
- Specific times: "at 3pm" → "15:00", "at 9am" → "09:00", "at 2:30pm" → "14:30"
- Period times: "morning" → "09:00", "afternoon" → "14:00", "evening" → "18:00", "night" → "21:00"
- Contextual: "lunch time" → "12:00", "end of day" → "17:00"

Rules:
1. Extract time and convert to 24-hour format (HH:mm)
2. Generate timestamp for the next occurrence of that time in UTC
3. If no specific time is mentioned, default to "12:00" (noon)
4. Always return both "time" and "timestamp" fields`,
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 150,
  });

  try {
    const parsed = JSON.parse(completion.choices[0].message?.content ?? "{}");
    if (parsed.time && parsed.timestamp && isValidISODate(parsed.timestamp)) {
      return {
        scheduleTime: parsed.timestamp,
        ...state,
        result: {
          ...state.result,
          recurrenceTime: parsed.time,
        },
      };
    }
  } catch (error) {
    console.error("Error parsing recurrence time:", error);
  }

  // Fallback to default noon time
  const fallbackDate = new Date();
  fallbackDate.setHours(12, 0, 0, 0);
  return {
    scheduleTime: fallbackDate.toISOString(),
    ...state,
    result: {
      ...state.result,
      recurrenceTime: "12:00",
    },
  };
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
  const { prompt, userId, model, maxTokens } = state;

  if (!userId) {
    console.error("Error: userId is missing from graph state.");
    return {
      success: false,
      error:
        "I couldn't identify your account. Please try logging out and back in! 👤",
    };
  }

  // Use model and maxTokens from state, with fallbacks
  const selectedModel = model || "gpt-4o-mini";
  const selectedMaxTokens = maxTokens || 250;

  console.log(
    `🤖 Generating platform-agnostic post | Model: ${selectedModel} | Max tokens: ${selectedMaxTokens}`
  );

  let db;
  let queryEmbedding;

  try {
    db = await connectDB();
  } catch (dbErr) {
    console.error("Failed to connect to database:", dbErr);
    return {
      success: false,
      error: "Database connection failed. Please try again.",
    };
  }

  try {
    queryEmbedding = await getEmbedding(prompt);
  } catch (embErr) {
    console.error("Failed to generate embedding:", embErr);
    // Continue without embedding - we'll skip vector search
    queryEmbedding = null;
  }

  // --- Load conversation history from OpenAI Threads if threadId exists ---
  let conversationMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];

  if (state.threadId) {
    try {
      const threadMessages = await getThreadMessages(state.threadId, 10);

      conversationMessages = threadMessages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      })) as Array<{ role: "system" | "user" | "assistant"; content: string }>;

      console.log(
        `📜 Loaded ${conversationMessages.length} messages from OpenAI thread ${state.threadId}`
      );
    } catch (err) {
      console.error("Error loading OpenAI thread messages:", err);
      // If thread doesn't exist, continue without context
    }
  }

  try {
    // --- Retrieve context from Slack messages (RAG) ---
    let relevantContext = "";
    let relevantStyle = "";

    // Only do vector search if we have an embedding
    if (queryEmbedding) {
      try {
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
        relevantContext = contextResults
          .filter((d: any) => d.score >= RELEVANCE_THRESHOLD)
          .map((d: any) => `- ${d.text}`)
          .join("\n");
      } catch (vectorErr) {
        console.warn(
          "Vector search for messages failed, continuing without context:",
          vectorErr
        );
      }

      // --- Retrieve posting style examples from past_posts (platform-agnostic) ---
      try {
        const styleResults = await db
          .collection("past_posts")
          .aggregate([
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 5, // Get more examples since we're not filtering by platform
                filter: { userId: { $eq: userId } },
              },
            },
            {
              $project: {
                message: 1,
                platform: 1,
                postId: 1,
                score: { $meta: "vectorSearchScore" },
              },
            },
          ])
          .toArray();

        const RELEVANCE_THRESHOLD_STYLE = 0.65;
        relevantStyle = styleResults
          .filter((d: any) => d.score >= RELEVANCE_THRESHOLD_STYLE)
          .map((d: any) => `- [${d.platform}] ${d.message}`)
          .join("\n");
      } catch (styleErr) {
        console.warn(
          "Vector search for past_posts failed, continuing without style:",
          styleErr
        );
      }
    } // End of if (queryEmbedding)

    // --- Generate platform-agnostic post ---
    let systemMessage = `You are an expert at writing engaging social media posts suitable for multiple platforms (Twitter, Facebook, LinkedIn).

CRITICAL OUTPUT RULES:
- Output ONLY the final post text - NO preambles, explanations, or meta-commentary
- DO NOT include phrases like "Here's a post:", "Sure, I can help:", "Here you go:", etc.
- DO NOT add quotation marks around the post
- Start directly with the post content itself
- The output should be ready to publish immediately without any editing

CONVERSATION CONTEXT:
- You have access to the conversation history
- When users reference "the previous post", "that post", "it", etc., they mean the last post you generated
- Apply their requested changes/improvements to that specific post
- Maintain continuity and context from previous messages

PLATFORM CONSIDERATIONS:
- Keep the post concise (aim for 250 characters or less for maximum compatibility)
- Twitter has a 280-character limit, so brevity is key
- Use 1-3 relevant hashtags maximum
- Write in a clear, engaging, and professional tone
- Ensure content is appropriate for a business/professional audience
- Make it versatile enough to work across Twitter, Facebook, and LinkedIn

STYLE GUIDELINES:
- Be authentic and conversational
- Use natural language that doesn't sound robotic
- Avoid excessive punctuation, spam-like language, or promotional tone
- Focus on value, insights, or engagement rather than hard sells`;

    let userMessage = `User request:\n${prompt}\n\n`;

    if (relevantContext || relevantStyle) {
      // User has credentials and relevant data
      systemMessage +=
        "\n\nUse the provided context to match the user's tone and style while keeping the post versatile for multiple platforms.";
      userMessage +=
        (relevantContext
          ? `Context from user's Slack messages:\n${relevantContext}\n\n`
          : "") +
        (relevantStyle
          ? `User's past social media posts for style reference:\n${relevantStyle}\n\n`
          : "") +
        `Create a social media post that matches the user's communication style from the examples above.`;
    } else {
      // User lacks credentials - generate professional post
      systemMessage +=
        "\n\nSince no user data is available, create a professional and engaging post suitable for all platforms.";
      userMessage += `Create a professional and engaging social media post about: "${prompt}".`;
    }

    // Build messages array with conversation context
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: systemMessage,
      },
      // Include conversation history from OpenAI Threads
      ...conversationMessages,
      // Add current user message
      {
        role: "user",
        content: userMessage,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages,
      max_tokens: selectedMaxTokens,
    });

    let rawPost = completion.choices[0].message?.content ?? "";

    // Clean up any preambles or meta-commentary
    rawPost = rawPost
      .replace(
        /^(here's|here is|sure,?|of course,?|absolutely,?|certainly,?)[\s\S]*?:/i,
        ""
      )
      .replace(/^(i can help|i'll|i will|let me)[\s\S]*?:/i, "")
      .replace(/^["']|["']$/g, "")
      .trim();

    // Basic length check for Twitter compatibility
    if (rawPost.length > 280) {
      console.warn(
        `⚠️ Generated post exceeds Twitter limit (${rawPost.length} chars). This is acceptable - user can edit if needed.`
      );
    }

    // Save to OpenAI Thread if threadId exists
    if (state.threadId) {
      try {
        await addMessageToThread(state.threadId, "user", prompt);
        await addMessageToThread(state.threadId, "assistant", rawPost);
        console.log(`💾 Saved conversation to OpenAI thread ${state.threadId}`);
      } catch (err) {
        console.error("Error saving to OpenAI thread:", err);
      }
    }

    return {
      post: rawPost,
      success: true,
      availablePlatforms: [...AVAILABLE_PLATFORMS],
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

// Simplified workflow - no platform routing
const generateWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    post: null,
    threadId: null,
    scheduleTime: null,
    success: null,
    error: null,
    userId: null,
    model: null,
    maxTokens: null,
    availablePlatforms: null,
    isGreeting: null,
  },
});

generateWorkflow.addNode("checkGreeting", checkGreeting);
generateWorkflow.addNode("extractScheduleTime", extractScheduleTime);
generateWorkflow.addNode("generatePost", generatePost);
generateWorkflow.addEdge(START, "checkGreeting" as any);
generateWorkflow.addConditionalEdges("checkGreeting" as any, (s: GraphState) =>
  s.isGreeting ? "END" : "extractScheduleTime"
);
generateWorkflow.addConditionalEdges(
  "extractScheduleTime" as any,
  (s: GraphState) => (s.scheduleTime ? "END" : "generatePost")
);
generateWorkflow.addEdge("generatePost" as any, END);
const generateApp = generateWorkflow.compile();

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

    // Fetch user's plan to determine model configuration
    const db = await connectDB();
    const userDoc = await db.collection("users").findOne({ _id: user._id });
    const planId = userDoc?.planId || 1;
    const modelConfig = getModelConfig(planId);

    console.log(
      `👤 User ${userId} | Plan ${planId} | Model: ${modelConfig.model} | Max Tokens: ${modelConfig.maxTokens}`
    );

    const body = await req.json();
    let prompt = body.prompt;
    let threadId = body.threadId;

    // Validate threadId is a real OpenAI thread (they are typically 30+ chars)
    const isValidOpenAIThread =
      threadId && threadId.startsWith("thread_") && threadId.length > 30;

    // Create OpenAI thread early if needed (for greetings and all other flows)
    if (!isValidOpenAIThread) {
      try {
        threadId = await createThread();
        console.log(`🆕 Created new OpenAI thread: ${threadId}`);
      } catch (err) {
        console.error("Failed to create OpenAI thread:", err);
        threadId = null;
      }
    }

    // Check which platforms the user has connected with valid credentials (moved early for reuse)
    const connectedPlatforms: string[] = [];

    // Helper to check if a string value is valid (not null, undefined, or empty)
    const isValidToken = (token: unknown): boolean => {
      return typeof token === "string" && token.length > 0;
    };

    // Twitter: check for valid accessToken
    if (isValidToken(userDoc?.twitter?.accessToken)) {
      connectedPlatforms.push("twitter");
    }

    // Facebook: check for valid accessToken AND pageId (both required for posting)
    if (
      isValidToken(userDoc?.facebook?.accessToken) &&
      isValidToken(userDoc?.facebook?.pageId)
    ) {
      connectedPlatforms.push("facebook");
    }

    // LinkedIn: check for valid accessToken
    if (isValidToken(userDoc?.linkedin?.accessToken)) {
      connectedPlatforms.push("linkedin");
    }

    console.log(
      `📱 Connected platforms for user ${userId}:`,
      connectedPlatforms
    );

    // Check for greetings first
    if (detectGreeting(prompt)) {
      const greetingResult = await handleGreeting({
        prompt,
        platform: "",
        userId,
      });

      // Save greeting to OpenAI thread for conversation continuity
      if (threadId) {
        try {
          await addMessageToThread(threadId, "user", prompt);
          await addMessageToThread(threadId, "assistant", greetingResult.post);
          console.log(`💾 Saved greeting to OpenAI thread ${threadId}`);
        } catch (err) {
          console.error("Error saving greeting to OpenAI thread:", err);
        }
      }

      return NextResponse.json({
        success: true,
        greeting: true,
        message: greetingResult.post,
        threadId, // Return threadId for conversation continuity
      });
    }

    // Check for recurrence in the prompt
    const recurrenceResult = detectRecurrence(prompt);

    // If recurrence is detected, extract the time and return data for RecurrenceModal
    if (recurrenceResult.hasRecurrence && recurrenceResult.frequency) {
      const timeResult = await extractRecurrenceTime({
        prompt,
        userId,
      });

      // Detect specific days mentioned in the prompt
      const detectedDays = detectSpecificDays(prompt);

      return NextResponse.json({
        success: true,
        recurrence: true,
        recurrenceData: {
          frequency: recurrenceResult.frequency,
          time: timeResult.result?.recurrenceTime || "12:00",
          timestamp: timeResult.scheduleTime,
          prompt,
          detectedDays: detectedDays.length > 0 ? detectedDays : undefined,
          availablePlatforms: connectedPlatforms, // Include connected platforms for selection
        },
      });
    }

    // Thread is already created/validated above, proceed with generation

    // Generate post using workflow
    const result = await generateApp.invoke({
      prompt,
      userId,
      threadId,
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens,
    });

    if (result.success === false) {
      return NextResponse.json(result, { status: 400 });
    }

    // Handle greeting responses
    if (result.isGreeting) {
      return NextResponse.json({
        success: true,
        greeting: true,
        message: result.post,
      });
    }

    // Handle scheduled posts
    if (result.scheduleTime && typeof result.scheduleTime === "string") {
      const inserted = await db.collection("scheduledPosts").insertOne({
        userId,
        prompt,
        scheduleTime: result.scheduleTime,
        status: "scheduled",
        isScheduled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Schedule with Agenda
      const { schedulePost } = await import(
        "../../../../workers/schedulePostWorker"
      );

      const scheduleDate = new Date(result.scheduleTime);
      const jobId = await schedulePost(
        inserted.insertedId.toString(),
        scheduleDate
      );

      await db
        .collection("scheduledPosts")
        .updateOne({ _id: inserted.insertedId }, { $set: { jobId } });

      const scheduledDate = new Date(result.scheduleTime);
      const localTimeString = scheduledDate.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        message: `Post scheduled for ${localTimeString}. It will be generated and ready for review at the scheduled time.`,
        scheduleTime: result.scheduleTime,
        scheduleTimeLocal: localTimeString,
        threadId, // Return threadId for conversation continuity
      });
    }

    const hasAnyCredentials = connectedPlatforms.length > 0;

    // Return post for review with platform selection
    return NextResponse.json({
      success: true,
      review: {
        post: result.post,
        threadId: threadId || result.threadId,
        availablePlatforms: connectedPlatforms, // Only show platforms user has connected
        userId,
        hasCredentials: hasAnyCredentials,
      },
    });
  } catch (err: any) {
    console.error("POST request failed:", err);
    return NextResponse.json({
      success: false,
      error:
        "Oops! Something went wrong while processing your request. Please try again! 🔄",
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

    // Check Content-Type to determine if we're receiving FormData or JSON
    const contentType = req.headers.get("content-type") || "";
    let post: string;
    let platforms: string[];
    let threadId: string;
    let isScheduled: boolean;
    let _id: string | null;
    let attachments: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      post = formData.get("post") as string;
      const platformsStr = formData.get("platforms") as string;
      platforms = JSON.parse(platformsStr || "[]");
      threadId = formData.get("threadId") as string;
      isScheduled = formData.get("isScheduled") === "true";
      _id = formData.get("_id") as string | null;
      attachments = formData.getAll("attachments") as File[];
    } else {
      const body = await req.json();
      post = body.post;
      // Support both platforms array and legacy platform string
      platforms = body.platforms || (body.platform ? [body.platform] : []);
      threadId = body.threadId;
      isScheduled = body.isScheduled || false;
      _id = body._id || null;
      attachments = [];
    }

    // Validate platforms
    const validation = validatePlatforms(platforms);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
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
            "I couldn't find your account details. Please try logging out and back in! 👤",
        },
        { status: 404 }
      );
    }

    // Build tokens object
    const tokens = {
      twitter: userDoc?.twitter?.accessToken
        ? {
            accessToken: decrypt(userDoc.twitter.accessToken),
          }
        : undefined,
      facebook: userDoc?.facebook
        ? {
            pageId: userDoc.facebook.pageId,
            accessToken: decrypt(userDoc.facebook.accessToken),
          }
        : undefined,
      linkedin: userDoc?.linkedin?.accessToken
        ? {
            accessToken: decrypt(userDoc.linkedin.accessToken),
            personUrn: userDoc.linkedin.personUrn,
          }
        : undefined,
    };

    const authHeader = req.headers.get("authorization") ?? "";

    // Distribute to multiple platforms in parallel
    const results = await distributeToMultiplePlatforms({
      post,
      platforms,
      tokens,
      userId,
      authToken: authHeader,
      attachments,
    });

    // Check if any posting failed
    const failures = results.filter((r) => !r.success);
    const successes = results.filter((r) => r.success);

    if (failures.length > 0 && successes.length === 0) {
      // All failed
      return NextResponse.json(
        {
          success: false,
          error: `Failed to post to all platforms: ${failures
            .map((f) => `${f.platform}: ${f.error}`)
            .join(", ")}`,
          results,
        },
        { status: 500 }
      );
    }

    // Delete scheduled post after successful posting
    if (isScheduled && _id) {
      try {
        const scheduledPost = await db.collection("scheduledPosts").findOne({
          _id: new ObjectId(_id),
          userId,
        });

        if (scheduledPost) {
          if (scheduledPost.jobId) {
            try {
              const { cancelScheduledPost } = await import(
                "../../../../workers/schedulePostWorker"
              );
              await cancelScheduledPost(scheduledPost.jobId);
              console.log(`✅ Cancelled Agenda job ${scheduledPost.jobId}`);
            } catch (err) {
              console.error("Failed to cancel Agenda job:", err);
            }
          }

          await db.collection("scheduledPosts").deleteOne({
            _id: new ObjectId(_id),
            userId,
          });
          console.log(`✅ Deleted scheduled post ${_id}`);
        }
      } catch (deleteErr) {
        console.error(`❌ Error deleting scheduled post:`, deleteErr);
      }
    }

    // Return results
    if (failures.length > 0) {
      // Partial success
      return NextResponse.json({
        success: true,
        posted: true,
        partial: true,
        message: `Posted to ${successes.length}/${platforms.length} platform(s). Some platforms failed.`,
        results,
      });
    }

    // Complete success
    return NextResponse.json({
      success: true,
      posted: true,
      message: `Successfully posted to ${successes.length} platform(s)!`,
      results,
    });
  } catch (err: any) {
    console.error("PUT request failed:", err);
    return NextResponse.json({
      success: false,
      error:
        "I couldn't publish your post right now. Please check your platform connections and try again. 📱",
    });
  }
}
