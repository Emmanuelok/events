// Idempotent settle helper. Used by both the webhook and the verify-on-callback path.

import { db } from "@/lib/db";
import { canTransition, type IntentStatus } from "@/lib/gifts";
import { Prisma } from "@prisma/client";

export interface SettleResult {
  ok: boolean;
  from: IntentStatus;
  to: IntentStatus;
  giftId: string | null;
}

export async function settleGiftIntent(
  reference: string,
  to: IntentStatus,
  payload: Record<string, unknown> = {},
): Promise<SettleResult | null> {
  const intent = await db.giftIntent.findUnique({ where: { gatewayRef: reference } });
  if (!intent) return null;

  const from = intent.status as IntentStatus;
  if (!canTransition(from, to)) {
    return { ok: false, from, to, giftId: null };
  }
  if (from === to) {
    // Already in this state — idempotent no-op
    const existing = await db.gift.findUnique({ where: { giftIntentId: intent.id } });
    return { ok: true, from, to, giftId: existing?.id ?? null };
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.giftIntent.update({
      where: { id: intent.id },
      data: {
        status: to,
        settledAt: to === "succeeded" ? new Date() : intent.settledAt,
        reversedAt: to === "reversed" ? new Date() : intent.reversedAt,
        failureReason:
          to === "failed"
            ? typeof payload["failureReason"] === "string"
              ? (payload["failureReason"] as string)
              : "Gateway reported failure"
            : intent.failureReason,
        rawGatewayPayload: payload as Prisma.InputJsonValue,
      },
    });

    let giftId: string | null = null;
    if (to === "succeeded") {
      // Materialize the Gift row (idempotent via unique giftIntentId)
      const gift = await tx.gift.upsert({
        where: { giftIntentId: updated.id },
        update: {},
        create: {
          giftIntentId: updated.id,
          eventId: updated.eventId,
          amountMinor: updated.amountMinor,
          feeMinor: updated.feeMinor,
          guestName: updated.guestName,
          guestPhone: updated.guestPhone,
          channel: updated.channel,
          message: updated.message,
          isPublic: updated.isPublic,
        },
      });
      giftId = gift.id;
    }

    await tx.auditLog.create({
      data: {
        eventId: updated.eventId,
        action: `gift_intent.${to}`,
        target: updated.id,
        metadata: { from, to, gatewayRef: reference } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, from, to, giftId };
  });
}
