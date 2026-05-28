import { describe, it, expect } from "vitest";
import { templateBudget, budgetInputSchema, budgetOutputSchema } from "./budget";

describe("templateBudget fallback", () => {
  it("produces a valid budget for a typical Accra wedding", () => {
    const input = budgetInputSchema.parse({
      eventType: "wedding",
      region: "greater_accra",
      city: "Accra",
      guestCount: 250,
      styleBand: "mid",
      components: ["traditional", "white_wedding"],
    });
    const out = templateBudget(input);
    const validated = budgetOutputSchema.parse(out);
    expect(validated.totalMinor).toBeGreaterThan(0);
    expect(validated.categories.length).toBeGreaterThanOrEqual(5);
    expect(validated.categories.every((c) => c.lowMinor <= c.typicalMinor)).toBe(true);
    expect(validated.categories.every((c) => c.typicalMinor <= c.highMinor)).toBe(true);
  });

  it("scales with guest count", () => {
    const small = templateBudget(
      budgetInputSchema.parse({
        eventType: "wedding",
        region: "ashanti",
        city: "Kumasi",
        guestCount: 50,
        styleBand: "mid",
        components: ["white_wedding"],
      }),
    );
    const big = templateBudget(
      budgetInputSchema.parse({
        eventType: "wedding",
        region: "ashanti",
        city: "Kumasi",
        guestCount: 500,
        styleBand: "mid",
        components: ["white_wedding"],
      }),
    );
    expect(big.totalMinor).toBeGreaterThan(small.totalMinor);
  });

  it("scales up for higher style bands", () => {
    const base = templateBudget(
      budgetInputSchema.parse({
        eventType: "wedding",
        region: "ashanti",
        city: "Kumasi",
        guestCount: 200,
        styleBand: "mid",
        components: ["white_wedding"],
      }),
    );
    const lux = templateBudget(
      budgetInputSchema.parse({
        eventType: "wedding",
        region: "ashanti",
        city: "Kumasi",
        guestCount: 200,
        styleBand: "luxury",
        components: ["white_wedding"],
      }),
    );
    expect(lux.totalMinor).toBeGreaterThan(base.totalMinor * 2);
  });

  it("rejects guest counts outside the supported range", () => {
    expect(() =>
      budgetInputSchema.parse({
        eventType: "wedding",
        region: "ashanti",
        city: "Kumasi",
        guestCount: 5,
        styleBand: "mid",
        components: ["white_wedding"],
      }),
    ).toThrow();
  });
});
