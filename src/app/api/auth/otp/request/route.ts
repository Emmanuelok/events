import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeGhPhone } from "@/lib/phone";
import { sendOtp } from "@/lib/otp";

const schema = z.object({ phone: z.string().min(7) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const phone = normalizeGhPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "Please enter a valid Ghana phone number" },
      { status: 400 },
    );
  }
  const ip = req.headers.get("x-forwarded-for") ?? undefined;
  const result = await sendOtp({ phone, purpose: "login", ip });
  if (!result.ok) {
    if (result.error === "rate_limited") {
      return NextResponse.json(
        { error: "Too many code requests. Try again in a few minutes." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Could not send code. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, devCode: result.devCode });
}
