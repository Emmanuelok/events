import { describe, it, expect } from "vitest";
import {
  CONCIERGE_TOOLS,
  CONCIERGE_TOOL_NAMES,
  WRITE_TOOLS,
  requiresConfirmation,
} from "./tools";

describe("Concierge tool roster", () => {
  it("exposes all expected tools", () => {
    const expected = [
      "get_event_summary",
      "search_guests",
      "send_invitations",
      "draft_thank_you",
      "regenerate_section",
      "update_budget_item",
      "simulate_inbound_message",
      "approve_ai_draft",
      "generate_image_for_section",
    ];
    expect([...CONCIERGE_TOOL_NAMES].sort()).toEqual(expected.sort());
  });

  it("every tool has a description and input schema with a type", () => {
    for (const t of CONCIERGE_TOOLS) {
      expect(t.description, `${t.name} missing description`).toBeTruthy();
      expect((t.input_schema as { type?: string }).type).toBe("object");
    }
  });

  it("state-changing tools are in the write-tools set", () => {
    expect(WRITE_TOOLS.has("send_invitations")).toBe(true);
    expect(WRITE_TOOLS.has("update_budget_item")).toBe(true);
    expect(WRITE_TOOLS.has("approve_ai_draft")).toBe(true);
    expect(WRITE_TOOLS.has("regenerate_section")).toBe(true);
    expect(WRITE_TOOLS.has("generate_image_for_section")).toBe(true);
  });

  it("read-only tools are not flagged as requiring confirmation", () => {
    expect(requiresConfirmation("get_event_summary")).toBe(false);
    expect(requiresConfirmation("search_guests")).toBe(false);
    expect(requiresConfirmation("draft_thank_you")).toBe(false);
  });
});
