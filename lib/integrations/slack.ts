import { WebClient } from "@slack/web-api";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";

// OAuth 2.0 Configuration Type
export type SlackConfig = {
  // OAuth 2.0 fields
  accessToken?: string; // Bot token (OAuth 2.0)
  userAccessToken?: string; // User token (OAuth 2.0)
  teamId?: string; // Workspace/Team ID (OAuth 2.0)
  teamName?: string; // Workspace name
  userId?: string; // Slack user ID
};

/**
 * Save Slack OAuth configuration to database
 * Encrypts all sensitive tokens before storage
 */
export async function saveSlackConfig(userId: string, config: SlackConfig) {
  const db = await connectDB();
  const users = db.collection("users");

  // Encrypt tokens before saving (only save defined values)
  const encryptedConfig: SlackConfig = {
    // Copy non-sensitive fields
    teamId: config.teamId,
    teamName: config.teamName,
    userId: config.userId,
  };

  // Only encrypt and save tokens that exist
  if (config.accessToken) {
    encryptedConfig.accessToken = encrypt(config.accessToken);
  }
  if (config.userAccessToken) {
    encryptedConfig.userAccessToken = encrypt(config.userAccessToken);
  }

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { slack: encryptedConfig, updatedAt: new Date() } },
    { upsert: false }
  );
}

/**
 * Retrieve and decrypt Slack configuration from database
 */
export async function getSlackConfig(
  userId: string
): Promise<SlackConfig | null> {
  const db = await connectDB();
  const users = db.collection("users");

  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { slack: 1 } }
  );

  if (!user?.slack) return null;

  const config = user.slack as SlackConfig;

  // Decrypt before returning
  return {
    ...config,
    accessToken: config.accessToken ? decrypt(config.accessToken) : undefined,
    userAccessToken: config.userAccessToken
      ? decrypt(config.userAccessToken)
      : undefined,
  };
}

/**
 * Get authenticated Slack WebClient
 * Uses OAuth 2.0 tokens only
 */
export async function getSlackClient(
  userId: string
): Promise<WebClient | null> {
  const config = await getSlackConfig(userId);
  if (!config) return null;

  // Use OAuth 2.0 tokens
  const token = config.accessToken || config.userAccessToken;
  if (!token) return null;

  return new WebClient(token);
}

/**
 * Get user-specific Slack WebClient (uses user token)
 */
export async function getSlackUserClient(
  userId: string
): Promise<WebClient | null> {
  const config = await getSlackConfig(userId);
  if (!config) return null;

  const token = config.userAccessToken;
  if (!token) return null;

  return new WebClient(token);
}

/**
 * Get bot Slack WebClient (uses bot token)
 */
export async function getSlackBotClient(
  userId: string
): Promise<WebClient | null> {
  const config = await getSlackConfig(userId);
  if (!config) return null;

  const token = config.accessToken;
  if (!token) return null;

  return new WebClient(token);
}
