import { describe, it, expect } from "vitest";
import {
  paystackMomoProvider,
  clampGiftAmountMinor,
  quoteGift,
  canTransition,
  MIN_GIFT_MINOR,
  MAX_GIFT_MINOR,
} from "./gifts";
import { generateGiftRef } from "./gifts-server";
import { giftFeeMinor } from "./money";

describe("paystackMomoProvider mapping", () => {
  it("maps channels to Paystack's expected provider codes", () => {
    expect(paystackMomoProvider("momo_mtn")).toBe("mtn");
    expect(paystackMomoProvider("momo_telecel")).toBe("vod");
    expect(paystackMomoProvider("momo_at")).toBe("atl");
  });
  it("returns null for card (no mobile_money block needed)", () => {
    expect(paystackMomoProvider("card")).toBeNull();
  });
});

describe("clampGiftAmountMinor", () => {
  it("accepts amounts within the allowed band", () => {
    const ok = clampGiftAmountMinor(50000); // GHS 500
    expect(ok.ok).toBe(true);
  });
  it("rejects too-small amounts", () => {
    const r = clampGiftAmountMinor(MIN_GIFT_MINOR - 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_small");
  });
  it("rejects too-large amounts", () => {
    const r = clampGiftAmountMinor(MAX_GIFT_MINOR + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("too_large");
  });
  it("rejects non-integer amounts", () => {
    const r = clampGiftAmountMinor(100.5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_integer");
  });
});

describe("generateGiftRef", () => {
  it("produces unique refs across calls", () => {
    const refs = new Set<string>();
    const eventId = "cmppar5ss00057dvfej9fkbth";
    for (let i = 0; i < 100; i++) refs.add(generateGiftRef(eventId));
    expect(refs.size).toBe(100);
  });
  it("encodes a hint of the event id in the ref", () => {
    const eventId = "cmppar5ss00057dvfej9fkbth";
    const ref = generateGiftRef(eventId);
    expect(ref.startsWith("GIFT-")).toBe(true);
    expect(ref).toContain(eventId.slice(-6).toUpperCase());
  });
});

describe("quoteGift", () => {
  it("agrees with the money helpers for fee and total", () => {
    const q = quoteGift(10000); // GHS 100
    expect(q.feeMinor).toBe(giftFeeMinor(10000));
    expect(q.totalMinor).toBe(10000 + q.feeMinor);
  });
});

describe("canTransition state machine", () => {
  it("allows initiated -> authorized/succeeded/failed", () => {
    expect(canTransition("initiated", "authorized")).toBe(true);
    expect(canTransition("initiated", "succeeded")).toBe(true);
    expect(canTransition("initiated", "failed")).toBe(true);
  });
  it("allows authorized -> succeeded/failed", () => {
    expect(canTransition("authorized", "succeeded")).toBe(true);
    expect(canTransition("authorized", "failed")).toBe(true);
  });
  it("allows succeeded -> reversed only", () => {
    expect(canTransition("succeeded", "reversed")).toBe(true);
    expect(canTransition("succeeded", "failed")).toBe(false);
  });
  it("treats failed and reversed as terminal", () => {
    expect(canTransition("failed", "succeeded")).toBe(false);
    expect(canTransition("reversed", "succeeded")).toBe(false);
  });
  it("treats same-state as idempotent (no-op allowed)", () => {
    expect(canTransition("succeeded", "succeeded")).toBe(true);
    expect(canTransition("failed", "failed")).toBe(true);
  });
});
