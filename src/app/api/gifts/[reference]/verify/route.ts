// POST /api/gifts/[reference]/verify — called by the callback page to confirm settlement.
// In mock mode (no real Paystack), we mark as succeeded directly. With Paystack,
// we hit /transaction/verify and only settle on a real success.

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { settleGiftIntent } from "@/lib/gifts-settle";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const intent = await db.giftIntent.findUnique({ where: { gatewayRef: reference } });
  if (!intent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const e = env();

  // Mock mode: trust the callback. (Webhooks are bypassed in dev.)
  if (intent.gateway === "mock" || e.PAYMENT_PROVIDER !== "paystack") {
    const result = await settleGiftIntent(reference, "succeeded", { source: "mock_callback" });
    return NextResponse.json({ status: result?.to ?? intent.status });
  }

  // Paystack verify
  if (!e.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Paystack key missing" }, { status: 500 });
  }
  const r = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${e.PAYSTACK_SECRET_KEY}` } },
  );
  if (!r.ok) {
    return NextResponse.json({ error: `Paystack verify failed: ${r.status}` }, { status: 502 });
  }
  const data = (await r.json()) as {
    status: boolean;
    data?: { status?: string; amount?: number };
  };
  const success = data.status && data.data?.status === "success";
  const toStatus = success ? "succeeded" : "failed";
  const result = await settleGiftIntent(reference, toStatus, {
    source: "paystack_verify",
    raw: data,
    failureReason: success ? undefined : "Paystack verify did not return success",
  });
  return NextResponse.json({ status: result?.to ?? intent.status });
}
