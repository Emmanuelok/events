// Unified outbound send: tries WhatsApp first, falls back to SMS on failure
// or when the channel is explicitly SMS. Persists an OutboundMessage row per
// attempt so the dashboard always reflects reality.

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getWhatsAppProvider } from "@/lib/providers/whatsapp";
import { getSmsProvider } from "@/lib/providers/sms";
import { renderTemplate, type TemplateKey, type TemplateVars } from "./templates";

export interface SendInvitationParams {
  eventId: string;
  guestId: string;
  toPhone: string;
  channelPreference: "whatsapp" | "sms" | "auto";
  templateKey: TemplateKey;
  vars: TemplateVars;
}

export interface SendResult {
  ok: boolean;
  messageId: string | null;
  channel: "whatsapp" | "sms";
  provider: string;
  fallback: boolean;
  error?: string;
}

export async function sendInvitation(p: SendInvitationParams): Promise<SendResult> {
  const preference: "whatsapp" | "sms" = p.channelPreference === "sms" ? "sms" : "whatsapp";

  if (preference === "whatsapp") {
    const body = renderTemplate(p.templateKey, "whatsapp", p.vars);
    const wa = getWhatsAppProvider();
    const out = await db.outboundMessage.create({
      data: {
        eventId: p.eventId,
        guestId: p.guestId,
        toPhone: p.toPhone,
        channel: "whatsapp",
        templateKey: p.templateKey,
        body,
        status: "queued",
        provider: wa.name(),
      },
    });
    const r = await wa.send({ to: p.toPhone, body });
    if (r.ok) {
      await db.outboundMessage.update({
        where: { id: out.id },
        data: { status: "sent", sentAt: new Date(), providerMessageId: r.messageId },
      });
      return { ok: true, messageId: r.messageId, channel: "whatsapp", provider: wa.name(), fallback: false };
    }
    await db.outboundMessage.update({
      where: { id: out.id },
      data: { status: "failed", failureReason: r.error },
    });
    // Auto-fallback to SMS unless the caller specifically asked for WhatsApp only.
    if (p.channelPreference === "whatsapp") {
      return { ok: false, messageId: null, channel: "whatsapp", provider: wa.name(), fallback: false, error: r.error };
    }
  }

  // SMS path (either by preference or as WA fallback)
  const body = renderTemplate(p.templateKey, "sms", p.vars);
  const sms = getSmsProvider();
  const out = await db.outboundMessage.create({
    data: {
      eventId: p.eventId,
      guestId: p.guestId,
      toPhone: p.toPhone,
      channel: "sms",
      templateKey: p.templateKey,
      body,
      status: "queued",
      provider: sms.name(),
    },
  });
  const r = await sms.send({ to: p.toPhone, body });
  if (r.ok) {
    await db.outboundMessage.update({
      where: { id: out.id },
      data: { status: "sent", sentAt: new Date(), providerMessageId: r.messageId },
    });
    return {
      ok: true,
      messageId: r.messageId,
      channel: "sms",
      provider: sms.name(),
      fallback: preference === "whatsapp",
    };
  }
  await db.outboundMessage.update({
    where: { id: out.id },
    data: { status: "failed", failureReason: r.error },
  });
  return {
    ok: false,
    messageId: null,
    channel: "sms",
    provider: sms.name(),
    fallback: preference === "whatsapp",
    error: r.error,
  };
}

export function buildVars(opts: {
  brideName: string | null;
  groomName: string | null;
  eventDate: Date;
  city: string;
  slug: string;
  guestShortCode: string;
  guestDisplayName: string;
}): TemplateVars {
  const appUrl = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return {
    brideName: opts.brideName ?? "The couple",
    groomName: opts.groomName ?? "",
    eventDateLine: opts.eventDate.toLocaleDateString("en-GH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    eventCity: opts.city,
    rsvpLink: `${appUrl}/r/${opts.guestShortCode}`,
    giftLink: `${appUrl}/e/${opts.slug}/gift`,
    guestFirstName: opts.guestDisplayName.split(/\s+/)[0] || opts.guestDisplayName,
  };
}
