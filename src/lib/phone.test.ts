import { describe, it, expect } from "vitest";
import { normalizeGhPhone, isE164Gh } from "./phone";

describe("normalizeGhPhone", () => {
  it("accepts local 10-digit numbers starting with 0", () => {
    expect(normalizeGhPhone("0244123456")).toBe("+233244123456");
    expect(normalizeGhPhone("0501234567")).toBe("+233501234567");
  });

  it("accepts already-international +233 form", () => {
    expect(normalizeGhPhone("+233244123456")).toBe("+233244123456");
    expect(normalizeGhPhone("233244123456")).toBe("+233244123456");
  });

  it("strips spaces, dashes, parentheses", () => {
    expect(normalizeGhPhone("0244 123 456")).toBe("+233244123456");
    expect(normalizeGhPhone("024-412-3456")).toBe("+233244123456");
  });

  it("rejects numbers that aren't Ghana mobile/landline-3", () => {
    expect(normalizeGhPhone("0144123456")).toBeNull();
    expect(normalizeGhPhone("abc")).toBeNull();
    expect(normalizeGhPhone("")).toBeNull();
    expect(normalizeGhPhone("+1 415 555 0100")).toBeNull();
  });

  it("isE164Gh matches the normalized output", () => {
    expect(isE164Gh("+233244123456")).toBe(true);
    expect(isE164Gh("0244123456")).toBe(false);
  });
});
