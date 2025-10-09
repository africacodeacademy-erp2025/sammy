import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { connectDB } from "./mongo";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET not set in environment");
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a signed JWT containing { userId }.
 * We cast secret/options to jwt types to satisfy TypeScript.
 */
export function signJwt(userId: string): string {
  const payload: jwt.JwtPayload = { userId };
  const secret: jwt.Secret = JWT_SECRET as jwt.Secret;
  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, secret, options);
}

export function verifyJwt(token: string) {
  const secret: jwt.Secret = JWT_SECRET as jwt.Secret;
  return jwt.verify(token, secret) as {
    userId: string;
    iat?: number;
    exp?: number;
  };
}

/**
 * Extracts user from Authorization header (Bearer <token>).
 * Returns null if no token / invalid token.
 */
export async function getUserFromRequest(authorizationHeader?: string | null) {
  try {
    if (!authorizationHeader) return null;
    const header = authorizationHeader.trim();
    if (!header.startsWith("Bearer ")) return null;
    const token = header.slice(7).trim();
    if (!token) return null;

    const payload = verifyJwt(token);
    if (!payload?.userId) return null;

    const db = await connectDB();
    const users = db.collection("users");
    const user = await users.findOne(
      { _id: new ObjectId(payload.userId) },
      { projection: { passwordHash: 0 } }
    );
    return user ?? null;
  } catch (err) {
    return null;
  }
}

/**
 * Checks if a token is expired based on the expiration time in the payload.
 * If expired, logs the error and optionally triggers a refresh mechanism.
 */
export function handleExpiredToken(error: any, platform: string) {
  if (error?.code === 401 || error?.response?.status === 401) {
    console.error(`Token expired for platform: ${platform}`);

    return { expired: true, message: "Token expired. Please reauthenticate." };
  }
  return { expired: false, message: "" };
}
