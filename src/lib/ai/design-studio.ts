import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import {
  pageDesignSchema,
  sectionSchema,
  PAGE_DESIGN_VERSION,
  type PageDesign,
  type Section,
  type SectionType,
} from "@/lib/design/types";
import { getTemplate, type TemplateId } from "@/lib/design/templates";

// ─── Input schema ───

export const designBriefSchema = z.object({
  brideName: z.string().min(1).max(80),
  groomName: z.string().min(1).max(80),
  eventDate: z.string(),
  city: z.string().min(1),
  venueName: z.string().default(""),
  brief: z.string().min(10).max(2000),
  vibe: z.enum(["warm", "elegant", "bold", "minimal"]).default("warm"),
  templateId: z.enum(["adinkra", "modern", "kente"]).default("adinkra"),
  components: z.array(z.enum(["traditional", "white_wedding"])).min(1).default(["white_wedding"]),
});

export type DesignBriefInput = z.infer<typeof designBriefSchema>;

// What Claude returns. We coerce/normalize before applying.
const claudeOutputSchema = z.object({
  hero: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    subhead: z.string(),
    imagePrompt: z.string(),
  }),
  story: z.object({
    title: z.string(),
    body: z.string(),
    imagePrompt: z.string(),
  }),
  schedule: z.object({
    title: z.string(),
    items: z
      .array(
        z.object({
          time: z.string(),
          title: z.string(),
          description: z.string(),
          date: z.string().optional(),
        }),
      )
      .min(3),
  }),
  details: z.object({
    title: z.string(),
    dressCode: z.string(),
    notes: z.string(),
  }),
  faq: z.object({
    title: z.string(),
    items: z.array(z.object({ q: z.string(), a: z.string() })).min(3),
  }),
  gifts: z.object({
    title: z.string(),
    body: z.string(),
    ctaLabel: z.string(),
  }),
  rsvp: z.object({
    title: z.string(),
    body: z.string(),
    deadlineLine: z.string(),
    ctaLabel: z.string(),
  }),
});

type ClaudeOutput = z.infer<typeof claudeOutputSchema>;

// ─── System prompt — long, static, cache-friendly ───

const SYSTEM_PROMPT = `You are the design studio inside Celebrate, a Ghanaian wedding-planning platform. You write the COPY and STRUCTURE for a couple's wedding website.

OUTPUT RULES (strict):
- Output VALID JSON ONLY. No prose, no markdown fences.
- Match the schema exactly. Every field is required.
- Write in warm, Ghanaian-English. Never American-English idioms ("y'all", "bachelorette", "wedding shower"). Prefer "engagement", "kente", "bride price", "MC", "drinks list" where they fit.
- Headlines: short, evocative, never generic. Avoid "Join us as we say I do" — too 2014.
- Story body: 80-160 words, 2-3 short paragraphs.
- Schedule: respect Ghanaian wedding ordering.
  • If components include "traditional": include the traditional engagement events (arrival, family introductions, drinks presentation, bride price, blessing, gifting, dancing).
  • If components include "white_wedding": include arrival/seating, processional, vows + exchange of rings, signing, recessional, group photos, reception (cake, toasts, first dance, food, MC games).
  • If BOTH are listed, the traditional happens earlier (often the day before, or same morning) and the schedule reflects that with date strings.
  • Times must be plausible 24-hour format strings like "10:00", "14:30".
- Schedule must have at least 6 items if both components are listed, otherwise at least 4.
- FAQ: at least 5 items. Cover: dress code (with kente/traditional cue), kids welcome?, gifts/MoMo, plus-ones, travel/parking, contact for questions, language of the ceremony.
- Gifts section: explicitly mention MoMo (MTN / Telecel / AirtelTigo) is the easy way to bless the couple.
- RSVP section: warm and clear; include a deadlineLine that's specific (e.g. "Kindly reply by 14 November 2026.").
- Image prompts (hero.imagePrompt, story.imagePrompt): vivid, photographable, suitable for a generative image model. Always include "Ghanaian couple", "kente" or "traditional Ghanaian wedding" cue, lighting, composition, and "tasteful, editorial, not AI-generated-looking". Avoid named living people. Keep to 1-2 sentences.

JSON SCHEMA:
{
  "hero": { "eyebrow": str, "headline": str, "subhead": str, "imagePrompt": str },
  "story": { "title": str, "body": str, "imagePrompt": str },
  "schedule": { "title": str, "items": [ { "time": "HH:MM", "title": str, "description": str, "date": str (optional, ISO yyyy-mm-dd when traditional is on a different day) } ] },
  "details": { "title": str, "dressCode": str, "notes": str },
  "faq": { "title": str, "items": [ { "q": str, "a": str } ] },
  "gifts": { "title": str, "body": str, "ctaLabel": str },
  "rsvp": { "title": str, "body": str, "deadlineLine": str, "ctaLabel": str }
}

NEVER invent vendor names. NEVER promise refunds or money handling. NEVER include placeholders like "[TBD]".`;

