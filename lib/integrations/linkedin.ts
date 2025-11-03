import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";

export type LinkedInConfig = {
  // OAuth 2.0 tokens
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  personUrn?: string; // LinkedIn person URN for API calls
};

export async function saveLinkedInConfig(
  userId: string,
  config: LinkedInConfig
) {
  const db = await connectDB();
  const users = db.collection("users");

  const encryptedConfig: any = {
    accessToken: config.accessToken ? encrypt(config.accessToken) : undefined,
    refreshToken: config.refreshToken
      ? encrypt(config.refreshToken)
      : undefined,
    expiresAt: config.expiresAt,
    personUrn: config.personUrn,
  };

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { linkedin: encryptedConfig, updatedAt: new Date() } }
  );
}

export async function getLinkedInConfig(
  userId: string
): Promise<LinkedInConfig | null> {
  const db = await connectDB();
  const users = db.collection("users");

  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { linkedin: 1 } }
  );

  if (!user?.linkedin) return null;

  const config = user.linkedin as LinkedInConfig;

  return {
    accessToken: config.accessToken ? decrypt(config.accessToken) : undefined,
    refreshToken: config.refreshToken
      ? decrypt(config.refreshToken)
      : undefined,
    expiresAt: config.expiresAt,
    personUrn: config.personUrn,
  };
}

export async function getLinkedInClient(
  userId: string
): Promise<{ accessToken: string; personUrn: string } | null> {
  const config = await getLinkedInConfig(userId);
  if (!config) return null;

  // Check if token needs refresh (OAuth 2.0)
  if (config.refreshToken && config.expiresAt) {
    if (new Date() >= new Date(config.expiresAt)) {
      // Token expired, refresh it
      const refreshed = await refreshLinkedInToken(userId);
      if (!refreshed) return null;
      // Get updated config
      const updatedConfig = await getLinkedInConfig(userId);
      if (!updatedConfig?.accessToken) return null;

      return {
        accessToken: updatedConfig.accessToken,
        personUrn: updatedConfig.personUrn || "",
      };
    }
    // Token still valid, use it
    return {
      accessToken: config.accessToken!,
      personUrn: config.personUrn || "",
    };
  }

  // No valid OAuth 2.0 tokens
  if (!config.accessToken) {
    return null;
  }

  // Use OAuth 2.0 token
  return {
    accessToken: config.accessToken,
    personUrn: config.personUrn || "",
  };
}

/**
 * Refresh LinkedIn OAuth 2.0 access token
 */
async function refreshLinkedInToken(userId: string): Promise<boolean> {
  try {
    const config = await getLinkedInConfig(userId);
    if (!config?.refreshToken) return false;

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    if (!clientId || !clientSecret) return false;

    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: config.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenResponse.ok) return false;

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    await saveLinkedInConfig(userId, {
      accessToken: access_token,
      refreshToken: refresh_token || config.refreshToken,
      expiresAt: expires_in
        ? new Date(Date.now() + expires_in * 1000)
        : undefined,
      personUrn: config.personUrn,
    });

    return true;
  } catch (error) {
    console.error("Error refreshing LinkedIn token:", error);
    return false;
  }
}
