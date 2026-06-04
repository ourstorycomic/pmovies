import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  return createHash("sha256")
    .update(process.env.STREAM_TOKEN_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "pmovies-dev-secret")
    .digest();
}

export function encryptStreamUrl(url: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptStreamToken(token: string) {
  const data = Buffer.from(token, "base64url");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
