import { describe, it, expect } from "vitest";
import { pageDesignSchema, PAGE_DESIGN_VERSION } from "./types";
import { templateDesign } from "@/lib/ai/design-studio";

describe("PageDesign schema", () => {
  it("validates a template-generated design", () => {
    const d = templateDesign({
      brideName: "Ama",
      groomName: "Kwame",
      eventDate: new Date("2026-12-14").toISOString(),
      city: "Accra",
      venueName: "Labadi Beach Hotel",
      brief: "We met at university and want a warm family wedding.",
      vibe: "warm",
      templateId: "adinkra",
      components: ["traditional", "white_wedding"],
    });
    const r = pageDesignSchema.safeParse(d);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.version).toBe(PAGE_DESIGN_VERSION);
      expect(r.data.sections.length).toBeGreaterThanOrEqual(5);
      expect(r.data.sections[0]?.type).toBe("hero");
    }
  });

  it("rejects designs without a hero section if user payload omits hero", () => {
    const bad = { version: 1, templateId: "adinkra", vibe: "warm", sections: [], updatedAt: "now" };
    expect(pageDesignSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown vibe values", () => {
    const d = templateDesign({
      brideName: "Ama",
      groomName: "Kwame",
      eventDate: new Date("2026-12-14").toISOString(),
      city: "Accra",
      venueName: "",
      brief: "Short brief here.",
      vibe: "warm",
      templateId: "adinkra",
      components: ["white_wedding"],
    } as never);
    const broken = { ...d, vibe: "psychedelic" } as unknown;
    expect(pageDesignSchema.safeParse(broken).success).toBe(false);
  });
});
