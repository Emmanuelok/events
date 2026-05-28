// POST /api/webhooks/paystack — signed Paystack webhook.
// We verify the HMAC-SHA512 signature before any DB write. Idempotent.

import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/providers/payments";
import { settleGiftIntent } from "@/lib/gifts-settle";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const provider = getPaymentProvider();
  // Even in mock mode we accept POSTs so contract tests can hit the route — but we won't act.
  if (provider.name() !== "paystack") {
    return NextResponse.json({ ok: true, note: "provider not paystack; ignored" });
  }

  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhook(rawBody);
  if (!event) return NextResponse.json({ error: "Unparseable" }, { status: 400 });

  let to: "succeeded" | "failed";
  if (event.status === "success") to = "succeeded";
  else to = "failed";

  const result = await settleGiftIntent(event.reference, to, {
    source: "paystack_webhook",
    event: event.event,
    raw: event.raw,
  });

  if (!result) {
    // Unknown reference — log and ack so Paystack stops retrying.
    await db.auditLog.create({
      data: {
        action: "webhook.paystack.unknown_reference",
        metadata: { reference: event.reference, status: event.status },
      },
    });
    return NextResponse.json({ ok: true, note: "unknown reference" });
  }

  return NextResponse.json({ ok: true, status: result.to });
}
