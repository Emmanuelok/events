// POST /api/events/[eventId]/gifts/[giftId]/thank-you
//   { action: "draft" | "mark_sent", text?: string }
// - "draft": ask Claude to draft a thank-you. Returns the text and persists it.
// - "mark_sent": record that the couple has sent the thank-you (manually for now).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { draftThankYou } from "@/lib/ai/thank-you";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft") }),
  z.object({
    action: z.literal("mark_sent"),
    method: z.enum(["whatsapp", "sms", "manual"]).default("manual"),
    text: z.string().max(2000).optional(),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ eventId: string; giftId: string }> },
) {
  const { eventId, giftId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const gift = await db.gift.findFirst({
    where: { id: giftId, eventId },
    include: { event: true },
  });
  if (!gift) return NextResponse.json({ error: "Gift not found" }, { status: 404 });

  if (parsed.data.action === "draft") {
    const result = await draftThankYou(
      {
        brideName: gift.event.brideName ?? gift.event.title.split("&")[0]?.trim() ?? "We",
        groomName: gift.event.groomName ?? gift.event.title.split("&")[1]?.trim() ?? "",
        guestName: gift.guestName,
        amountMinor: gift.amountMinor,
        guestMessage: gift.message,
      },
      { eventId, userId: user.id, giftId },
    );
    return NextResponse.json({ text: result.text, source: result.source });
  }

  // mark_sent
  await db.gift.update({
    where: { id: gift.id },
    data: {
      thankedAt: new Date(),
      thankYouMethod: parsed.data.method,
      thankYouDraft: parsed.data.text ?? gift.thankYouDraft,
    },
  });
  await db.auditLog.create({
    data: {
      eventId,
      actorUserId: user.id,
      action: "gift.thanked",
      target: gift.id,
      metadata: { method: parsed.data.method },
    },
  });
  return NextResponse.json({ ok: true });
}
