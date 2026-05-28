import { describe, it, expect } from "vitest";
import { ghsToMinor, minorToGhs, formatGhs, giftFeeMinor, totalWithFeeMinor } from "./money";

describe("money helpers", () => {
  it("converts GHS to pesewas using integer math", () => {
    expect(ghsToMinor(1)).toBe(100);
    expect(ghsToMinor(123.45)).toBe(12345);
    expect(ghsToMinor(0.1 + 0.2)).toBe(30); // floating-point safe via rounding
  });

  it("converts pesewas to GHS as a number", () => {
    expect(minorToGhs(100)).toBe(1);
    expect(minorToGhs(12345)).toBe(123.45);
  });

  it("throws if minorToGhs receives a non-integer", () => {
    expect(() => minorToGhs(1.5)).toThrow();
  });

  it("formats GHS amounts using en-GH locale", () => {
    const out = formatGhs(12345);
    expect(out).toContain("123.45");
    expect(out.toUpperCase()).toContain("GH");
  });

  it("computes gift fees as 1.5% + 50 pesewas, capped at GHS 50", () => {
    expect(giftFeeMinor(0)).toBe(50); // fixed only
    // 1.5% of 10000 (GHS 100) = 150 pesewas + 50 = 200
    expect(giftFeeMinor(10000)).toBe(200);
    // Cap kicks in at very large gifts
    expect(giftFeeMinor(10_000_000)).toBe(5000);
  });

  it("rejects negative or non-integer amounts in giftFeeMinor", () => {
    expect(() => giftFeeMinor(-1)).toThrow();
    expect(() => giftFeeMinor(1.5)).toThrow();
  });

  it("returns total = amount + fee", () => {
    expect(totalWithFeeMinor(10000)).toBe(10000 + giftFeeMinor(10000));
  });
});
