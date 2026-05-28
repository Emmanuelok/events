import { describe, it, expect, beforeEach, vi } from "vitest";
import nodeCrypto from "node:crypto";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

const baseEnv = {
  DATABASE_URL: "postgresql://x:y@localhost:5432/celebrate",
  SESSION_SECRET: "test-secret-test-secret-test-secret-1234",
};

describe("Mock payment provider", () => {
  it("returns a callback URL the dev flow can follow without leaving the app", async () => {
    for (const [k, v] of Object.entries(baseEnv)) vi.stubEnv(k, v);
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const mod = await import("./payments");
    const provider = mod.getPaymentProvider();
    expect(provider.name()).toBe("mock");
    const init = await provider.initGiftIntent({
      amountMinor: 10000,
      feeMinor: 200,
      guestPhone: "+233244000111",
      guestName: "Akua",
      eventId: "evt_1",
      reference: "GIFT-EVT001-AAAA1111",
      callbackUrl: "http://localhost:3000/e/ama-kwame/gift/callback",
      channel: "momo_mtn",
    });
    expect(init.authorizationUrl).toContain("/gift/callback");
    expect(init.authorizationUrl).toContain("reference=GIFT-EVT001-AAAA1111");
    expect(init.provider).toBe("mock");
  });

  it("refuses to verify any signature in mock mode", async () => {
    for (const [k, v] of Object.entries(baseEnv)) vi.stubEnv(k, v);
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    const mod = await import("./payments");
    const provider = mod.getPaymentProvider();
    expect(provider.verifyWebhookSignature("payload", "sig")).toBe(false);
  });
});

describe("Paystack signature verification", () => {
  it("accepts a correct HMAC-SHA512 signature and rejects a wrong one", async () => {
    for (const [k, v] of Object.entries(baseEnv)) vi.stubEnv(k, v);
    vi.stubEnv("PAYMENT_PROVIDER", "paystack");
    const secret = "sk_test_fake_secret_value";
    vi.stubEnv("PAYSTACK_SECRET_KEY", secret);

    const mod = await import("./payments");
    const provider = mod.getPaymentProvider();
    expect(provider.name()).toBe("paystack");

    const body = JSON.stringify({ event: "charge.success", data: { reference: "GIFT-X-1" } });
    const goodSig = nodeCrypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(provider.verifyWebhookSignature(body, goodSig)).toBe(true);

    const tampered = body.replace("success", "failed");
    expect(provider.verifyWebhookSignature(tampered, goodSig)).toBe(false);

    expect(provider.verifyWebhookSignature(body, "wrong")).toBe(false);
    expect(provider.verifyWebhookSignature(body, null)).toBe(false);
  });

  it("parses a charge.success webhook payload into our normalized shape", async () => {
    for (const [k, v] of Object.entries(baseEnv)) vi.stubEnv(k, v);
    vi.stubEnv("PAYMENT_PROVIDER", "paystack");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_anything");
    const mod = await import("./payments");
    const provider = mod.getPaymentProvider();

    const body = JSON.stringify({
      event: "charge.success",
      data: { reference: "GIFT-ABC-1", status: "success", amount: 10200 },
    });
    const parsed = provider.parseWebhook(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.reference).toBe("GIFT-ABC-1");
    expect(parsed!.status).toBe("success");
    expect(parsed!.amountMinor).toBe(10200);
  });

  it("returns null for unparseable bodies", async () => {
    for (const [k, v] of Object.entries(baseEnv)) vi.stubEnv(k, v);
    vi.stubEnv("PAYMENT_PROVIDER", "paystack");
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_anything");
    const mod = await import("./payments");
    const provider = mod.getPaymentProvider();
    expect(provider.parseWebhook("not json")).toBeNull();
    expect(provider.parseWebhook("{}")).toBeNull();
  });
});
