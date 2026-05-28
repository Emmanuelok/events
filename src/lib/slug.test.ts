import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Ama and Kwame")).toBe("ama-and-kwame");
  });
  it("strips accents", () => {
    expect(slugify("Naïve Café")).toBe("naive-cafe");
  });
  it("drops leading/trailing punctuation", () => {
    expect(slugify("--hello--world--")).toBe("hello-world");
  });
  it("returns empty for non-alphanumeric input", () => {
    expect(slugify("!!!@@@###")).toBe("");
  });
  it("truncates to 48 chars", () => {
    expect(slugify("a".repeat(100)).length).toBe(48);
  });
});
