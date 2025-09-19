import crypto from "crypto";

const ENC_ALGO = "aes-256-gcm";

// Derive a 32-byte key from a secret
function getKey(): Buffer {
  const secret = process.env.ENC_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Missing ENC_SECRET. Set ENC_SECRET in your environment (.env) to enable encryption."
    );
  }
  // Use SHA-256 to derive a 32-byte key for AES-256
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Encrypt sensitive data.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const key = getKey();
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive data like tokens.
 */
export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getKey();

  const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
