// Internal-only: simulate an inbound message from a guest so the AI inbox
// works locally without Meta wiring. Available only to authed organizers; in
// production this stays useful for demos and QA.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { ingestInboundMessage } from "@/lib/messaging/ingest";

const schema = z.object({
  fromPhone: z.string().min(7),
  body: z.string().min(1).max(2000),
  channel: z.enum(["whatsapp", "sms"]).default("whatsapp"),
});

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Just confirm the event exists (the helper resolves guest by phone separately)
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const r = await ingestInboundMessage({
    fromPhone: parsed.data.fromPhone,
    body: parsed.data.body,
    channel: parsed.data.channel,
  });
  return NextResponse.json(r);
}
