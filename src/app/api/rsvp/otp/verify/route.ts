import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";

const schema = z.object({
  phone: z.string(),
  code: z.string().regex(/^\d{6}$/),
  slug: z.string(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const event = await db.event.findUnique({ where: { slug: parsed.data.slug } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const phone = normalizeGhPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const r = await verifyOtp({ phone, code: parsed.data.code, purpose: "rsvp" });
  if (!r.ok) {
    const msg =
      r.error === "expired"
        ? "Code expired. Try again."
        : r.error === "exhausted"
          ? "Too many attempts. Request a new code."
          : "Invalid code.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // If this phone is already on the guest list, return the name to pre-fill.
  const guest = await db.guest.findUnique({
    where: { eventId_phone: { eventId: event.id, phone } },
  });
  return NextResponse.json({
    ok: true,
    guest: guest ? { displayName: guest.displayName } : null,
  });
}
