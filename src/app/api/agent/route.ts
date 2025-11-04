/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { StateGraph, END, START } from "@langchain/langgraph";
import OpenAI from "openai";
import { twitterPosting } from "../../../../lib/platforms/twitterPosting";
import { facebookPosting } from "../../../../lib/platforms/facebookPosting";
import { linkedinPosting } from "../../../../lib/platforms/linkedinPosting";
import { connectDB } from "../../../../lib/mongo";
import { getUserFromRequest } from "../../../../lib/auth";
import { decrypt } from "../../../../lib/crypto";
import { ObjectId } from "mongodb";
import {
  buildSmartContext,
  shouldUseRAG,
} from "../../../../lib/contextManager";
import { getModelConfig } from "../../../../lib/modelConfig";
import {
  detectGreeting,
  handleGreeting,
} from "../../../../lib/greetingHandler";
import {
  sanitizeForTwitter,
  sanitizeForFacebook,
  sanitizeForPlatform,
  validateContent,
  getPlatformSpecificGuidelines,
} from "../../../../lib/contentSanitizer";

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
  isRandomPost?: boolean;
  isGreeting?: boolean;
  attachments?: File[];
  model?: string;
  maxTokens?: number;
}

function detectPlatform(
  prompt: string,
  platform?: string
): { platform: string | null; error?: string } {
  const normalized = (platform || prompt || "").toLowerCase();

  if (normalized.includes("twitter") || normalized.includes("x"))
    return { platform: "twitter" };
  if (normalized.includes("facebook")) return { platform: "facebook" };
  if (normalized.includes("linkedin")) return { platform: "linkedin" };

  // Check for unsupported platforms
  const unsupportedPlatforms = [
    "instagram",
    "tiktok",
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
      } posts, but I currently only support Twitter, Facebook, and LinkedIn. Try asking me to create a post for one of these platforms instead! 🚀`,
    };
  }

  // No platform detected
  return {
    platform: null,
    error:
      "I couldn't detect which platform you'd like to post to. Please mention 'Twitter', 'Facebook', or 'LinkedIn' in your request. For example: 'Create a LinkedIn post about...' 📱",
  };
}

/**
 * Heuristic to determine if the prompt contains a topic beyond just mentioning the platform.
 * Returns true if there appears to be a substantive topic in the prompt.
 */
function hasTopic(prompt: string, platform: string): boolean {
  if (!prompt) return false;
  const normalized = prompt.toLowerCase();
  // Remove the platform token and common verbs/stopwords that indicate an instruction only
  let cleaned = normalized.replace(new RegExp(`\\b${platform}\\b`, "gi"), "");
  cleaned = cleaned.replace(
    /\b(post|create|write|tweet|compose|publish|please|for|me|about|on|to|a|the|in)\b/gi,
    ""
  );
  // Remove punctuation and extra whitespace
  cleaned = cleaned.replace(/[^\w\s]/g, "").trim();
  // Consider it a topic if we have more than a couple characters (word length > 2)
  return cleaned.length > 2;
}

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
    const result = handleGreeting({ prompt, platform: state.platform });
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
  const currentDate = new Date();
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
        // Store the time separately for the recurrence modal
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
  const { prompt, userId, platform, model, maxTokens } = state;

  if (!userId) {
    console.error("Error: userId is missing from graph state.");
    return {
      success: false,
      error:
        "I couldn't identify your account. Please try logging out and back in! 👤",
    };
  }

  // Use model and maxTokens from state, with fallbacks to default (Pro plan values)
  const selectedModel = model || "gpt-4o-mini";
  const selectedMaxTokens = maxTokens || 250;

  console.log(
    `🤖 Using model: ${selectedModel} with max tokens: ${selectedMaxTokens}`
  );

  const db = await connectDB();
  const queryEmbedding = await getEmbedding(prompt);

  // --- NEW: Load conversation history if threadId exists ---
  let conversationContext: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  if (state.threadId) {
    try {
      const conversation = await db.collection("chatHistory").findOne({
        userId,
        threadId: state.threadId,
      });

      if (conversation && conversation.messages) {
        // Build smart context using hybrid approach
        const useRAG = shouldUseRAG(conversation.messages);
        conversationContext = await buildSmartContext(
          conversation.messages,
          prompt,
          {
            maxRecentMessages: 6, // Last 3 exchanges
            maxTotalTokens: 2000,
            useRAG,
            ragTopK: 2,
          }
        );

        console.log(
          `📚 Loaded ${conversationContext.length} context messages (RAG: ${useRAG})`
        );
      }
    } catch (err) {
      console.error("Error loading conversation context:", err);
      // Continue without context if loading fails
    }
  }

  // Additionally, include the raw recent conversation messages (user/assistant)
  // to ensure the LLM sees the most recent dialog and understands user edits,
  // clarifications, and follow-ups. This complements the RAG/smart context above.
  let recentConversationMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];
  try {
    if (state.threadId) {
      const conv = await db.collection("chatHistory").findOne({
        userId,
        threadId: state.threadId,
      });
      if (conv && Array.isArray(conv.messages) && conv.messages.length > 0) {
        // Take the last N raw exchanges (default 10) and map to LLM roles
        const N = 10;
        const raw = conv.messages.slice(-N);
        recentConversationMessages = raw
          .filter((m: any) => m && m.content)
          .map((m: any) => ({
            role: m.sender === "ai" ? "assistant" : "user",
            content: String(m.content),
          }));
      }
    }
  } catch (err) {
    // Non-fatal: log and continue
    console.error("Error loading recent conversation messages:", err);
  }

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
    const platformGuidelines = getPlatformSpecificGuidelines(platform);
    let systemMessage = `You are an expert at writing engaging, platform-optimized social media posts. ${platformGuidelines}
    
CRITICAL OUTPUT RULES:
- Output ONLY the final post text - NO preambles, explanations, or meta-commentary
- DO NOT include phrases like "Here's a post:", "Sure, I can help:", "Here you go:", etc.
- DO NOT add quotation marks around the post
- Start directly with the post content itself
- The output should be ready to publish immediately without any editing

IMPORTANT: Follow these platform-specific rules strictly:
- For Twitter: Maximum 280 characters, use 1-2 hashtags, be concise and punchy
- For Facebook: Optimal 40-80 characters for high engagement, can be longer for storytelling, use 3-5 hashtags maximum
- Always ensure the content is appropriate, professional, and engaging
- Avoid inappropriate content, spam-like language, or excessive promotional tone
- Use natural language that sounds authentic to the platform`;

    let userMessage = `User request:\n${prompt}\n\n`;
    let isRandomPost = false;

    if (relevantContext || relevantStyle) {
      // User has credentials and relevant data
      systemMessage +=
        " Use the provided context to match the user's tone and style while following platform guidelines.";
      userMessage +=
        (relevantContext
          ? `Context from user's Slack messages:\n${relevantContext}\n\n`
          : "") +
        (relevantStyle
          ? `User's past ${platform} posts for style reference:\n${relevantStyle}\n\n`
          : "") +
        `Create a ${platform} post that matches the user's communication style from the examples above while following ${platform} best practices.`;
    } else {
      // User lacks credentials - generate random post with helpful message
      systemMessage +=
        " Since no user data is available, create a generic but engaging post following platform best practices.";
      userMessage += `Create a professional and engaging ${platform} post about: "${prompt}". Follow ${platform} formatting guidelines and character limits.`;
      isRandomPost = true;
    }

    // Build messages array with conversation context + recent raw messages
    // We include: system message -> RAG/smart context -> recent raw messages -> current user message
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: systemMessage,
      },
      // Include RAG / smart context (condensed, relevant snippets)
      ...conversationContext,
      // Include the most recent raw conversation messages so the LLM sees the exact recent dialog
      ...recentConversationMessages,
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

    // Clean up any preambles or meta-commentary the LLM might have added
    rawPost = rawPost
      .replace(
        /^(here's|here is|sure,?|of course,?|absolutely,?|certainly,?)[\s\S]*?:/i,
        ""
      )
      .replace(/^(i can help|i'll|i will|let me)[\s\S]*?:/i, "")
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes
      .trim();

    // Validate content before processing
    const validation = validateContent(rawPost);
    if (!validation.isValid) {
      console.warn("Generated content failed validation:", validation.reason);
      // Regenerate with stricter guidelines if content is problematic
      const sanitizedCompletion = await openai.chat.completions.create({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content:
              systemMessage +
              "\n\nIMPORTANT: The content must be professional, appropriate, and free from spam-like language, excessive punctuation, or inappropriate content. Output ONLY the post text without any preamble.",
          },
          {
            role: "user",
            content:
              userMessage +
              "\n\nPlease ensure the content is clean, professional, and appropriate for a business audience. Output only the post itself.",
          },
        ],
        max_tokens: selectedMaxTokens,
      });
      let cleanPost =
        sanitizedCompletion.choices[0].message?.content ?? rawPost;

      // Clean up any preambles
      cleanPost = cleanPost
        .replace(
          /^(here's|here is|sure,?|of course,?|absolutely,?|certainly,?)[\s\S]*?:/i,
          ""
        )
        .replace(/^(i can help|i'll|i will|let me)[\s\S]*?:/i, "")
        .replace(/^["']|["']$/g, "")
        .trim();

      // Apply platform-specific sanitization
      let sanitizedPost = sanitizeForPlatform(cleanPost, platform);

      // If still failing validation after regeneration, use fallback
      const finalValidation = validateContent(sanitizedPost);
      if (!finalValidation.isValid) {
        sanitizedPost = `Here's a curated post for your ${platform} audience. Configure your sources and platforms for better content generation.`;
      }

      return {
        post: sanitizedPost,
        threadId: generateThreadId(),
        platform: platform,
        success: true,
        isRandomPost,
      };
    }

    // Apply platform-specific sanitization
    const sanitizedPost = sanitizeForPlatform(rawPost, platform);

    return {
      post: sanitizedPost,
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
    model: null,
    maxTokens: null,
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

const postWorkflow = new StateGraph<GraphState>({
  channels: {
    prompt: null,
    platform: null,
    post: null,
    threadId: null,
    tokens: null,
    userId: null,
    authToken: null,
    success: null,
    error: null,
    result: null,
    attachments: null,
  },
});
postWorkflow.addNode("twitterPosting", twitterPosting as any);
postWorkflow.addNode("facebookPosting", facebookPosting as any);
postWorkflow.addNode("linkedinPosting", linkedinPosting as any);
postWorkflow.addConditionalEdges(START, (s: GraphState) =>
  s.platform === "facebook"
    ? "facebookPosting"
    : s.platform === "linkedin"
    ? "linkedinPosting"
    : "twitterPosting"
);
postWorkflow.addEdge("twitterPosting" as any, END);
postWorkflow.addEdge("facebookPosting" as any, END);
postWorkflow.addEdge("linkedinPosting" as any, END);
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

    // Fetch user's plan to determine model configuration
    const db = await connectDB();
    const userDoc = await db.collection("users").findOne({ _id: user._id });
    const planId = userDoc?.planId || 1; // Default to Basic plan if no planId
    const modelConfig = getModelConfig(planId);

    console.log(
      `👤 User ${userId} | Plan ${planId} | Model: ${modelConfig.model} | Max Tokens: ${modelConfig.maxTokens}`
    );

    // threadId: Optional - if provided, loads conversation history for context
    // conversationHistory: Not used directly here (context loaded from DB via threadId)
    const body = await req.json();
    let prompt = body.prompt;
    let platform = body.platform;
    const threadId = body.threadId;

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

    // If the user provided a short follow-up like "continue" or "change..." and
    // a threadId is present, attempt to modify/continue the last AI draft from the conversation
    // BEFORE platform detection so we can inherit the platform from the previous draft.
    if (
      (threadId && /^\s*(continue)\s*$/i.test(prompt.trim())) ||
      (threadId && /^\s*(change)\b/i.test(prompt.trim()))
    ) {
      try {
        const conv = await db.collection("chatHistory").findOne({
          userId,
          threadId,
        });
        if (conv && conv.messages && Array.isArray(conv.messages)) {
          // Find the last AI message in the conversation
          const msgs = conv.messages.slice().reverse();
          const lastAi = msgs.find((m: any) => m.sender === "ai" && m.content);
          if (lastAi && lastAi.content) {
            const trimmed = prompt.trim();
            if (/^\s*(continue)\s*$/i.test(trimmed)) {
              // Clean last AI content to remove instructional UI lines (e.g., connect-account prompts)
              const cleaned = lastAi.content
                .replace(/🔗.*connect.*account.*$/i, "")
                .replace(/🔜.*next post.*$/i, "")
                .trim();
              prompt = `Continue the following draft:\n\n${cleaned}`;
            } else if (/^\s*(change)\b/i.test(trimmed)) {
              const changeInstr = trimmed.replace(/^change\b/i, "").trim();
              if (!changeInstr) {
                return NextResponse.json(
                  {
                    success: false,
                    error:
                      "Please specify how you'd like the post changed (e.g., 'change to be more casual')",
                  },
                  { status: 400 }
                );
              }
              const cleaned = lastAi.content
                .replace(/🔗.*connect.*account.*$/i, "")
                .replace(/🔜.*next post.*$/i, "")
                .trim();
              prompt = `Modify the following draft:\n\n${cleaned}\n\nChange: ${changeInstr}`;
            }

            // If platform wasn't provided, prefer the conversation-level platform
            // (chatHistory stores `platform`) and fall back to the last AI message.
            if (!platform) {
              platform = conv.platform || lastAi.platform || undefined;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching conversation for continue/change:", err);
      }
    }

    const platformResult = detectPlatform(prompt, platform);
    // If we inferred a platform from the conversation earlier, prefer it as the effective platform
    const effectivePlatform = platform || platformResult.platform;
    if (!platformResult.platform || platformResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: platformResult.error || "Could not detect platform",
        },
        { status: 400 }
      );
    }

    // If user only mentioned the platform (e.g., "twitter" or "facebook") without a topic,
    // ask them to provide the topic to post about.
    if (!hasTopic(prompt, effectivePlatform || "")) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide the topic you want to post about",
        },
        { status: 400 }
      );
    }

    // Check for recurrence in the prompt
    const recurrenceResult = detectRecurrence(prompt);

    // If recurrence is detected, extract the time and return data for RecurrenceModal
    if (recurrenceResult.hasRecurrence && recurrenceResult.frequency) {
      const timeResult = await extractRecurrenceTime({
        prompt,
        platform: effectivePlatform,
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
          platform: platformResult.platform,
          prompt,
          detectedDays: detectedDays.length > 0 ? detectedDays : undefined,
        },
      });
    }

    // Continue with existing one-time scheduling logic
    const result = await generateApp.invoke({
      prompt,
      platform: effectivePlatform,
      userId,
      threadId: threadId || undefined, // Pass threadId for conversation context
      model: modelConfig.model, // Pass selected model based on plan
      maxTokens: modelConfig.maxTokens, // Pass max tokens based on plan
    });

    if (result.success === false)
      return NextResponse.json(result, { status: 400 });

    // db already initialized at the top of POST function, reuse it

    // Handle greeting responses
    if (result.isGreeting) {
      return NextResponse.json({
        success: true,
        greeting: true,
        message: result.post,
      });
    }

    if (result.scheduleTime && typeof result.scheduleTime === "string") {
      // Store scheduled post with prompt only (post will be generated at scheduled time)
      const inserted = await db.collection("scheduledPosts").insertOne({
        userId,
        prompt,
        platform: platformResult.platform,
        scheduleTime: result.scheduleTime,
        status: "scheduled", // Keep as "scheduled" until the time arrives
        isScheduled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Schedule with Agenda (MongoDB-based scheduler)
      // The worker will generate the post content when the time comes
      const { schedulePost } = await import(
        "../../../../workers/schedulePostWorker"
      );

      const scheduleDate = new Date(result.scheduleTime);
      const jobId = await schedulePost(
        inserted.insertedId.toString(),
        scheduleDate
      );

      // Store job ID in MongoDB for tracking and cancellation
      await db
        .collection("scheduledPosts")
        .updateOne({ _id: inserted.insertedId }, { $set: { jobId } });

      // Format the scheduled time in user's local timezone for display
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
        scheduleTime: result.scheduleTime, // UTC time for database
        scheduleTimeLocal: localTimeString, // Formatted local time for display
        platform: platformResult.platform,
      });
    }

    // Check if user has credentials for the detected platform
    // userDoc already fetched at the top of POST function, reuse it
    const hasCredentials =
      effectivePlatform === "twitter"
        ? userDoc?.twitter
        : effectivePlatform === "facebook"
        ? userDoc?.facebook
        : effectivePlatform === "linkedin"
        ? userDoc?.linkedin
        : null;

    return NextResponse.json({
      success: true,
      review: {
        post: result.post,
        threadId: result.threadId,
        platform: effectivePlatform || result.platform,
        userId,
        hasCredentials: !!hasCredentials,
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

    // Check Content-Type to determine if we're receiving FormData or JSON
    const contentType = req.headers.get("content-type") || "";
    let post: string;
    let platform: string;
    let threadId: string;
    let isScheduled: boolean;
    let _id: string | null;
    let attachments: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle FormData (with potential attachments)
      const formData = await req.formData();
      post = formData.get("post") as string;
      platform = formData.get("platform") as string;
      threadId = formData.get("threadId") as string;
      isScheduled = formData.get("isScheduled") === "true";
      _id = formData.get("_id") as string | null;
      attachments = formData.getAll("attachments") as File[];
    } else {
      // Handle JSON (no attachments)
      const body = await req.json();
      post = body.post;
      platform = body.platform;
      threadId = body.threadId;
      isScheduled = body.isScheduled || false;
      _id = body._id || null;
      attachments = [];
    }

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
      twitter: userDoc?.twitter?.accessToken
        ? {
            accessToken: decrypt(userDoc.twitter.accessToken),
          }
        : null,
      facebook: userDoc?.facebook
        ? {
            pageId: userDoc.facebook.pageId,
            accessToken: decrypt(userDoc.facebook.accessToken),
          }
        : null,
      linkedin: userDoc?.linkedin?.accessToken
        ? {
            accessToken: decrypt(userDoc.linkedin.accessToken),
            personUrn: userDoc.linkedin.personUrn,
          }
        : null,
      slack: userDoc?.slack?.userAccessToken
        ? decrypt(userDoc.slack.userAccessToken)
        : null,
    };

    // Apply final sanitization before posting
    const sanitizedPostContent = sanitizeForPlatform(
      post,
      platformResult.platform
    );

    const authHeader = req.headers.get("authorization") ?? "";
    const postResult = await postApp.invoke({
      post: sanitizedPostContent,
      platform: platformResult.platform,
      threadId,
      userId,
      tokens,
      authToken: authHeader,
      attachments,
    });

    // Check for posting errors or failures
    if (postResult.error || postResult.success === false) {
      return NextResponse.json(
        {
          success: false,
          error:
            postResult.error ||
            `I couldn't publish your post to ${platformResult.platform}. This could be due to platform API issues, credential problems, or connectivity issues. Please check your ${platformResult.platform} connection in settings and try again. 📱`,
        },
        { status: 500 }
      );
    }

    // Check if posting was actually successful
    if (!postResult.success && !postResult.posted) {
      return NextResponse.json(
        {
          success: false,
          error: `The post to ${platformResult.platform} may not have been published successfully. Please check your ${platformResult.platform} account to verify. 📝`,
        },
        { status: 500 }
      );
    }

    // Delete scheduled post after successful posting (reusing DELETE logic)
    if (isScheduled && _id) {
      try {
        // Find the post first to get jobId
        const post = await db.collection("scheduledPosts").findOne({
          _id: new ObjectId(_id),
          userId,
        });

        if (post) {
          // Cancel the Agenda job if it exists
          if (post.jobId) {
            try {
              const { cancelScheduledPost } = await import(
                "../../../../workers/schedulePostWorker"
              );
              await cancelScheduledPost(post.jobId);
              console.log(
                `✅ Cancelled Agenda job ${post.jobId} for posted scheduled post`
              );
            } catch (err) {
              console.error("Failed to cancel Agenda job:", err);
              // Continue with deletion even if cancellation fails
            }
          }

          // Delete from MongoDB
          const deleteResult = await db.collection("scheduledPosts").deleteOne({
            _id: new ObjectId(_id),
            userId,
          });
          console.log(
            `✅ Deleted scheduled post ${_id} after successful posting, deletedCount: ${deleteResult.deletedCount}`
          );
        } else {
          console.log(
            `⚠️ Scheduled post ${_id} not found for deletion (may have been already deleted)`
          );
        }
      } catch (deleteErr) {
        console.error(`❌ Error deleting scheduled post ${_id}:`, deleteErr);
        // Don't fail the request if deletion fails - the post was successfully published
      }
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
