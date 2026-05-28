import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { sendInvitation, buildVars } from "@/lib/messaging/send";

const approveSchema = z.object({
  action: z.literal("approve"),
  body: z.string().min(1).max(2000),
  applyExtracted: z.boolean().default(true),
});

const rejectSchema = z.object({
  action: z.literal("reject"),
  reason: z.string().max(500).optional(),
});

const schema = z.discriminatedUnion("action", [approveSchema, rejectSchema]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string; draftId: string }> },
) {
  const { eventId, draftId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const draft = await db.aiDraft.findUnique({
    where: { id: draftId },
    include: {
      inboundMessage: {
        include: {
          guest: true,
          event: true,
        },
      },
    },
  });
  if (!draft || draft.inboundMessage.eventId !== eventId) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (draft.status !== "pending") {
    return NextResponse.json({ error: "Already handled" }, { status: 409 });
  }

  if (parsed.data.action === "reject") {
    await db.aiDraft.update({
      where: { id: draft.id },
      data: { status: "rejected", rejectedReason: parsed.data.reason, approverUserId: user.id, approvedAt: new Date() },
    });
    await db.inboundMessage.update({
      where: { id: draft.inboundMessageId },
      data: { handledByUserId: user.id, handledAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  // Approve: send the (possibly edited) body via the same channel that received it.
  const inbound = draft.inboundMessage;
  const guest = inbound.guest;
  const event = inbound.event;
  if (!event || !guest) {
    return NextResponse.json(
      { error: "Cannot send: original guest/event not found" },
      { status: 400 },
    );
  }

  // Apply structured updates iff intent + extracted look usable
  if (parsed.data.applyExtracted && inbound.intent) {
    const intent = inbound.intent;
    if (intent === "rsvp_yes" || intent === "rsvp_no" || intent === "rsvp_maybe") {
      const status = intent === "rsvp_yes" ? "yes" : intent === "rsvp_no" ? "no" : "maybe";
      await db.rsvp.upsert({
        where: { guestId: guest.id },
        update: { status, channel: inbound.channel === "whatsapp" ? "whatsapp" : "sms", respondedAt: new Date() },
        create: {
          guestId: guest.id,
          eventId: event.id,
          status,
          channel: inbound.channel === "whatsapp" ? "whatsapp" : "sms",
          respondedAt: new Date(),
        },
      });
    }
  }

  // Build a custom outbound row that uses the approved body directly.
  const out = await db.outboundMessage.create({
    data: {
      eventId: event.id,
      guestId: guest.id,
      toPhone: guest.phone,
      channel: inbound.channel,
      templateKey: "rsvp_reply",
      body: parsed.data.body,
      status: "queued",
      provider: "pending",
    },
  });

  // Reuse the same channel-aware send helper indirectly by calling providers via
  // sendInvitation with a one-off custom template. Easier: just call providers directly.
  const vars = buildVars({
    brideName: event.brideName,
    groomName: event.groomName,
    eventDate: event.eventDate,
    city: event.city,
    slug: event.slug,
    guestShortCode: guest.shortCode,
    guestDisplayName: guest.displayName,
  });
  // We send via sendInvitation for consistency, but the body comes from the
  // approved draft rather than a template render. Use save_the_date as the
  // template key for the bookkeeping row (it won't be rendered since we
  // bypass via a direct provider call below).
  const _vars = vars; void _vars;

  // Direct provider send using the approved text
  const { getWhatsAppProvider } = await import("@/lib/providers/whatsapp");
  const { getSmsProvider } = await import("@/lib/providers/sms");
  let result;
  if (inbound.channel === "whatsapp") {
    const wa = getWhatsAppProvider();
    result = await wa.send({ to: guest.phone, body: parsed.data.body });
    await db.outboundMessage.update({
      where: { id: out.id },
      data: {
        provider: wa.name(),
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? new Date() : null,
        providerMessageId: result.ok ? result.messageId : null,
        failureReason: result.ok ? null : result.error,
      },
    });
  } else {
    const sms = getSmsProvider();
    result = await sms.send({ to: guest.phone, body: parsed.data.body });
    await db.outboundMessage.update({
      where: { id: out.id },
      data: {
        provider: sms.name(),
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? new Date() : null,
        providerMessageId: result.ok ? result.messageId : null,
        failureReason: result.ok ? null : result.error,
      },
    });
  }

  await db.aiDraft.update({
    where: { id: draft.id },
    data: {
      draftBody: parsed.data.body,
      status: result.ok ? "approved" : "pending",
      approverUserId: user.id,
      approvedAt: new Date(),
      sentOutboundMessageId: out.id,
    },
  });

  await db.inboundMessage.update({
    where: { id: draft.inboundMessageId },
    data: { handledByUserId: user.id, handledAt: new Date() },
  });

  return NextResponse.json({ ok: result.ok, error: result.ok ? undefined : ("error" in result ? result.error : undefined) });
}
