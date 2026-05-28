import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/phone";
import { sendOtp } from "@/lib/otp";

const schema = z.object({ phone: z.string(), slug: z.string() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const event = await db.event.findUnique({ where: { slug: parsed.data.slug } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const phone = normalizeGhPhone(parsed.data.phone);
  if (!phone) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const result = await sendOtp({ phone, purpose: "rsvp" });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error === "rate_limited"
            ? "Too many requests. Try again later."
            : "Could not send code.",
      },
      { status: result.error === "rate_limited" ? 429 : 502 },
    );
  }
  return NextResponse.json({ ok: true, devCode: result.devCode });
}
