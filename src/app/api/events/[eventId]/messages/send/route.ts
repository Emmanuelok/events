// POST /api/events/[eventId]/messages/send
// Body: { templateKey, channelPreference, guestIds?: string[], all?: boolean }
// - If `all` is true, sends to every guest that doesn't already have a recent
//   send of the same template (per-template idempotency by 24h cooldown).
// - Otherwise sends to the explicit guestIds.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { sendInvitation, buildVars } from "@/lib/messaging/send";
import { TEMPLATE_KEYS } from "@/lib/messaging/templates";

const schema = z
  .object({
    templateKey: z.enum(TEMPLATE_KEYS as [string, ...string[]]),
    channelPreference: z.enum(["whatsapp", "sms", "auto"]).default("auto"),
    guestIds: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.all || (v.guestIds && v.guestIds.length > 0), {
    message: "Provide guestIds[] or all=true",
  });

const COOLDOWN_HOURS = 24;

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      city: true,
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const guests = parsed.data.all
    ? await db.guest.findMany({ where: { eventId } })
    : await db.guest.findMany({
        where: { eventId, id: { in: parsed.data.guestIds ?? [] } },
      });

  // Cooldown filter: skip any guest that received the same template in the last 24h.
  const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const recent = await db.outboundMessage.findMany({
    where: {
      eventId,
      templateKey: parsed.data.templateKey,
      sentAt: { gte: since },
      guestId: { in: guests.map((g) => g.id) },
    },
    select: { guestId: true },
  });
  const recentSet = new Set(recent.map((r) => r.guestId));
  const targets = guests.filter((g) => !recentSet.has(g.id));

  const results: { guestId: string; ok: boolean; channel: string; provider: string; fallback: boolean }[] = [];
  for (const g of targets) {
    const vars = buildVars({
      brideName: event.brideName,
      groomName: event.groomName,
      eventDate: event.eventDate,
      city: event.city,
      slug: event.slug,
      guestShortCode: g.shortCode,
      guestDisplayName: g.displayName,
    });
    const r = await sendInvitation({
      eventId,
      guestId: g.id,
      toPhone: g.phone,
      channelPreference: parsed.data.channelPreference,
      templateKey: parsed.data.templateKey as never,
      vars,
    });
    results.push({
      guestId: g.id,
      ok: r.ok,
      channel: r.channel,
      provider: r.provider,
      fallback: r.fallback,
    });
  }

  return NextResponse.json({
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: guests.length - targets.length,
    results,
  });
}
