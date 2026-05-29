// Concierge tool roster — Anthropic tool-use definitions.
// Each tool definition is shipped to Claude in /messages calls. The dispatcher
// in ./dispatch.ts maps the tool_name back to lib functions.

import type Anthropic from "@anthropic-ai/sdk";

export const CONCIERGE_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_event_summary",
    description:
      "Get a real-time snapshot of the event: RSVP counts by status, gift totals, pending AI drafts, days until the wedding, budget total, list of guests still missing an RSVP, and the design status. Call this at the start of a conversation and after any state-changing action.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "search_guests",
    description:
      "Search the guest list. Filter by RSVP status ('pending', 'yes', 'no', 'maybe'), group tag (e.g. 'family', 'work'), or whether they have a phone number on file. Returns up to 50 matching guests with id, name, phone, group, RSVP state.",
    input_schema: {
      type: "object",
      properties: {
        rsvp_status: { type: "string", enum: ["pending", "yes", "no", "maybe", "any"] },
        group_tag: { type: "string" },
        has_phone: { type: "boolean" },
        has_responded: { type: "boolean" },
      },
      required: [],
    },
  },
  {
    name: "send_invitations",
    description:
      "Send an invitation, save-the-date, RSVP reminder, or gift follow-up to a set of guests. The target can be specific guest ids, the string 'missing_rsvp' (everyone whose status is still pending), or 'all'. Tries WhatsApp first, falls back to SMS on failure. THIS IS A WRITE ACTION. You MUST set confirm=true in the input. Without confirmation, the tool returns a preview and does not send.",
    input_schema: {
      type: "object",
      properties: {
        template_key: {
          type: "string",
          enum: ["save_the_date", "rsvp_reminder", "thank_you_followup"],
        },
        target: {
          oneOf: [
            { type: "string", enum: ["missing_rsvp", "all"] },
            { type: "array", items: { type: "string" } },
          ],
          description:
            "Either 'missing_rsvp', 'all', or an array of guest ids. Prefer 'missing_rsvp' over enumerating ids.",
        },
        confirm: {
          type: "boolean",
          description: "Set to true to actually send. False/omitted = preview only.",
        },
      },
      required: ["template_key", "target"],
    },
  },
  {
    name: "draft_thank_you",
    description:
      "Draft a warm Ghanaian-English thank-you note for a settled gift. Returns the draft text; the user can then send it via the gifts dashboard. This does not send; it only drafts.",
    input_schema: {
      type: "object",
      properties: {
        gift_id: { type: "string" },
      },
      required: ["gift_id"],
    },
  },
  {
    name: "regenerate_section",
    description:
      "Regenerate a single section of the event's public page (hero, story, schedule, details, faq, gifts, rsvp) with a custom rewrite prompt. The new content is saved immediately.",
    input_schema: {
      type: "object",
      properties: {
        section_type: {
          type: "string",
          enum: ["hero", "story", "schedule", "details", "faq", "gifts", "rsvp"],
        },
        prompt: {
          type: "string",
          description: "Short instruction, e.g. 'make the story shorter and mention Cape Coast'.",
        },
      },
      required: ["section_type", "prompt"],
    },
  },
  {
    name: "update_budget_item",
    description:
      "Update the planned amount on a budget line item. Amount is in GHS pesewas (1 GHS = 100 pesewas). THIS IS A WRITE ACTION — set confirm=true to apply.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Slug of the category, e.g. 'venue', 'catering'." },
        planned_minor: { type: "integer", minimum: 0 },
        confirm: { type: "boolean" },
      },
      required: ["category", "planned_minor"],
    },
  },
  {
    name: "simulate_inbound_message",
    description:
      "Simulate an inbound WhatsApp message from a guest for demo purposes. Creates an InboundMessage row and runs the AI classifier. Useful when the user wants to see the AI inbox in action without a real WhatsApp connection.",
    input_schema: {
      type: "object",
      properties: {
        from_phone: { type: "string", description: "E.164 or local Ghanaian phone." },
        body: { type: "string" },
      },
      required: ["from_phone", "body"],
    },
  },
  {
    name: "approve_ai_draft",
    description:
      "Approve a pending AI-drafted reply in the inbox and send it. The body may be edited from the original draft. THIS IS A WRITE ACTION — set confirm=true to apply.",
    input_schema: {
      type: "object",
      properties: {
        draft_id: { type: "string" },
        body: { type: "string", description: "Final reply text (may differ from the AI draft)." },
        confirm: { type: "boolean" },
      },
      required: ["draft_id", "body"],
    },
  },
  {
    name: "generate_image_for_section",
    description:
      "Generate an AI image for the hero or story section of the event page and attach it. Uses Gemini Imagen when configured; falls back to a placeholder otherwise.",
    input_schema: {
      type: "object",
      properties: {
        section_type: { type: "string", enum: ["hero", "story"] },
      },
      required: ["section_type"],
    },
  },
];

export const CONCIERGE_TOOL_NAMES = CONCIERGE_TOOLS.map((t) => t.name) as readonly string[];

/** Tools that change state — must require explicit confirm=true. */
export const WRITE_TOOLS = new Set([
  "send_invitations",
  "update_budget_item",
  "approve_ai_draft",
  "regenerate_section",
  "generate_image_for_section",
  "simulate_inbound_message",
]);

export function requiresConfirmation(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}
