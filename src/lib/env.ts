import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),

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
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    throw new Error(
      `Invalid environment configuration:\n${JSON.stringify(flat.fieldErrors, null, 2)}`,
    );
  }
  cached = parsed.data;
  return cached;
}
