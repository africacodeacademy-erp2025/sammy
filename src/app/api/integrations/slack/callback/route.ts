import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../../../lib/auth";
import { saveSlackConfig } from "../../../../../../lib/integrations/slack";

// Constants
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const MESSAGES_TO_FETCH = 10;
const EMBEDDING_MODEL = "text-embedding-3-small";

// Types
interface SlackTokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

interface SlackMessage {
  text: string;
  ts: string;
  user?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  is_member?: boolean;
}

interface MessageDocument {
  userId: string;
  channel: string;
  text: string;
  ts: string;
  user?: string;
  embedding: number[];
  createdAt: Date;
}

/**
 * Slack OAuth Callback Route
 *
 * Handles the OAuth callback from Slack, exchanges code for tokens,
 * saves encrypted credentials, and triggers background message pulling.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      return handleOAuthError(error);
    }

    if (!code) {
      return redirectWithError("missing_params");
    }

    if (!state) {
      return redirectWithError("invalid_state");
    }

    // Extract token from state parameter
    // State format: randomString:base64Token
    const token = extractTokenFromState(state);

    if (!token) {
      console.error("Failed to extract token from state parameter");
      return redirectWithError("invalid_state");
    }

    console.log("Token extracted successfully from state parameter");

    const user = await getUserFromRequest(`Bearer ${token}`);
    if (!user) {
      console.error("User authentication failed with extracted token");
      return redirectWithError("callback_error");
    }

    console.log(`User authenticated: ${user._id}`);

    // Exchange code for tokens
    const tokenData = await exchangeCodeForTokens(code);

    if (!tokenData.ok) {
      console.error("Slack token exchange failed:", tokenData.error);
      return redirectWithError("token_exchange_failed");
    }

    if (!tokenData.access_token) {
      return redirectWithError("no_access_token");
    }

    // Save Slack configuration (only save non-null values)
    const slackConfig: any = {
      accessToken: tokenData.access_token,
      teamId: tokenData.team?.id,
      teamName: tokenData.team?.name,
    };

    // Only add user token if it exists
    if (tokenData.authed_user?.access_token) {
      slackConfig.userAccessToken = tokenData.authed_user.access_token;
    }

    // Only add user ID if it exists
    if (tokenData.authed_user?.id) {
      slackConfig.userId = tokenData.authed_user.id;
    }

    await saveSlackConfig(user._id.toString(), slackConfig);

    console.log(`Slack OAuth successful for user ${user._id}`);

    // Trigger background message pulling (awaited to ensure initial seed)
    const userId = user._id.toString();
    const userToken = tokenData.authed_user?.access_token;
    const botToken = tokenData.access_token;

    console.log("Starting message pull for user:", userId, {
      hasUserToken: !!userToken,
      hasBotToken: !!botToken,
    });

    try {
      await pullSlackMessages(userId, {
        userToken,
        botToken,
      });
      console.log("Message pull completed successfully");
    } catch (err) {
      console.error("Background Slack message pull failed:", err);
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/?slack_connected=true`
    );
  } catch (error) {
    console.error("Slack OAuth callback error:", error);
    return redirectWithError("callback_error");
  }
}

/**
 * Exchange authorization code for access tokens
 */
async function exchangeCodeForTokens(
  code: string
): Promise<SlackTokenResponse> {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const clientSecret = process.env.SLACK_CLIENT_SECRET!;
  const redirectUri = process.env.SLACK_REDIRECT_URI!;

  const response = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  return response.json();
}

/**
 * Extract authentication token from state parameter
 * State format: randomString:base64Token
 */
function extractTokenFromState(state: string): string | null {
  try {
    const parts = state.split(":");
    if (parts.length !== 2) {
      return null;
    }

    const [, encodedToken] = parts;
    const token = Buffer.from(encodedToken, "base64").toString("utf-8");
    return token || null;
  } catch (error) {
    console.error("Failed to extract token from state:", error);
    return null;
  }
}

/**
 * Handle OAuth errors
 */
function handleOAuthError(error: string): NextResponse {
  const errorMessages: Record<string, string> = {
    access_denied: "You denied access to Slack",
    invalid_scope: "Invalid permissions requested",
  };

  const message = errorMessages[error] || "Slack authorization failed";
  return redirectWithError(message);
}

/**
 * Redirect with error message
 */
