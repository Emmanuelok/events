import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateOtp, hashOtp, sha256 } from "@/lib/crypto";
import { getOtpProvider } from "@/lib/providers/otp";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 5;

export interface SendOtpInput {
  phone: string;
  purpose: "login" | "rsvp";
  ip?: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
  purpose: "login" | "rsvp";
}

export async function sendOtp(input: SendOtpInput): Promise<
  | { ok: true; requestId: string; devCode?: string }
  | { ok: false; error: "rate_limited" | "send_failed" }
> {
  // Rate limit: max N requests per phone per window.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MIN * 60 * 1000);
  const recent = await db.otpRequest.count({
    where: { phone: input.phone, createdAt: { gte: windowStart } },
  });
  if (recent >= RATE_LIMIT_MAX) {
    return { ok: false, error: "rate_limited" };
  }

  const code = generateOtp();
  const codeHash = hashOtp(code, env().SESSION_SECRET);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const ipHash = input.ip ? sha256(input.ip) : null;

  const request = await db.otpRequest.create({
    data: {
      phone: input.phone,
      codeHash,
      purpose: input.purpose,
      expiresAt,
      ipHash,
    },
  });

  const provider = getOtpProvider();
  const sent = await provider.send(input.phone, code);
  if (!sent.ok) {
    return { ok: false, error: "send_failed" };
  }

  // In mock/dev mode, surface the code to the UI so dev can sign in quickly.
  const devCode = provider.name() === "mock" ? code : undefined;
  return { ok: true, requestId: request.id, devCode };
}

export async function verifyOtp(input: VerifyOtpInput): Promise<
  { ok: true } | { ok: false; error: "expired" | "invalid" | "exhausted" | "not_found" }
> {
  const request = await db.otpRequest.findFirst({
    where: {
      phone: input.phone,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!request) return { ok: false, error: "not_found" };
  if (request.expiresAt < new Date()) return { ok: false, error: "expired" };
  if (request.attempts >= MAX_ATTEMPTS) return { ok: false, error: "exhausted" };

  const expectedHash = hashOtp(input.code, env().SESSION_SECRET);
  if (expectedHash !== request.codeHash) {
    await db.otpRequest.update({
      where: { id: request.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "invalid" };
  }

  await db.otpRequest.update({
    where: { id: request.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
