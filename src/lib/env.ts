import { z } from "zod";

// IMPORTANT: keep every field optional with a default so module evaluation
// during `next build` (static prerender of layout / 404 / not-found) does NOT
// throw. Fail-loud guards live next to the code that actually needs each var
// (see assertRuntimeReady below).
const schema = z.object({
  DATABASE_URL: z.string().optional().default(""),
  SESSION_SECRET: z.string().optional().default(""),

  OTP_PROVIDER: z.enum(["mock", "hubtel"]).default("mock"),
  WHATSAPP_PROVIDER: z.enum(["mock", "meta"]).default("mock"),
  PAYMENT_PROVIDER: z.enum(["mock", "paystack"]).default("mock"),
  AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  IMAGE_PROVIDER: z.enum(["mock", "gemini"]).default("mock"),
  VIDEO_PROVIDER: z.enum(["mock", "gemini"]).default("mock"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL_BUDGET: z.string().default("claude-opus-4-7"),
  ANTHROPIC_MODEL_FAST: z.string().default("claude-sonnet-4-6"),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().default("imagen-4.0-generate-001"),
  GEMINI_VIDEO_MODEL: z.string().default("veo-3.0-generate-001"),

  HUBTEL_CLIENT_ID: z.string().optional(),
  HUBTEL_CLIENT_SECRET: z.string().optional(),
  HUBTEL_SENDER_ID: z.string().default("Celebrate"),

  META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // TEMPORARY: when set, bypasses phone-OTP auth and signs every visitor in as
  // a single demo user. Used for stakeholder review; un-set in production.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Schema is permissive; this only happens for type-coercion failures.
    throw new Error(
      `Invalid environment configuration:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/**
 * Call this from code paths that ACTUALLY require a real DB / signing secret
 * at runtime (e.g. before issuing an OTP, before opening a session). It throws
 * a clear, single error so missing config doesn't silently produce bad HMACs.
 */
export function assertRuntimeReady(): void {
  const e = env();
  const missing: string[] = [];
  if (!e.DATABASE_URL) missing.push("DATABASE_URL");
  if (!e.SESSION_SECRET || e.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Celebrate is not configured for runtime: missing ${missing.join(", ")}. Set these in your hosting environment (e.g. Vercel project env vars).`,
    );
  }
}
