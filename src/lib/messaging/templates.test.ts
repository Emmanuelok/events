import { describe, it, expect } from "vitest";
import { renderTemplate, TEMPLATE_KEYS } from "./templates";

const vars = {
  brideName: "Ama",
  groomName: "Kwame",
  eventDateLine: "Saturday, 12 December 2026",
  eventCity: "Accra",
  rsvpLink: "https://celebrate.gh/r/AbCd12",
  giftLink: "https://celebrate.gh/e/ama-kwame/gift",
  guestFirstName: "Akua",
};

describe("message templates", () => {
  it("renders every template for both channels", () => {
    for (const key of TEMPLATE_KEYS) {
      const wa = renderTemplate(key, "whatsapp", vars);
      const sms = renderTemplate(key, "sms", vars);
      expect(wa.length).toBeGreaterThan(20);
      expect(sms.length).toBeGreaterThan(20);
    }
  });

  it("includes the guest's first name in WhatsApp bodies", () => {
    const wa = renderTemplate("save_the_date", "whatsapp", vars);
    expect(wa).toContain("Akua");
  });

  it("includes the RSVP link", () => {
    expect(renderTemplate("save_the_date", "whatsapp", vars)).toContain(vars.rsvpLink);
    expect(renderTemplate("save_the_date", "sms", vars)).toContain(vars.rsvpLink);
  });

  it("includes the gift link only in the thank-you follow-up", () => {
    expect(renderTemplate("thank_you_followup", "whatsapp", vars)).toContain(vars.giftLink);
    expect(renderTemplate("save_the_date", "whatsapp", vars)).not.toContain(vars.giftLink);
  });

  it("SMS bodies stay under 320 chars (two SMS segments) for normal inputs", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(renderTemplate(key, "sms", vars).length).toBeLessThan(320);
    }
  });
});
