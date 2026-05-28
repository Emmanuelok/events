import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/phone";
import { generateShortCode } from "@/lib/crypto";

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  phone: z.string().min(7),
  groupTag: z.string().max(80).optional(),
  plusOnesAllowed: z.number().int().min(0).max(5).default(0),
  invitedVia: z.enum(["whatsapp", "sms", "email", "link"]).default("whatsapp"),
});

const bulkSchema = z.object({ guests: z.array(createSchema).min(1).max(500) });

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const guests = await db.guest.findMany({
    where: { eventId },
    include: { rsvp: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ guests });
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);

  // Accept either a single guest or { guests: [...] }
  const bulk = bulkSchema.safeParse(body);
  const single = createSchema.safeParse(body);
  if (!bulk.success && !single.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const incoming = bulk.success ? bulk.data.guests : [single.data!];

  const created: { id: string; phone: string }[] = [];
  const errors: { phone: string; reason: string }[] = [];

  for (const g of incoming) {
    const phone = normalizeGhPhone(g.phone);
    if (!phone) {
      errors.push({ phone: g.phone, reason: "invalid_phone" });
      continue;
    }
    const existing = await db.guest.findUnique({
      where: { eventId_phone: { eventId, phone } },
    });
    if (existing) {
      errors.push({ phone, reason: "duplicate" });
      continue;
    }
    const guest = await db.guest.create({
      data: {
        eventId,
        phone,
        displayName: g.displayName,
        groupTag: g.groupTag,
        plusOnesAllowed: g.plusOnesAllowed,
        invitedVia: g.invitedVia,
        shortCode: generateShortCode(),
      },
    });
    created.push({ id: guest.id, phone });
  }

  return NextResponse.json({ created: created.length, errors });
}
