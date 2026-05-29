import { describe, it, expect } from "vitest";
import { toClaudeMessages, HISTORY_LIMIT, KEEP_RECENT } from "./memory";

describe("toClaudeMessages", () => {
  it("converts user rows to plain user messages", () => {
    const out = toClaudeMessages([
      {
        role: "user",
        content: "Hi there",
        toolName: null,
        toolInput: null,
        toolResult: null,
        toolUseId: null,
      },
    ]);
    expect(out).toEqual([{ role: "user", content: "Hi there" }]);
  });

  it("converts assistant text + tool_use to a single multi-block assistant message", () => {
    const out = toClaudeMessages([
      {
        role: "assistant",
        content: "Let me check",
        toolName: "get_event_summary",
        toolInput: { foo: 1 },
        toolResult: null,
        toolUseId: "toolu_123",
      },
    ]);
    expect(out).toHaveLength(1);
    const msg = out[0]!;
    expect(msg.role).toBe("assistant");
    const blocks = msg.content as Array<{ type: string; name?: string; id?: string }>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("text");
    expect(blocks[1]?.type).toBe("tool_use");
    expect(blocks[1]?.name).toBe("get_event_summary");
    expect(blocks[1]?.id).toBe("toolu_123");
  });

  it("wraps tool_result rows inside a user message", () => {
    const out = toClaudeMessages([
      {
        role: "tool_result",
        content: '{"ok":true}',
        toolName: "get_event_summary",
        toolInput: null,
        toolResult: { ok: true },
        toolUseId: "toolu_123",
      },
    ]);
    const msg = out[0]!;
    expect(msg.role).toBe("user");
    const blocks = msg.content as Array<{ type: string; tool_use_id?: string }>;
    expect(blocks[0]?.type).toBe("tool_result");
    expect(blocks[0]?.tool_use_id).toBe("toolu_123");
  });

  it("never emits empty assistant blocks (Anthropic rejects them)", () => {
    const out = toClaudeMessages([
      {
        role: "assistant",
        content: "",
        toolName: null,
        toolInput: null,
        toolResult: null,
        toolUseId: null,
      },
    ]);
    const msg = out[0]!;
    const blocks = msg.content as Array<{ type: string }>;
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe("history limits", () => {
  it("KEEP_RECENT is smaller than HISTORY_LIMIT (room to summarize)", () => {
    expect(KEEP_RECENT).toBeLessThan(HISTORY_LIMIT);
  });
});
