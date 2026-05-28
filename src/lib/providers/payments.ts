import nodeCrypto from "node:crypto";
import { env } from "@/lib/env";
import { paystackMomoProvider, type GiftChannel } from "@/lib/gifts";

export interface InitGiftIntentParams {
  amountMinor: number;
  feeMinor: number;
  guestPhone: string | null;
  guestName: string;
  eventId: string;
  reference: string;
  callbackUrl: string;
  channel: GiftChannel;
}

export interface InitGiftIntentResult {
  authorizationUrl: string;
  gatewayReference: string;
  provider: "paystack" | "mock";
}

export interface VerifiedWebhook {
  event: "charge.success" | "charge.failed" | string;
  reference: string;
  gatewayRef: string;
  status: "success" | "failed" | string;
  amountMinor: number;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  name(): "paystack" | "mock";
  initGiftIntent(p: InitGiftIntentParams): Promise<InitGiftIntentResult>;
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): VerifiedWebhook | null;
}

// ─── Mock ───
// Returns an authorization URL that points back at our own callback with
// status=success, so the local dev flow completes without hitting Paystack.
// Webhook verification is a no-op (we don't ship webhooks in mock mode).

class MockPaymentProvider implements PaymentProvider {
  name() {
    return "mock" as const;
  }
  async initGiftIntent(p: InitGiftIntentParams): Promise<InitGiftIntentResult> {
    const url = new URL(p.callbackUrl);
    url.searchParams.set("reference", p.reference);
    url.searchParams.set("mock", "1");
    return {
      authorizationUrl: url.toString(),
      gatewayReference: p.reference,
      provider: "mock",
    };
  }
  verifyWebhookSignature() {
    // Mock never receives real webhooks
    return false;
  }
  parseWebhook() {
    return null;
  }
}

// ─── Paystack ───

class PaystackPaymentProvider implements PaymentProvider {
  name() {
    return "paystack" as const;
  }

  async initGiftIntent(p: InitGiftIntentParams): Promise<InitGiftIntentResult> {
    const e = env();
    if (!e.PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY missing");

    const total = p.amountMinor + p.feeMinor;
    if (!Number.isInteger(total) || total <= 0) {
      throw new Error("initGiftIntent: invalid total");
    }

    // Synthesize an email (Paystack requires one). Use a domain that won't collide.
    const email = p.guestPhone
      ? `${p.guestPhone.replace("+", "")}@guest.celebrate.local`
      : `anon-${p.reference.toLowerCase()}@guest.celebrate.local`;

    const momoProvider = paystackMomoProvider(p.channel);
    const body: Record<string, unknown> = {
      amount: total,
      currency: "GHS",
      email,
      reference: p.reference,
      callback_url: p.callbackUrl,
      // Channels: cards always allowed; MoMo allowed when chosen
      channels: p.channel === "card" ? ["card"] : ["mobile_money"],
      metadata: {
        eventId: p.eventId,
        guestName: p.guestName,
        guestPhone: p.guestPhone,
        feeMinor: p.feeMinor,
        amountMinor: p.amountMinor,
        channel: p.channel,
      },
    };
    if (momoProvider) {
      body.mobile_money = {
        phone: p.guestPhone ? p.guestPhone.replace("+", "") : undefined,
        provider: momoProvider,
      };
    }

    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`Paystack init failed (${r.status}): ${text.slice(0, 300)}`);
    }
    const data = (await r.json()) as {
      status: boolean;
      data?: { authorization_url: string; reference: string };
    };
    if (!data.status || !data.data) throw new Error("Paystack returned no data");
    return {
      authorizationUrl: data.data.authorization_url,
      gatewayReference: data.data.reference,
      provider: "paystack",
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const e = env();
    if (!e.PAYSTACK_SECRET_KEY) return false;
    const expected = nodeCrypto
      .createHmac("sha512", e.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");
    if (expected.length !== signature.length) return false;
    try {
      return nodeCrypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: string): VerifiedWebhook | null {
    try {
      const parsed = JSON.parse(rawBody) as {
        event?: string;
        data?: {
          reference?: string;
          status?: string;
          amount?: number;
          id?: string | number;
        };
      };
      const ref = parsed.data?.reference;
      if (!parsed.event || !ref) return null;
      const isSuccess = parsed.event === "charge.success" || parsed.data?.status === "success";
      return {
        event: parsed.event,
        reference: ref,
        gatewayRef: ref,
        status: isSuccess ? "success" : (parsed.data?.status ?? "failed"),
        amountMinor: typeof parsed.data?.amount === "number" ? parsed.data.amount : 0,
        raw: parsed as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
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

// For test resets
export function _resetPaymentProviderCache() {
  cached = null;
}
