import nodeCrypto from "node:crypto";
import { env } from "@/lib/env";

export interface InitGiftIntentParams {
  amountMinor: number;
  feeMinor: number;
  guestPhone: string;
  guestName: string;
  eventId: string;
  reference: string;
  callbackUrl: string;
  channel: "momo_mtn" | "momo_telecel" | "momo_at" | "card";
}

export interface InitGiftIntentResult {
  authorizationUrl: string;
  gatewayReference: string;
}

export interface PaymentProvider {
  initGiftIntent(p: InitGiftIntentParams): Promise<InitGiftIntentResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  name(): string;
}

class MockPaymentProvider implements PaymentProvider {
  name() {
    return "mock";
  }
  async initGiftIntent(p: InitGiftIntentParams) {
    return {
      authorizationUrl: `${p.callbackUrl}?status=success&reference=${encodeURIComponent(p.reference)}`,
      gatewayReference: `mock-${p.reference}`,
    };
  }
  verifyWebhookSignature() {
    return true;
  }
}

class PaystackPaymentProvider implements PaymentProvider {
  name() {
    return "paystack";
  }
  async initGiftIntent(p: InitGiftIntentParams): Promise<InitGiftIntentResult> {
    const e = env();
    if (!e.PAYSTACK_SECRET_KEY) throw new Error("Paystack secret key missing");
    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: p.amountMinor + p.feeMinor,
        currency: "GHS",
        email: `${p.guestPhone.replace("+", "")}@guest.celebrate.local`,
        reference: p.reference,
        callback_url: p.callbackUrl,
        channels: ["mobile_money", "card"],
        metadata: {
          eventId: p.eventId,
          guestName: p.guestName,
          guestPhone: p.guestPhone,
          feeMinor: p.feeMinor,
        },
      }),
    });
    if (!r.ok) throw new Error(`Paystack init failed: ${r.status}`);
    const data = (await r.json()) as {
      data: { authorization_url: string; reference: string };
    };
    return {
      authorizationUrl: data.data.authorization_url,
      gatewayReference: data.data.reference,
    };
  }
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const e = env();
    if (!e.PAYSTACK_SECRET_KEY) return false;
    const expected = nodeCrypto
      .createHmac("sha512", e.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");
    if (expected.length !== signature.length) return false;
    return nodeCrypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached =
    env().PAYMENT_PROVIDER === "paystack"
      ? new PaystackPaymentProvider()
      : new MockPaymentProvider();
  return cached;
}
