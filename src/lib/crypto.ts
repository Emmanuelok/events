import crypto from "node:crypto";

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashOtp(code: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(code).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function generateOtp(): string {
  // 6 digits, leading zeros allowed
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function generateSlug(prefix?: string): string {
  const id = crypto.randomBytes(4).toString("hex");
  return prefix ? `${prefix}-${id}` : id;
}

export function generateShortCode(): string {
  // 6-char URL-safe code for short links (guests + RSVP)
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "";
  const buf = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    out += alphabet[buf[i]! % alphabet.length];
  }
  return out;
}
