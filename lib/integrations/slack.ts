import { WebClient } from "@slack/web-api";
import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";

export type SlackConfig = {
  workspaceId?: string;
  botToken?: string;
  userToken?: string;
  channels?: string[];
};

export async function saveSlackConfig(userId: string, config: SlackConfig) {
  const db = await connectDB();
  const users = db.collection("users");

  // Encrypt tokens before saving
  const encryptedConfig: SlackConfig = {
    ...config,
    botToken: config.botToken ? encrypt(config.botToken) : undefined,
    userToken: config.userToken ? encrypt(config.userToken) : undefined,
  };

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { slack: encryptedConfig, updatedAt: new Date() } },
    { upsert: false }
  );
}

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
    botToken: config.botToken ? decrypt(config.botToken) : undefined,
    userToken: config.userToken ? decrypt(config.userToken) : undefined,
  };
}

export async function getSlackClient(
  userId: string
): Promise<WebClient | null> {
  const config = await getSlackConfig(userId);
  if (!config) return null;

  const token = config.botToken || config.userToken;
  if (!token) return null;

  return new WebClient(token);
}
