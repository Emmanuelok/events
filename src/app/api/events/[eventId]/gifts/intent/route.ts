// POST /api/events/[eventId]/gifts/intent
// Creates an idempotent gift intent and returns an authorization URL to redirect the guest to.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { normalizeGhPhone } from "@/lib/phone";
import { clampGiftAmountMinor, quoteGift, GIFT_CHANNELS } from "@/lib/gifts";
import { generateGiftRef } from "@/lib/gifts-server";
import { getPaymentProvider } from "@/lib/providers/payments";

const schema = z.object({
  amountMinor: z.number().int().positive(),
  channel: z.enum(GIFT_CHANNELS),
  guestName: z.string().min(1).max(80),
  guestPhone: z.string().optional(),
  message: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  idempotencyKey: z.string().min(8).max(80), // client supplies; we de-dupe on it
});

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Amount guardrails
  const clamped = clampGiftAmountMinor(parsed.data.amountMinor);
  if (!clamped.ok) {
    return NextResponse.json(
      {
        error:
          clamped.reason === "too_small"
            ? "Minimum gift is GHS 5."
            : clamped.reason === "too_large"
              ? "For gifts above GHS 50,000, please contact the couple directly."
              : "Invalid amount.",
      },
      { status: 400 },
    );
  }

  const guestPhone = parsed.data.guestPhone ? normalizeGhPhone(parsed.data.guestPhone) : null;
  if (parsed.data.guestPhone && !guestPhone) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  // Idempotency: if the same key was used before, return the existing intent.
  const existing = await db.giftIntent.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (existing) {
    return NextResponse.json({
      reference: existing.gatewayRef,
      authorizationUrl: existing.authorizationUrl,
      status: existing.status,
      amountMinor: existing.amountMinor,
      feeMinor: existing.feeMinor,
      totalMinor: existing.totalMinor,
      reused: true,
    });
  }

  const quote = quoteGift(clamped.amountMinor);
  const reference = generateGiftRef(event.id);

  const provider = getPaymentProvider();
  const appUrl = env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const callbackUrl = `${appUrl}/e/${event.slug}/gift/callback`;

  let init;
  try {
    init = await provider.initGiftIntent({
      amountMinor: quote.amountMinor,
      feeMinor: quote.feeMinor,
      guestPhone,
      guestName: parsed.data.guestName,
      eventId: event.id,
      reference,
      callbackUrl,
      channel: parsed.data.channel,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not initialize payment" },
      { status: 502 },
    );
  }

  const intent = await db.giftIntent.create({
    data: {
      eventId: event.id,
      guestPhone,
      guestName: parsed.data.guestName,
      amountMinor: quote.amountMinor,
      feeMinor: quote.feeMinor,
      totalMinor: quote.totalMinor,
      channel: parsed.data.channel,
      status: "initiated",
      gateway: init.provider,
      gatewayRef: init.gatewayReference,
      idempotencyKey: parsed.data.idempotencyKey,
      authorizationUrl: init.authorizationUrl,
      message: parsed.data.message ?? null,
      isPublic: parsed.data.isPublic,
    },
  });

  await db.auditLog.create({
    data: {
      eventId: event.id,
      action: "gift_intent.created",
      target: intent.id,
      metadata: {
        amountMinor: quote.amountMinor,
        feeMinor: quote.feeMinor,
        channel: parsed.data.channel,
        gateway: init.provider,
      },
    },
  });

  return NextResponse.json({
    reference: intent.gatewayRef,
    authorizationUrl: intent.authorizationUrl,
    status: intent.status,
    amountMinor: intent.amountMinor,
    feeMinor: intent.feeMinor,
    totalMinor: intent.totalMinor,
    reused: false,
  });
}
