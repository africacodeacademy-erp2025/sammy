import { connectDB } from "../mongo";
import { ObjectId } from "mongodb";
import { encrypt, decrypt } from "../crypto";

export type FacebookConfig = {
  pageId?: string;
  accessToken?: string;
};

export async function saveFacebookConfig(
  userId: string,
  config: FacebookConfig
) {
  const db = await connectDB();
  const users = db.collection("users");

  const encryptedConfig: FacebookConfig = {
    ...config,
    accessToken: config.accessToken ? encrypt(config.accessToken) : undefined,
  };

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { facebook: encryptedConfig, updatedAt: new Date() } }
  );
}

export async function getFacebookConfig(
  userId: string
): Promise<FacebookConfig | null> {
  const db = await connectDB();
  const users = db.collection("users");

  const user = await users.findOne(
    { _id: new ObjectId(userId) },
    { projection: { facebook: 1 } }
  );

  if (!user?.facebook) return null;

  const config = user.facebook as FacebookConfig;

  return {
    ...config,
    accessToken: config.accessToken ? decrypt(config.accessToken) : undefined,
  };
}
