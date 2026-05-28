import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/phone";
import { generateShortCode } from "@/lib/crypto";

const schema = z.object({
  eventId: z.string(),
  phone: z.string(),
  displayName: z.string().min(1).max(120),
  status: z.enum(["yes", "no", "maybe"]),
  plusOnes: z.number().int().min(0).max(5).default(0),
  dietary: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const phone = normalizeGhPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Invalid phone" }, { status: 400 });

  const event = await db.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // The phone must have a recently consumed OTP for purpose=rsvp.
  const verified = await db.otpRequest.findFirst({
    where: {
      phone,
      purpose: "rsvp",
      consumedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
  });
  if (!verified) {
    return NextResponse.json({ error: "Phone not verified" }, { status: 403 });
  }

  const guest = await db.guest.upsert({
    where: { eventId_phone: { eventId: event.id, phone } },
    update: { displayName: parsed.data.displayName },
    create: {
      eventId: event.id,
      phone,
      displayName: parsed.data.displayName,
      invitedVia: "link",
      shortCode: generateShortCode(),
    },
  });

  await db.rsvp.upsert({
    where: { guestId: guest.id },
    update: {
      status: parsed.data.status,
      plusOnes: parsed.data.plusOnes,
      dietary: parsed.data.dietary,
      message: parsed.data.message,
      channel: "web",
      respondedAt: new Date(),
    },
    create: {
      guestId: guest.id,
      eventId: event.id,
      status: parsed.data.status,
      plusOnes: parsed.data.plusOnes,
      dietary: parsed.data.dietary,
      message: parsed.data.message,
      channel: "web",
      respondedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
