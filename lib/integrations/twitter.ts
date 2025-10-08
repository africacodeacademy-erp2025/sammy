import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";
import { TwitterApi } from "twitter-api-v2";

export type TwitterConfig = {
  // OAuth 2.0 tokens
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
};

export async function saveTwitterConfig(userId: string, config: TwitterConfig) {
  const db = await connectDB();
  const users = db.collection("users");

  const encryptedConfig: any = {
    accessToken: config.accessToken ? encrypt(config.accessToken) : undefined,
    refreshToken: config.refreshToken
      ? encrypt(config.refreshToken)
      : undefined,
    expiresAt: config.expiresAt,
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
    accessToken: config.accessToken ? decrypt(config.accessToken) : undefined,
    refreshToken: config.refreshToken
      ? decrypt(config.refreshToken)
      : undefined,
    expiresAt: config.expiresAt,
  };
}

export async function getTwitterClient(
  userId: string
): Promise<TwitterApi | null> {
  const config = await getTwitterConfig(userId);
  if (!config) return null;

  // Check if token needs refresh (OAuth 2.0)
  if (config.refreshToken && config.expiresAt) {
    if (new Date() >= new Date(config.expiresAt)) {
      // Token expired, refresh it
      const refreshed = await refreshTwitterToken(userId);
      if (!refreshed) return null;
      // Get updated config
      const updatedConfig = await getTwitterConfig(userId);
      if (!updatedConfig?.accessToken) return null;

      // Create OAuth 2.0 client
      return new TwitterApi(updatedConfig.accessToken);
    }
    // Token still valid, use OAuth 2.0
    return new TwitterApi(config.accessToken!);
  }

  // No valid OAuth 2.0 tokens
  if (!config.accessToken) {
    return null;
  }

  // Use OAuth 2.0 token
  return new TwitterApi(config.accessToken);
}

/**
 * Refresh Twitter OAuth 2.0 access token
 */
async function refreshTwitterToken(userId: string): Promise<boolean> {
  try {
    const config = await getTwitterConfig(userId);
    if (!config?.refreshToken) return false;

    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;

    if (!clientId || !clientSecret) return false;

    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString("base64")}`,
        },
        body: new URLSearchParams({
          refresh_token: config.refreshToken,
          grant_type: "refresh_token",
          client_id: clientId,
        }),
      }
    );

    if (!tokenResponse.ok) return false;

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    await saveTwitterConfig(userId, {
      accessToken: access_token,
      refreshToken: refresh_token || config.refreshToken,
      expiresAt: expires_in
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,
    });

    return true;
  } catch (error) {
    console.error("Error refreshing Twitter token:", error);
    return false;
  }
}
