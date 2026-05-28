import { describe, it, expect } from "vitest";
import { TEMPLATE_LIST, TEMPLATES, getTemplate } from "./templates";

describe("template registry", () => {
  it("has three templates with unique ids", () => {
    expect(TEMPLATE_LIST).toHaveLength(3);
    const ids = TEMPLATE_LIST.map((t) => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("every palette field is a non-empty string", () => {
    for (const t of TEMPLATE_LIST) {
      for (const [k, v] of Object.entries(t.palette)) {
        expect(v, `template ${t.id} palette.${k}`).toMatch(/.+/);
      }
    }
  });

  it("getTemplate returns adinkra for unknown ids (safe fallback)", () => {
    expect(getTemplate("not-a-real-template").id).toBe("adinkra");
  });

  it("getTemplate returns the exact requested template when found", () => {
    expect(getTemplate("modern").id).toBe("modern");
    expect(getTemplate("kente").id).toBe("kente");
  });

  it("exposes the same templates via TEMPLATES record", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(TEMPLATE_LIST.map((t) => t.id).sort());
  });
});
