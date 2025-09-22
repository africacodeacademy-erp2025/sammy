import crypto from "crypto";

const ENC_ALGO = "aes-256-gcm";

/**
 * Derive a 32-byte key from a secret
 */
function getKey(): Buffer {
  const secret = process.env.ENC_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Missing ENC_SECRET. Set ENC_SECRET in your environment (.env) to enable encryption."
    );
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Convert standard Base64 to URL-safe Base64
 */
function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert URL-safe Base64 back to standard Base64
 */
function fromUrlSafe(safe: string): string {
  let b64 = safe.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "="; // restore padding
  return b64;
}

/**
 * Encrypt sensitive data.
 * Returns URL-safe Base64 encoded iv:authTag:cipherText
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const key = getKey();
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag().toString("base64");

  return `${toUrlSafe(iv.toString("base64"))}:${toUrlSafe(authTag)}:${toUrlSafe(
    encrypted
  )}`;
}

/**
 * Decrypt sensitive data.
 * Expects URL-safe Base64 encoded iv:authTag:cipherText
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted payload format (must be iv:authTag:cipherText)"
    );
  }

  const [ivB64, authTagB64, encryptedB64] = parts;

  const iv = Buffer.from(fromUrlSafe(ivB64), "base64");
  const authTag = Buffer.from(fromUrlSafe(authTagB64), "base64");
  const encrypted = fromUrlSafe(encryptedB64);

  // Debug: log lengths to verify correctness
  console.log("IV length:", iv.length, "AuthTag length:", authTag.length);

  if (iv.length !== 12)
    throw new Error(`Invalid IV length: got ${iv.length}, expected 12`);
  if (authTag.length !== 16)
    throw new Error(
      `Invalid auth tag length: got ${authTag.length}, expected 16`
    );

  const key = getKey();
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
