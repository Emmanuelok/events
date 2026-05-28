import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

// ─────────── Input/output schemas ───────────

export const budgetInputSchema = z.object({
  eventType: z.literal("wedding"),
  region: z.string(),
  city: z.string().min(1),
  guestCount: z.number().int().min(10).max(5000),
  styleBand: z.enum(["budget", "mid", "premium", "luxury"]),
  components: z.array(z.enum(["traditional", "white_wedding"])).min(1),
  preferences: z
    .object({
      liveBand: z.boolean().optional(),
      videography: z.boolean().optional(),
    })
    .optional(),
});

export type BudgetInput = z.infer<typeof budgetInputSchema>;

const categorySchema = z.object({
  category: z.string().min(1),
  label: z.string().min(1),
  lowMinor: z.number().int().nonnegative(),
  typicalMinor: z.number().int().nonnegative(),
  highMinor: z.number().int().nonnegative(),
  notes: z.string().default(""),
});

export const budgetOutputSchema = z.object({
  totalMinor: z.number().int().nonnegative(),
  currency: z.literal("GHS"),
  assumptions: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  categories: z.array(categorySchema).min(5),
});

export type BudgetOutput = z.infer<typeof budgetOutputSchema>;

// ─────────── Template fallback (used when AI_PROVIDER=mock) ───────────

const REGION_MULTIPLIER: Record<string, number> = {
  greater_accra: 1.15,
  ashanti: 1.0,
  western: 0.95,
  central: 0.95,
  eastern: 0.95,
  volta: 0.9,
  northern: 0.85,
  upper_east: 0.8,
  upper_west: 0.8,
  bono: 0.9,
  bono_east: 0.9,
  ahafo: 0.9,
  oti: 0.85,
  savannah: 0.8,
  north_east: 0.8,
  western_north: 0.9,
};

const STYLE_MULTIPLIER: Record<string, number> = {
  budget: 0.7,
  mid: 1.0,
  premium: 1.5,
  luxury: 2.5,
};

// Base typical-per-guest cost lines in pesewas at 'mid' band in Ashanti region (multiplier=1).
const BASE_LINES = [
  { category: "venue", label: "Venue & decor", perGuest: 8000, fixed: 200000 },
  { category: "catering", label: "Catering & drinks", perGuest: 12000, fixed: 50000 },
  { category: "attire", label: "Bride & groom attire", perGuest: 0, fixed: 1200000 },
  { category: "photo", label: "Photography & video", perGuest: 0, fixed: 800000 },
  { category: "music", label: "MC, DJ / live band", perGuest: 0, fixed: 500000 },
  { category: "cake", label: "Wedding cake & desserts", perGuest: 800, fixed: 80000 },
  { category: "stationery", label: "Invitations & stationery", perGuest: 400, fixed: 30000 },
  { category: "transport", label: "Transport & logistics", perGuest: 0, fixed: 250000 },
  { category: "favours", label: "Guest favours", perGuest: 1500, fixed: 0 },
  { category: "contingency", label: "Contingency (10%)", perGuest: 0, fixed: 0 },
];

export function templateBudget(input: BudgetInput): BudgetOutput {
  const regionMult = REGION_MULTIPLIER[input.region] ?? 1;
  const styleMult = STYLE_MULTIPLIER[input.styleBand] ?? 1;
  const includesTrad = input.components.includes("traditional");
  const includesWhite = input.components.includes("white_wedding");
  const componentMult = (includesTrad ? 1 : 0) + (includesWhite ? 1 : 0);

  const categories = BASE_LINES.filter((l) => l.category !== "contingency").map((line) => {
    const guestPart = line.perGuest * input.guestCount;
    const base = (guestPart + line.fixed) * regionMult * styleMult;
    // If traditional + white, fixed-cost lines (attire, venue) roughly 1.6×, variable lines stay ~1×.
    const dualBump = line.perGuest === 0 && componentMult === 2 ? 1.6 : 1;
    const typical = Math.round(base * dualBump);
    return {
      category: line.category,
      label: line.label,
      lowMinor: Math.round(typical * 0.75),
      typicalMinor: typical,
      highMinor: Math.round(typical * 1.4),
      notes: "",
    };
  });

  const subtotal = categories.reduce((sum, c) => sum + c.typicalMinor, 0);
  const contingency = Math.round(subtotal * 0.1);
  categories.push({
    category: "contingency",
    label: "Contingency (10%)",
    lowMinor: Math.round(contingency * 0.5),
    typicalMinor: contingency,
    highMinor: Math.round(contingency * 1.5),
    notes: "Buffer for last-minute changes — strongly recommended.",
  });

  const total = categories.reduce((sum, c) => sum + c.typicalMinor, 0);
  const assumptions = [
    `Region multiplier: ${regionMult}× (Ghana market baseline)`,
    `Style band: ${input.styleBand} (×${styleMult})`,
    includesTrad && includesWhite
      ? "Both traditional and white wedding components included; fixed-cost lines doubled."
      : includesTrad
        ? "Traditional engagement only."
        : "White wedding only.",
  ];

  return {
    totalMinor: total,
    currency: "GHS",
    assumptions,
    warnings: [
      "Ranges only — confirm with real quotes from vendors.",
      "Costs vary seasonally; December and Easter are peak.",
    ],
    categories,
  };
}

