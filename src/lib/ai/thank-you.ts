// Claude Sonnet 4.6 drafts a warm Ghanaian-English thank-you for a gift.
// Used by the couple's dashboard. They approve / edit / send.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { formatGhs } from "@/lib/money";

const SYSTEM_PROMPT = `You write WhatsApp-style thank-you messages on behalf of a Ghanaian couple to a guest who has just sent them a MoMo cash gift.

RULES:
- 2-4 short sentences. Warm, sincere, conversational Ghanaian-English.
- Do not use American idioms or 'y'all'.
- Mention the gift amount naturally — never robotically (avoid "Thank you for the GHS 500"). Better: "Your generosity overwhelmed us" or "What a thoughtful gift — thank you."
- If the guest left a message, acknowledge it. If not, don't pretend they did.
- Always sign off naturally with both first names (e.g. "Ama & Kwame").
- Never make promises, never request more money, never offer refunds.
- Output ONLY the message text, no quotes, no preamble.`;

export interface ThankYouContext {
  brideName: string;
  groomName: string;
  guestName: string;
  amountMinor: number;
  guestMessage: string | null;
}

export async function draftThankYou(
  ctx: ThankYouContext,
  meta: { eventId: string; userId: string; giftId: string },
): Promise<{ text: string; source: "ai" | "template" }> {
  const e = env();
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    return { text: templateThankYou(ctx), source: "template" };
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: e.ANTHROPIC_MODEL_FAST,
      max_tokens: 350,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Draft a thank-you to:
- Guest name: ${ctx.guestName}
- Gift amount: ${formatGhs(ctx.amountMinor)}
- Guest's own message: ${ctx.guestMessage ? `"${ctx.guestMessage}"` : "(none)"}
- From: ${ctx.brideName} & ${ctx.groomName}

Reply with only the message text.`,
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const text = block.text.trim();

    // Persist draft on the gift
    await db.gift.update({
      where: { id: meta.giftId },
      data: { thankYouDraft: text },
    });

    await db.aiInvocation.create({
      data: {
        eventId: meta.eventId,
        userId: meta.userId,
        feature: "thank_you_drafter",
        modelId: e.ANTHROPIC_MODEL_FAST,
        status: "ok",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs: Date.now() - start,
      },
    });

    return { text, source: "ai" };
  } catch (err) {
    await db.aiInvocation.create({
      data: {
        eventId: meta.eventId,
        userId: meta.userId,
        feature: "thank_you_drafter",
        modelId: e.ANTHROPIC_MODEL_FAST,
        status: "error",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return { text: templateThankYou(ctx), source: "template" };
  }
}

export function templateThankYou(ctx: ThankYouContext): string {
  const first = ctx.guestName.split(/\s+/)[0] || ctx.guestName;
  const ack = ctx.guestMessage
    ? "Your words touched us deeply"
    : "Your kindness means so much to us";
  return `${first}, what a beautiful surprise — ${ack}. Thank you for sharing this moment with us. We can't wait to celebrate with you in person.\n\nWith love,\n${ctx.brideName} & ${ctx.groomName}`;
}
