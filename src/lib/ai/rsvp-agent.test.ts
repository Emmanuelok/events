import { describe, it, expect } from "vitest";
import { templateClassify } from "./rsvp-agent";

const ctx = {
  inboundMessageId: "m1",
  eventId: "e1",
  brideName: "Ama",
  groomName: "Kwame",
  guestDisplayName: "Akua Mensah",
};

describe("rsvp-agent template classifier (fallback)", () => {
  it("classifies clear yes/no/maybe correctly", () => {
    expect(templateClassify("Yes! Count me in.", ctx).intent).toBe("rsvp_yes");
    expect(templateClassify("Sorry, I can't make it.", ctx).intent).toBe("rsvp_no");
    expect(templateClassify("I'll try to be there, not sure yet.", ctx).intent).toBe("rsvp_maybe");
  });

  it("detects dietary requests and extracts the keyword", () => {
    const out = templateClassify("Just letting you know I'm vegetarian.", ctx);
    expect(out.intent).toBe("dietary");
    expect(out.extracted.dietary?.toLowerCase()).toContain("vegetarian");
  });

  it("detects plus-one and extracts the count", () => {
    const out = templateClassify("Can I bring my wife and +1?", ctx);
    expect(out.intent).toBe("plus_one");
    expect(out.extracted.plusOnes).toBe(1);
  });

  it("falls back to 'question' on a generic ask", () => {
    const out = templateClassify("What time does it start?", ctx);
    expect(out.intent).toBe("question");
  });

  it("draftReply mentions the guest by first name", () => {
    const out = templateClassify("Yes, definitely!", ctx);
    expect(out.draftReply.toLowerCase()).toContain("akua");
  });

  it("never returns an empty draft reply", () => {
    expect(templateClassify("yo", ctx).draftReply.length).toBeGreaterThan(5);
  });
});