// ─────────── Anthropic-backed estimator ───────────

const SYSTEM_PROMPT = `You are a Ghanaian wedding planning expert. Produce a realistic line-item budget in GHS pesewas (integer minor units; 100 pesewas = 1 GHS) for the given inputs.

REQUIREMENTS:
- Use current realistic Ghana market rates. Accra is roughly 15% more expensive than Kumasi; Northern regions roughly 15-20% cheaper.
- If BOTH traditional engagement and white wedding are listed, account for two separate ceremonies (attire, venue, decor, photographer days, catering for both events).
- Include a 10% contingency line.
- Output STRICTLY valid JSON matching the schema. No prose, no markdown fences.
- Be conservative; under-promising is better than over-promising.
- Never invent vendor names or contact details.
- All amounts are integers in pesewas. Example: GHS 5,000 = 500000.

OUTPUT SCHEMA:
{
  "totalMinor": <int>,
  "currency": "GHS",
  "assumptions": [<string>, ...],
  "warnings": [<string>, ...],
  "categories": [
    {
      "category": "<short slug>",
      "label": "<human readable>",
      "lowMinor": <int>,
      "typicalMinor": <int>,
      "highMinor": <int>,
      "notes": "<short>"
    },
    ... at least 5 categories
  ]
}`;

export async function generateBudget(
  input: BudgetInput,
  context: { eventId?: string; userId?: string },
): Promise<{ output: BudgetOutput; source: "ai" | "template" }> {
  const e = env();

  // If Anthropic not configured, return template.
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    const out = templateBudget(input);
    await logInvocation({ ...context, modelId: "template", status: "fallback", latencyMs: 0 });
    return { output: out, source: "template" };
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: e.ANTHROPIC_MODEL_BUDGET,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate a budget for:\n${JSON.stringify(input, null, 2)}\n\nRespond with JSON only.`,
        },
      ],
    });
    const latencyMs = Date.now() - start;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }
    const raw = textBlock.text.trim();
    // Strip accidental fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(jsonStr);
    const validated = budgetOutputSchema.parse(parsed);

    await logInvocation({
      ...context,
      modelId: e.ANTHROPIC_MODEL_BUDGET,
      status: "ok",
      latencyMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    return { output: validated, source: "ai" };
  } catch (err) {
    await logInvocation({
      ...context,
      modelId: e.ANTHROPIC_MODEL_BUDGET,
      status: "error",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    // Hard fall back to template so the user experience never blocks.
    const out = templateBudget(input);
    return { output: out, source: "template" };
  }
}

async function logInvocation(p: {
  eventId?: string;
  userId?: string;
  modelId: string;
  status: "ok" | "error" | "fallback";
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}) {
  try {
    await db.aiInvocation.create({
      data: {
        eventId: p.eventId,
        userId: p.userId,
        feature: "budget_estimator",
        modelId: p.modelId,
        status: p.status,
        latencyMs: p.latencyMs,
        inputTokens: p.inputTokens ?? 0,
        outputTokens: p.outputTokens ?? 0,
        error: p.error,
      },
    });
  } catch {
    // Best-effort logging; never fail the user request because logging failed.
  }
}
