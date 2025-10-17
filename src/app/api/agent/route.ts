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
  tokens?: {
    twitter?: {
      accessToken: string;
    };
    facebook?: {
      pageId: string;
      accessToken: string;
    };
  };
  authToken?: string;
  isRandomPost?: boolean;
  isGreeting?: boolean;
  attachments?: File[];
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

function sanitizeForTwitter(text: string): string {
  // Twitter character limit: 280 characters
  let sanitized = text.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove potentially problematic characters
  sanitized = sanitized.replace(/[^\w\s#@.,!?;:()\-'"]/g, "");

  // Ensure hashtags are properly formatted (no spaces, alphanumeric + underscore)
  sanitized = sanitized.replace(/#[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "").replace(/[^#\w]/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Ensure mentions are properly formatted
  sanitized = sanitized.replace(/@[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "").replace(/[^@\w]/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up multiple spaces and newlines
  sanitized = sanitized.replace(/\s+/g, " ").replace(/\n+/g, "\n");

  // Remove excessive punctuation
  sanitized = sanitized.replace(/[.]{3,}/g, "...");
  sanitized = sanitized.replace(/[!]{2,}/g, "!");
  sanitized = sanitized.replace(/[?]{2,}/g, "?");

  // Truncate if too long, leaving space for potential link shortening
  if (sanitized.length > 260) {
    const truncated = sanitized.substring(0, 257);
    const lastSpace = truncated.lastIndexOf(" ");
    sanitized =
      (lastSpace > 240 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }

  return sanitized.trim();
}

function sanitizeForFacebook(text: string): string {
  // Facebook has a 63,206 character limit, but optimal is much shorter
  let sanitized = text.trim();

  // Remove any HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");

  // Remove potentially problematic characters but keep emojis and common symbols
  sanitized = sanitized.replace(/[^\w\s#@.,!?;:()\-'"emoji\u00A0-\uFFFF]/g, "");

  // Ensure hashtags work properly (Facebook is more flexible but clean them up)
  sanitized = sanitized.replace(/#[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up mentions
  sanitized = sanitized.replace(/@[\w\s]+/g, (match) => {
    const cleaned = match.replace(/\s+/g, "");
    return cleaned.length > 1 ? cleaned : "";
  });

  // Clean up excessive whitespace
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
  sanitized = sanitized.replace(/\s{2,}/g, " ");

  // Remove excessive punctuation
  sanitized = sanitized.replace(/[.]{4,}/g, "...");
  sanitized = sanitized.replace(/[!]{3,}/g, "!!");
  sanitized = sanitized.replace(/[?]{3,}/g, "??");

  // Keep it reasonable length for engagement (Facebook's sweet spot is 40-80 chars but allow longer)
  if (sanitized.length > 1500) {
    const truncated = sanitized.substring(0, 1497);
    const lastSpace = truncated.lastIndexOf(" ");
    sanitized =
      (lastSpace > 1400 ? truncated.substring(0, lastSpace) : truncated) +
      "...";
  }

  return sanitized.trim();
}

function validateContent(text: string): { isValid: boolean; reason?: string } {
  const lowercaseText = text.toLowerCase();

  // Check for potentially problematic content patterns
  const problematicPatterns = [
    /\b(spam|click here|buy now|act fast|limited time|urgent|free money)\b/gi,
    /\b(hate|kill|die|stupid|idiot)\b/gi,
    /(.)\1{10,}/g, // Excessive repetition
    /[A-Z]{20,}/g, // Excessive caps
  ];

  for (const pattern of problematicPatterns) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        reason:
          "Content contains potentially inappropriate or spam-like language",
      };
    }
  }

  // Check for excessive special characters (potential spam)
  const specialCharCount = (
    text.match(/[!@#$%^&*()_+={}[\]|\\:";'<>?,./]/g) || []
  ).length;
  if (specialCharCount > text.length * 0.3) {
    return {
      isValid: false,
      reason: "Content contains excessive special characters",
    };
  }

  return { isValid: true };
}

function getPlatformSpecificGuidelines(platform: string): string {
  if (platform === "twitter") {
    return `
Platform-specific guidelines for Twitter:
- Keep it under 280 characters (aim for 240-260 for retweets)
- Use 1-2 relevant hashtags maximum
- Make it engaging and conversational
- Include a call-to-action when appropriate
- Use line breaks sparingly
- Avoid excessive punctuation or special characters
- Write in a concise, punchy style
- Consider Twitter's audience: fast-paced, news-oriented, conversational
- Use proper capitalization (not all caps)
- Make it authentic and human-like`;
  } else if (platform === "facebook") {
    return `
Platform-specific guidelines for Facebook:
- Optimal length: 40-80 characters for high engagement, but can be longer for storytelling
- Use storytelling and emotional connection
- Ask questions to encourage engagement
- Use emojis appropriately (1-3 per post)
- Line breaks are okay for readability
- Include relevant hashtags (3-5 maximum)
- Write in a warm, community-focused tone
- Consider Facebook's audience: community-focused, relationship-oriented
- Use proper grammar and spelling
- Make it authentic and personal`;
  }
  return "";
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
    const platformGuidelines = getPlatformSpecificGuidelines(platform);
    let systemMessage = `You are an expert at writing engaging, platform-optimized social media posts. ${platformGuidelines}
    
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

    const rawPost = completion.choices[0].message?.content ?? "";

    // Validate content before processing
    const validation = validateContent(rawPost);
    if (!validation.isValid) {
      console.warn("Generated content failed validation:", validation.reason);
      // Regenerate with stricter guidelines if content is problematic
      const sanitizedCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              systemMessage +
              "\n\nIMPORTANT: The content must be professional, appropriate, and free from spam-like language, excessive punctuation, or inappropriate content.",
          },
          {
            role: "user",
            content:
              userMessage +
              "\n\nPlease ensure the content is clean, professional, and appropriate for a business audience.",
          },
        ],
        max_tokens: 250,
      });
      const cleanPost =
        sanitizedCompletion.choices[0].message?.content ?? rawPost;

      // Apply platform-specific sanitization
      let sanitizedPost = cleanPost;
      if (platform === "twitter") {
        sanitizedPost = sanitizeForTwitter(cleanPost);
      } else if (platform === "facebook") {
        sanitizedPost = sanitizeForFacebook(cleanPost);
      }

      // If still failing validation after regeneration, use fallback
      const finalValidation = validateContent(sanitizedPost);
      if (!finalValidation.isValid) {
        sanitizedPost = `Here's a curated post for your ${platform} audience. Configure your sources and platforms for better content generation.`;
      }

      const finalPost = isRandomPost
        ? `${sanitizedPost}\n\n💡 Configure sources and platforms for curated posts`
        : sanitizedPost;

      return {
        post: finalPost,
        threadId: generateThreadId(),
        platform: platform,
        success: true,
        isRandomPost,
      };
    }

    // Apply platform-specific sanitization
    let sanitizedPost = rawPost;
    if (platform === "twitter") {
      sanitizedPost = sanitizeForTwitter(rawPost);
    } else if (platform === "facebook") {
      sanitizedPost = sanitizeForFacebook(rawPost);
    }

    const finalPost = isRandomPost
      ? `${sanitizedPost}\n\n💡 Configure sources and platforms for curated posts`
      : sanitizedPost;

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
postWorkflow.addConditionalEdges(START, (s: GraphState) =>
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

    // Check for recurrence in the prompt
    const recurrenceResult = detectRecurrence(prompt);

    // If recurrence is detected, extract the time and return data for RecurrenceModal
    if (recurrenceResult.hasRecurrence && recurrenceResult.frequency) {
      const timeResult = await extractRecurrenceTime({
        prompt,
        platform: platformResult.platform,
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
    const userDoc = await db.collection("users").findOne({ _id: user._id });
    const hasCredentials =
      platformResult.platform === "twitter"
        ? userDoc?.twitter
        : userDoc?.facebook;

    return NextResponse.json({
      success: true,
      review: {
        post: result.post,
        threadId: result.threadId,
        platform: result.platform,
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

    console.log("=== Agent PUT Debug ===");
    console.log("Post:", post);
    console.log("Platform:", platform);
    console.log("ThreadId:", threadId);
    console.log("Attachments received:", attachments.length);
    attachments.forEach((file, index) => {
      console.log(
        `Agent attachment ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`
      );
    });

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
      slack: userDoc?.slack?.userAccessToken
        ? decrypt(userDoc.slack.userAccessToken)
        : null,
    };

    // Apply final sanitization before posting
    let sanitizedPostContent = post;
    if (platformResult.platform === "twitter") {
      sanitizedPostContent = sanitizeForTwitter(post);
    } else if (platformResult.platform === "facebook") {
      sanitizedPostContent = sanitizeForFacebook(post);
    }

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
