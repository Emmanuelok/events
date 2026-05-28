// Shared helper called by both the real Meta webhook and the local debug
// endpoint to ingest an inbound guest message, run the AI agent, and persist
// the AiDraft for organizer approval.

import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/phone";
import { classifyAndDraft } from "@/lib/ai/rsvp-agent";

export interface IngestInput {
  fromPhone: string;
  body: string;
  providerMessageId?: string;
  channel: "whatsapp" | "sms";
}

export async function ingestInboundMessage(input: IngestInput) {
  const phone = normalizeGhPhone(input.fromPhone) ?? input.fromPhone;

  // Dedupe by provider message id if available
  if (input.providerMessageId) {
    const dup = await db.inboundMessage.findUnique({
      where: { providerMessageId: input.providerMessageId },
    });
    if (dup) return { messageId: dup.id, deduped: true };
  }

  // Best-effort guest/event resolution: find the most recent guest whose phone
  // matches across all events.
  const guest = await db.guest.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
    include: { event: { select: { id: true, brideName: true, groomName: true } } },
  });

  const inbound = await db.inboundMessage.create({
    data: {
      eventId: guest?.eventId ?? null,
      guestId: guest?.id ?? null,
      fromPhone: phone,
      channel: input.channel,
      body: input.body,
      providerMessageId: input.providerMessageId,
    },
  });

  const { output, source } = await classifyAndDraft(input.body, {
    inboundMessageId: inbound.id,
    eventId: guest?.eventId ?? null,
    brideName: guest?.event.brideName ?? null,
    groomName: guest?.event.groomName ?? null,
    guestDisplayName: guest?.displayName ?? null,
  });

  await db.inboundMessage.update({
    where: { id: inbound.id },
    data: { intent: output.intent, intentConfidence: output.confidence },
  });

  await db.aiDraft.create({
    data: {
      inboundMessageId: inbound.id,
      draftBody: output.draftReply,
      modelId: source === "ai" ? "claude-sonnet-4-6" : "template",
      status: "pending",
    },
  });

  return { messageId: inbound.id, deduped: false, intent: output.intent };
}
