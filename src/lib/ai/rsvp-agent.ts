// Claude reads an inbound WhatsApp/SMS message from a guest, classifies the
// intent, extracts structured updates, and drafts a reply. The reply is NOT
// auto-sent — it sits as an AiDraft pending the organizer's approval.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

const SYSTEM_PROMPT = `You are an assistant for a Ghanaian wedding. A guest just sent the couple a WhatsApp or SMS message. Your job:

1. Classify the guest's intent into ONE of: rsvp_yes, rsvp_no, rsvp_maybe, dietary, plus_one, question, other.
2. Output a structured object describing what (if anything) should be updated about their RSVP.
3. Draft a short, warm reply the couple can approve and send.

OUTPUT VALID JSON ONLY (no prose, no markdown fences) matching this exact schema:
{
  "intent": "rsvp_yes" | "rsvp_no" | "rsvp_maybe" | "dietary" | "plus_one" | "question" | "other",
  "confidence": <number between 0 and 1>,
  "extracted": {
    "plusOnes": <integer 0-5 or null>,
    "dietary": <short string or null>
  },
  "draftReply": "<2-4 sentence reply in Ghanaian-English, no markdown>"
}

DRAFT RULES:
- 2-4 short sentences. Warm, conversational, Ghanaian-English.
- Never make promises about logistics you don't know (venue change, dress code specifics). If the guest asks something you can't answer, draft a reply that says the couple will follow up.
- If the guest says yes and mentions a plus-one number, confirm warmly.
- If they say no, be gracious — never guilt-trip.
- Sign off naturally: "— the couple" or just no sign-off (couple will add their names).
- Never promise refunds or move money.
- Never invent vendor or guest names.`;

const outputSchema = z.object({
  intent: z.enum(["rsvp_yes", "rsvp_no", "rsvp_maybe", "dietary", "plus_one", "question", "other"]),
  confidence: z.number().min(0).max(1),
  extracted: z.object({
    plusOnes: z.number().int().min(0).max(5).nullable(),
    dietary: z.string().max(200).nullable(),
  }),
  draftReply: z.string().min(5).max(800),
});

export type RsvpAgentOutput = z.infer<typeof outputSchema>;

export interface AgentContext {
  inboundMessageId: string;
  eventId: string | null;
  brideName: string | null;
  groomName: string | null;
  guestDisplayName: string | null;
}

export async function classifyAndDraft(
  body: string,
  ctx: AgentContext,
): Promise<{ output: RsvpAgentOutput; source: "ai" | "template" }> {
  const e = env();
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    const out = templateClassify(body, ctx);
    await logInvocation({ status: "fallback", modelId: "template", eventId: ctx.eventId });
    return { output: out, source: "template" };
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: e.ANTHROPIC_MODEL_FAST,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Couple: ${ctx.brideName ?? "the couple"} & ${ctx.groomName ?? ""}
Guest: ${ctx.guestDisplayName ?? "(unknown)"}

Guest's message:
"""
${body}
"""

Reply with JSON only.`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text in response");
    const raw = block.text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = outputSchema.parse(JSON.parse(raw));
    await logInvocation({
      status: "ok",
      modelId: e.ANTHROPIC_MODEL_FAST,
      eventId: ctx.eventId,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs: Date.now() - start,
    });
    return { output: parsed, source: "ai" };
  } catch (err) {
    await logInvocation({
      status: "error",
      modelId: e.ANTHROPIC_MODEL_FAST,
      eventId: ctx.eventId,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    });
    return { output: templateClassify(body, ctx), source: "template" };
  }
}

// Deterministic classifier used when no Anthropic key is available.
// Crude but useful for local dev and for the dashboard to demo the flow.
export function templateClassify(body: string, ctx: AgentContext): RsvpAgentOutput {
  const text = body.toLowerCase().trim();
  const guest = ctx.guestDisplayName?.split(/\s+/)[0] ?? "there";

  let intent: RsvpAgentOutput["intent"] = "other";
  let confidence = 0.5;
  if (/\b(yes|yep|i('| a)?ll be there|count me in|attending|definitely|will be there)\b/.test(text)) {
    intent = "rsvp_yes";
    confidence = 0.85;
  } else if (/\b(no|can't|cant|won't|wont|sorry.*(miss|can'?t)|unable to attend)\b/.test(text)) {
    intent = "rsvp_no";
    confidence = 0.85;
  } else if (/\b(maybe|not sure|try to|hope to|might)\b/.test(text)) {
    intent = "rsvp_maybe";
    confidence = 0.75;
  } else if (/(vegetarian|vegan|gluten|halal|kosher|allerg|dietary)/.test(text)) {
    intent = "dietary";
    confidence = 0.85;
  } else if (/\+\s?1|plus one|bring (my )?(wife|husband|partner|girlfriend|boyfriend|friend)/.test(text)) {
    intent = "plus_one";
    confidence = 0.8;
  } else if (/\?$|\b(when|where|what time|dress code|hotel|parking|kids|children)\b/.test(text)) {
    intent = "question";
    confidence = 0.7;
  }

  const plusOneMatch = body.match(/\+\s?(\d)/);
  const plusOnes = plusOneMatch && plusOneMatch[1] ? Math.min(5, Number(plusOneMatch[1])) : null;

  let dietary: string | null = null;
  if (intent === "dietary") {
    const m = body.match(/(vegetarian|vegan|gluten[- ]free|halal|kosher|nut allerg(y|ic|ies))/i);
    dietary = m?.[0] ?? null;
  }

  const draftReply =
    intent === "rsvp_yes"
      ? `Wonderful, ${guest} — we're so glad you'll be with us. We'll be in touch closer to the day with the final details.`
      : intent === "rsvp_no"
        ? `Thank you for letting us know, ${guest}. We'll miss you but completely understand — we'll celebrate with you another time.`
        : intent === "rsvp_maybe"
          ? `Thanks ${guest} — we'll hold your place. When you're sure, just send another message and we'll update it.`
          : intent === "dietary"
            ? `Got it, ${guest} — we've noted ${dietary ?? "your dietary needs"} and we'll make sure the caterer takes care of it.`
            : intent === "plus_one"
              ? `Of course, ${guest} — we'll add ${plusOnes ? `+${plusOnes}` : "your plus one"} to your RSVP.`
              : intent === "question"
                ? `Hi ${guest} — great question. The couple will follow up with the answer shortly. Thank you for your patience!`
                : `Hi ${guest} — got your message, we'll reply shortly. Thank you!`;

  return {
    intent,
    confidence,
    extracted: { plusOnes, dietary },
    draftReply,
  };
}

interface LogP {
  status: "ok" | "error" | "fallback";
  modelId: string;
  eventId: string | null;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  error?: string;
}
async function logInvocation(p: LogP) {
  try {
    await db.aiInvocation.create({
      data: {
        eventId: p.eventId ?? undefined,
        feature: "rsvp_drafter",
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