function redirectWithError(message: string): NextResponse {
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_BASE_URL}/?slack_error=${encodeURIComponent(
      message
    )}`
  );
}

/**
 * Background task: Pull recent Slack messages and generate embeddings
 */
type SlackTokens = {
  userToken?: string | null;
  botToken?: string | null;
};

async function pullSlackMessages(
  userId: string,
  tokens: SlackTokens
): Promise<void> {
  try {
    const { connectDB } = await import("../../../../../../lib/mongo");
    const { WebClient } = await import("@slack/web-api");
    const openAiApiKey = process.env.OPEN_AI_API;
    const OpenAI = openAiApiKey ? (await import("openai")).default : null;

    const db = await connectDB();
    const primaryToken = tokens.botToken || tokens.userToken; // Try bot token first

    if (!primaryToken) {
      console.warn("No Slack tokens available for initial message pull");
      return;
    }

    console.log("Using token type:", tokens.botToken ? "bot" : "user");
    const slack = new WebClient(primaryToken);
    const openai = OpenAI ? new OpenAI({ apiKey: openAiApiKey }) : null;

    // Fetch user's channels
    const channels = await fetchUserChannels(slack);
    console.log(
      `Found ${channels.length} channels for user ${userId}:`,
      channels.map((c) => c.name).join(", ")
    );

    if (channels.length === 0) {
      console.log(
        "No channels found for user - user might not be a member of any channels"
      );
      return;
    }

    // Fetch messages from each channel
    const allMessages: MessageDocument[] = [];

    const MESSAGES_PER_CHANNEL = 3; // Get 3 messages from each channel
    const MAX_CHANNELS = 5; // Process up to 5 channels

    for (const channel of channels.slice(0, MAX_CHANNELS)) {
      const messages = await fetchChannelMessages(
        slack,
        channel.id,
        channel.name
      );

      console.log(
        `Processing ${messages.length} messages from channel ${channel.name}`
      );

      let channelMessageCount = 0;
      for (const msg of messages) {
        if (channelMessageCount >= MESSAGES_PER_CHANNEL) {
          console.log(
            `Reached limit of ${MESSAGES_PER_CHANNEL} messages for channel ${channel.name}`
          );
          break;
        }

        const messageDoc = await createMessageDocument(
          userId,
          channel.name,
          msg,
          openai
        );

        if (messageDoc) {
          allMessages.push(messageDoc);
          channelMessageCount++;
          console.log(
            `Added message ${channelMessageCount}/${MESSAGES_PER_CHANNEL} from ${
              channel.name
            }: "${msg.text.substring(0, 50)}..."`
          );
        }
      }
    }

    // Save to database (deduplicate)
    if (allMessages.length > 0) {
      await saveMessagesToDB(db, allMessages);
    }

    console.log(
      `Successfully pulled ${allMessages.length} Slack messages for user ${userId}`
    );
  } catch (error) {
    console.error("Error pulling Slack messages:", error);
    throw error;
  }
}

/**
 * Fetch channels where the bot is actually a member
 */
async function fetchUserChannels(slack: any): Promise<SlackChannel[]> {
  console.log("Fetching channels where bot is a member...");

  try {
    // For bot tokens, use users.conversations to get channels the bot is actually in
    const response = await slack.users.conversations({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 50,
    });

    const botChannels = response.channels || [];
    console.log(
      `Bot is a member of ${botChannels.length} channels:`,
      botChannels.map((c: any) => c.name).join(", ")
    );

    return botChannels;
  } catch (error: any) {
    console.error("Failed to fetch bot's channels:", error.message);

    // Fallback: try the old method and test each channel
    console.log("Falling back to testing all channels individually...");

    const response = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 50,
    });

    const allChannels = response.channels || [];
    const accessibleChannels: SlackChannel[] = [];

    // Test only first 10 channels to avoid timeout
    for (const channel of allChannels.slice(0, 10)) {
      try {
        await slack.conversations.history({
          channel: channel.id,
          limit: 1,
        });
        accessibleChannels.push(channel);
        console.log(`✅ Bot can read messages from: ${channel.name}`);
      } catch (error: any) {
        // Skip logging individual failures to reduce noise
      }
    }

    console.log(
      `Found ${accessibleChannels.length} accessible channels out of ${allChannels.length} total`
    );
    return accessibleChannels;
  }
}

/**
 * Fetch recent messages from a channel
 */
async function fetchChannelMessages(
  slack: any,
  channelId: string,
  channelName: string
): Promise<SlackMessage[]> {
  try {
    const response = await slack.conversations.history({
      channel: channelId,
      limit: MESSAGES_TO_FETCH,
    });

    return (response.messages || [])
      .filter((msg: any) => msg.text && !msg.subtype) // Only regular messages
      .map((msg: any) => ({
        text: msg.text,
        ts: msg.ts,
        user: msg.user,
      }));
  } catch (error) {
    console.error(`Error fetching messages from ${channelName}:`, error);
    return [];
  }
}

/**
 * Create message document with embedding
 */
async function createMessageDocument(
  userId: string,
  channelName: string,
  message: SlackMessage,
  openai: any | null
): Promise<MessageDocument | null> {
  const baseDoc = {
    userId,
    channel: channelName,
    text: message.text,
    ts: message.ts,
    user: message.user,
    createdAt: new Date(),
  };

  if (!openai) {
    return {
      ...baseDoc,
      embedding: [],
    };
  }

  try {
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: message.text,
    });
    return {
      ...baseDoc,
      embedding: embeddingResponse.data[0].embedding,
    };
  } catch (error) {
    console.error("Error creating Slack message embedding:", error);
    return {
      ...baseDoc,
      embedding: [],
    };
  }
}

/**
 * Save messages to database with deduplication
 */
async function saveMessagesToDB(
  db: any,
  messages: MessageDocument[]
): Promise<void> {
  const messagesCollection = db.collection("messages");

  for (const msg of messages) {
    await messagesCollection.updateOne(
      { userId: msg.userId, channel: msg.channel, ts: msg.ts },
      { $set: msg },
      { upsert: true }
    );
  }
}