// ─── Helpers ───

function userMessage(input: DesignBriefInput) {
  const date = new Date(input.eventDate);
  const dateStr = date.toLocaleDateString("en-GH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Generate the wedding website content for:

Couple: ${input.brideName} & ${input.groomName}
Wedding date: ${dateStr}
City: ${input.city}
Venue: ${input.venueName || "(to be confirmed)"}
Components: ${input.components.join(" + ")}
Vibe: ${input.vibe}
Template direction: ${input.templateId}

From the couple, in their words:
"""
${input.brief}
"""

Return JSON only.`;
}

function sid(): string {
  return randomToken(6);
}

function toPageDesign(
  c: ClaudeOutput,
  input: DesignBriefInput,
  existing?: PageDesign | null,
): PageDesign {
  const existingHeroImage = existing?.sections.find((s) => s.type === "hero")?.imageUrl ?? null;
  const existingStoryImage = existing?.sections.find((s) => s.type === "story")?.imageUrl ?? null;

  const sections: Section[] = [
    {
      type: "hero",
      id: sid(),
      eyebrow: c.hero.eyebrow,
      headline: c.hero.headline,
      subhead: c.hero.subhead,
      dateLine: new Date(input.eventDate).toLocaleDateString("en-GH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      locationLine: input.venueName ? `${input.venueName} · ${input.city}` : input.city,
      imagePrompt: c.hero.imagePrompt,
      imageUrl: existingHeroImage,
    },
    {
      type: "story",
      id: sid(),
      title: c.story.title,
      body: c.story.body,
      imagePrompt: c.story.imagePrompt,
      imageUrl: existingStoryImage,
    },
    {
      type: "schedule",
      id: sid(),
      title: c.schedule.title,
      items: c.schedule.items.map((it) => ({
        time: it.time,
        title: it.title,
        description: it.description,
        date: it.date ?? "",
      })),
    },
    {
      type: "details",
      id: sid(),
      title: c.details.title,
      venueName: input.venueName,
      venueAddress: "",
      dressCode: c.details.dressCode,
      notes: c.details.notes,
    },
    {
      type: "faq",
      id: sid(),
      title: c.faq.title,
      items: c.faq.items.map((i) => ({ q: i.q, a: i.a })),
    },
    {
      type: "gifts",
      id: sid(),
      title: c.gifts.title,
      body: c.gifts.body,
      ctaLabel: c.gifts.ctaLabel,
    },
    {
      type: "rsvp",
      id: sid(),
      title: c.rsvp.title,
      body: c.rsvp.body,
      deadlineLine: c.rsvp.deadlineLine,
      ctaLabel: c.rsvp.ctaLabel,
    },
  ];

  return {
    version: PAGE_DESIGN_VERSION,
    templateId: input.templateId,
    vibe: input.vibe,
    sections,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Template-based fallback (no Anthropic key) ───

function templateDesign(input: DesignBriefInput): PageDesign {
  const both = input.components.includes("traditional") && input.components.includes("white_wedding");
  const trad = input.components.includes("traditional");
  const date = new Date(input.eventDate);
  const fmtDate = date.toLocaleDateString("en-GH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const deadline = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deadlineLine = `Kindly reply by ${deadline.toLocaleDateString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}.`;

  const scheduleItems = both
    ? [
        { time: "09:00", title: "Traditional engagement begins", description: "Arrival, family introductions, drinks presentation.", date: "" },
        { time: "11:30", title: "Bride price & blessing", description: "Elders bless the union. Photos to follow.", date: "" },
        { time: "14:00", title: "Engagement reception", description: "Lunch, kente change, dancing.", date: "" },
        { time: "10:00", title: "White wedding ceremony", description: "Processional, vows, exchange of rings.", date: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
        { time: "13:00", title: "Reception", description: "Toasts, cake, first dance, food, MC games.", date: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
        { time: "20:00", title: "After-party", description: "Dancing into the night.", date: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      ]
    : trad
      ? [
          { time: "09:00", title: "Arrival & family introductions", description: "The groom's family arrives at the bride's home.", date: "" },
          { time: "10:30", title: "Drinks presentation & bride price", description: "Symbolic items presented to the bride's family.", date: "" },
          { time: "12:00", title: "Blessing & gifting", description: "Elders bless the couple. Gifts exchanged.", date: "" },
          { time: "14:00", title: "Reception", description: "Food, kente change, dancing, photos.", date: "" },
        ]
      : [
          { time: "10:00", title: "Guest arrival", description: "Welcome drinks and seating.", date: "" },
          { time: "11:00", title: "Ceremony", description: "Processional, vows, exchange of rings.", date: "" },
          { time: "13:00", title: "Reception", description: "Toasts, cake, first dance, food.", date: "" },
          { time: "16:00", title: "Photos & dancing", description: "Group photos, MC games, open floor.", date: "" },
        ];

  const sections: Section[] = [
    {
      type: "hero",
      id: sid(),
      eyebrow: "We're getting married",
      headline: `${input.brideName} & ${input.groomName}`,
      subhead: "Come and rejoice with us.",
      dateLine: fmtDate,
      locationLine: input.venueName ? `${input.venueName} · ${input.city}` : input.city,
      imagePrompt: `Editorial portrait of a young Ghanaian couple in elegant kente attire, warm golden hour light, tasteful, photographic, not AI-generated-looking.`,
      imageUrl: null,
    },
    {
      type: "story",
      id: sid(),
      title: "Our story",
      body:
        input.brief.trim() ||
        `We met, we laughed, we fell in love. And now we're inviting the people we love most to celebrate the next chapter with us in ${input.city}. We can't wait to see you there.`,
      imagePrompt: `Candid Ghanaian couple laughing in a sunlit market, soft natural light, documentary style, warm tones.`,
      imageUrl: null,
    },
    {
      type: "schedule",
      id: sid(),
      title: "The day, hour by hour",
      items: scheduleItems,
    },
    {
      type: "details",
      id: sid(),
      title: "When & where",
      venueName: input.venueName,
      venueAddress: "",
      dressCode: trad
        ? "Traditional engagement: kente or rich African prints. White wedding: cocktail formal."
        : "Cocktail formal. Bring your dancing shoes.",
      notes: "Doors open one hour before each event. Plenty of parking on-site.",
    },
    {
      type: "faq",
      id: sid(),
      title: "Good to know",
      items: [
        { q: "What should I wear?", a: trad ? "For the traditional engagement, kente or African prints. For the white wedding, cocktail formal." : "Cocktail formal. Avoid white." },
        { q: "Are kids welcome?", a: "We adore your children — but we'd love a grown-ups-only celebration. Thank you for understanding." },
        { q: "Can I bring a plus-one?", a: "Plus-ones are noted on your invitation. If you weren't sure, just check with us." },
        { q: "How do I send a gift?", a: "MoMo (MTN / Telecel / AirtelTigo) is the easiest way. The gift link is on this page." },
        { q: "Who do I contact for questions?", a: "Reach out to our planner via the contact on the invitation. We're happy to help." },
      ],
    },
    {
      type: "gifts",
      id: sid(),
      title: "A gift, the Ghanaian way",
      body:
        "If you'd like to bless us with a gift, MoMo is the easiest way. One tap from MTN, Telecel, or AirtelTigo — and we'll thank you personally.",
      ctaLabel: "Send a MoMo gift",
    },
    {
      type: "rsvp",
      id: sid(),
      title: "Will you celebrate with us?",
      body: "Your reply helps us plan the catering, seating, and the very long drinks list.",
      deadlineLine,
      ctaLabel: "RSVP now",
    },
  ];

  return {
    version: PAGE_DESIGN_VERSION,
    templateId: input.templateId,
    vibe: input.vibe,
    sections,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Public API ───

export interface GenerateContext {
  eventId: string;
  userId: string;
  existing?: PageDesign | null;
}

export async function generateDesign(
  input: DesignBriefInput,
  ctx: GenerateContext,
): Promise<{ design: PageDesign; source: "ai" | "template" }> {
  // Make sure the template is real
  getTemplate(input.templateId);

  const e = env();
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    const design = templateDesign(input);
    await persistBrief(ctx.eventId, input, design, "template");
    await logInvocation(ctx, { status: "fallback", modelId: "template" });
    return { design, source: "template" };
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: e.ANTHROPIC_MODEL_BUDGET,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage(input) }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No text response");
    const raw = block.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);
    const validated = claudeOutputSchema.parse(parsed);
    const design = toPageDesign(validated, input, ctx.existing ?? null);

    await persistBrief(ctx.eventId, input, design, e.ANTHROPIC_MODEL_BUDGET);
    await logInvocation(ctx, {
      status: "ok",
      modelId: e.ANTHROPIC_MODEL_BUDGET,
      latencyMs: Date.now() - start,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    return { design, source: "ai" };
  } catch (err) {
    await logInvocation(ctx, {
      status: "error",
      modelId: e.ANTHROPIC_MODEL_BUDGET,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
    const design = templateDesign(input);
    return { design, source: "template" };
  }
}

// Regenerate a single section while preserving everything else.
export async function regenerateSection(
  current: PageDesign,
  sectionType: SectionType,
  userPrompt: string,
  input: DesignBriefInput,
  ctx: GenerateContext,
): Promise<{ section: Section; source: "ai" | "template" }> {
  const e = env();
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    const fresh = templateDesign(input);
    const next = fresh.sections.find((s) => s.type === sectionType);
    if (!next) throw new Error(`Template missing section ${sectionType}`);
    return { section: { ...next, id: sid() }, source: "template" };
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
  const start = Date.now();

  const focus = `Regenerate ONLY the "${sectionType}" section. Keep the rest of the page (existing) untouched. The couple says: "${userPrompt}".`;
  const existingContext = JSON.stringify(current.sections.find((s) => s.type === sectionType));

  try {
    const response = await client.messages.create({
      model: env().ANTHROPIC_MODEL_FAST,
      max_tokens: 1500,
      system:
        SYSTEM_PROMPT +
        `\n\nFor THIS REQUEST: respond with JSON containing only the single section requested, matching its part of the schema above (no wrapping). For example for "hero" return {"eyebrow":..,"headline":..,"subhead":..,"imagePrompt":..}.`,
      messages: [
        {
          role: "user",
          content: `${userMessage(input)}\n\n${focus}\n\nCurrent section JSON (for reference): ${existingContext}\n\nReturn JSON for just this section.`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const raw = block.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw);

    // Coerce into a full Section by merging with type+id
    const existing = current.sections.find((s) => s.type === sectionType);
    if (!existing) throw new Error(`Missing section ${sectionType}`);
    const next = sectionSchema.parse({ ...existing, ...parsed, type: sectionType, id: existing.id });

    await logInvocation(ctx, {
      status: "ok",
      modelId: env().ANTHROPIC_MODEL_FAST,
      latencyMs: Date.now() - start,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      feature: "design_section_regen",
    });
    return { section: next, source: "ai" };
  } catch (err) {
    await logInvocation(ctx, {
      status: "error",
      modelId: env().ANTHROPIC_MODEL_FAST,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      feature: "design_section_regen",
    });
    const fresh = templateDesign(input);
    const next = fresh.sections.find((s) => s.type === sectionType);
    if (!next) throw new Error(`Template missing section ${sectionType}`);
    return { section: { ...next, id: sid() }, source: "template" };
  }
}

// ─── Persistence helpers ───

async function persistBrief(
  eventId: string,
  input: DesignBriefInput,
  design: PageDesign,
  modelId: string,
) {
  try {
    await db.designBrief.create({
      data: {
        eventId,
        brief: input.brief,
        vibe: input.vibe,
        templateId: input.templateId,
        generated: design as unknown as object,
        modelId,
      },
    });
  } catch {
    // best-effort
  }
}

interface LogP {
  status: "ok" | "error" | "fallback";
  modelId: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
  feature?: string;
}
async function logInvocation(ctx: GenerateContext, p: LogP) {
  try {
    await db.aiInvocation.create({
      data: {
        eventId: ctx.eventId,
        userId: ctx.userId,
        feature: p.feature ?? "design_studio",
        modelId: p.modelId,
        status: p.status,
        latencyMs: p.latencyMs ?? 0,
        inputTokens: p.inputTokens ?? 0,
        outputTokens: p.outputTokens ?? 0,
        error: p.error,
      },
    });
  } catch {
    // best-effort
  }
}

export { templateDesign };
export type { TemplateId };
// Re-export the schema for tests
export { pageDesignSchema };
