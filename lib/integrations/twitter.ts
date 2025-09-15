import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";
import { TwitterApi } from "twitter-api-v2";

export type TwitterConfig = {
  appKey?: string;
  appSecret?: string;
  accessToken?: string;
  accessSecret?: string;
};

export async function saveTwitterConfig(userId: string, config: TwitterConfig) {
  const db = await connectDB();
  const users = db.collection("users");

  const encryptedConfig: TwitterConfig = {
    ...config,
    accessToken: config.accessToken ? encrypt(config.accessToken) : undefined,
    accessSecret: config.accessSecret
      ? encrypt(config.accessSecret)
      : undefined,
  };

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { twitter: encryptedConfig, updatedAt: new Date() } }
  );
}

export async function getTwitterConfig(
  userId: string
): Promise<TwitterConfig | null> {
  const db = await connectDB();
  const users = db.collection("users");

  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { twitter: 1 } }
  );

  if (!user?.twitter) return null;

  const config = user.twitter as TwitterConfig;

  return {
    ...config,
    accessToken: config.accessToken ? decrypt(config.accessToken) : undefined,
    accessSecret: config.accessSecret
      ? decrypt(config.accessSecret)
      : undefined,
  };
}

export async function getTwitterClient(
  userId: string
): Promise<TwitterApi | null> {
  const config = await getTwitterConfig(userId);
  if (
    !config?.appKey ||
    !config?.appSecret ||
    !config?.accessToken ||
    !config?.accessSecret
  ) {
    return null;
  }

  return new TwitterApi({
    appKey: config.appKey,
    appSecret: config.appSecret,
    accessToken: config.accessToken,
    accessSecret: config.accessSecret,
  });
}
