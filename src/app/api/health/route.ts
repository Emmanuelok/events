import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { probeDb } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  const dbProbe = await probeDb();
  return NextResponse.json({
    ok: dbProbe.ok,
    demoMode: e.DEMO_MODE,
    env: {
      DATABASE_URL: e.DATABASE_URL ? "set" : "missing",
      SESSION_SECRET: e.SESSION_SECRET
        ? e.SESSION_SECRET.length >= 32
          ? "set (ok)"
          : "set (too short — needs 32+ chars)"
        : "missing",
      ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY ? "set" : "missing (AI features will use template fallback)",
      GEMINI_API_KEY: e.GEMINI_API_KEY ? "set" : "missing (image gen will use placeholders)",
      AI_PROVIDER: e.AI_PROVIDER,
      IMAGE_PROVIDER: e.IMAGE_PROVIDER,
      PAYMENT_PROVIDER: e.PAYMENT_PROVIDER,
    },
    database: dbProbe.ok ? "reachable" : `unreachable: ${dbProbe.error}`,
  });
}
