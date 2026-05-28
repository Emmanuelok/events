import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeGhPhone } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

const schema = z.object({
  phone: z.string().min(7),
  code: z.string().regex(/^\d{6}$/),
  displayName: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const phone = normalizeGhPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const result = await verifyOtp({ phone, code: parsed.data.code, purpose: "login" });
  if (!result.ok) {
    const message =
      result.error === "expired"
        ? "Code expired. Request a new one."
        : result.error === "exhausted"
          ? "Too many attempts. Request a new code."
          : result.error === "not_found"
            ? "No active code. Request a new one."
            : "Invalid code.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { phone } });
  const user =
    existing ??
    (await db.user.create({
      data: {
        phone,
        displayName: parsed.data.displayName,
        verifiedAt: new Date(),
      },
    }));
  if (existing && !existing.verifiedAt) {
    await db.user.update({ where: { id: existing.id }, data: { verifiedAt: new Date() } });
  }

  await createSession(user.id);
  return NextResponse.json({
    ok: true,
    firstTime: !existing,
    user: { id: user.id, phone: user.phone, displayName: user.displayName },
  });
}
