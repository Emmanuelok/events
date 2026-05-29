// Persistent conversation memory for the Concierge.
// - getOrCreateConversation() per (event, user)
// - persistMessage() saves user / assistant / tool_result rows
// - truncateAndSummarize() rolls older messages into a summary once history > 20
// - toClaudeMessages() flattens the persisted rows back to Anthropic's
//   conversation shape (with proper tool_use / tool_result blocks).

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Prisma } from "@prisma/client";

export const HISTORY_LIMIT = 20;
export const KEEP_RECENT = 10;
export const SUMMARY_TARGET_WORDS = 180;

export async function getOrCreateConversation(eventId: string, userId: string) {
  const existing = await db.conciergeConversation.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (existing) return existing;
  return db.conciergeConversation.create({
    data: { eventId, userId },
  });
}

export interface PersistMessageParams {
  conversationId: string;
  role: "user" | "assistant" | "tool_result";
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  toolUseId?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function persistMessage(p: PersistMessageParams) {
  const msg = await db.conciergeMessage.create({
    data: {
      conversationId: p.conversationId,
      role: p.role,
      content: p.content,
      toolName: p.toolName,
      toolInput: p.toolInput as Prisma.InputJsonValue,
      toolResult: p.toolResult as Prisma.InputJsonValue,
      toolUseId: p.toolUseId,
      modelId: p.modelId,
      inputTokens: p.inputTokens ?? 0,
      outputTokens: p.outputTokens ?? 0,
    },
  });
  await db.conciergeConversation.update({
    where: { id: p.conversationId },
    data: { lastMessageAt: new Date() },
  });
  return msg;
}

export async function loadHistory(conversationId: string) {
  const conv = await db.conciergeConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conv) throw new Error("Conversation not found");
  return conv;
}

/**
 * Convert persisted rows to Anthropic message blocks.
 *
 * Persisted rows are flat (role + content + optional tool fields). Claude
 * expects:
 *   - assistant text         → { role:"assistant", content: [{type:"text", text}] }
 *   - assistant tool_use     → { role:"assistant", content: [{type:"tool_use", id, name, input}] }
 *   - user/tool_result       → { role:"user", content: [{type:"tool_result", tool_use_id, content}] }
 *
 * We merge consecutive same-role rows into a single message with multiple
 * content blocks where appropriate (Claude requires assistant tool_use + the
 * tool_result that follows to be in adjacent messages).
 */
export function toClaudeMessages(
  rows: Array<{
    role: "user" | "assistant" | "tool_result";
    content: string;
    toolName: string | null;
    toolInput: Prisma.JsonValue | null;
    toolResult: Prisma.JsonValue | null;
    toolUseId: string | null;
  }>,
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const row of rows) {
    if (row.role === "user") {
      out.push({ role: "user", content: row.content });
    } else if (row.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (row.content) blocks.push({ type: "text", text: row.content });
      if (row.toolName && row.toolUseId) {
        blocks.push({
          type: "tool_use",
          id: row.toolUseId,
          name: row.toolName,
          input: (row.toolInput ?? {}) as Record<string, unknown>,
        });
      }
      if (blocks.length === 0) blocks.push({ type: "text", text: "" });
      out.push({ role: "assistant", content: blocks });
    } else if (row.role === "tool_result") {
      // tool_result must be inside a user message
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: row.toolUseId ?? "",
            content: row.content || JSON.stringify(row.toolResult ?? {}),
          },
        ],
      });
    }
  }
  return out;
}

const SUMMARIZE_SYSTEM = `You are a memory summarizer. Compress the conversation below into a brief running memo (≤ ${SUMMARY_TARGET_WORDS} words) that the assistant can use as context for future replies.

Capture: what the user is planning, decisions made, names/numbers mentioned, anything still pending, and any user preferences or style cues you notice. Skip pleasantries.

Output the memo text only — no preamble.`;

export async function truncateAndSummarize(conversationId: string) {
  const conv = await loadHistory(conversationId);
  if (conv.messages.length <= HISTORY_LIMIT) return;

  const cutCount = conv.messages.length - KEEP_RECENT;
  const toSummarize = conv.messages.slice(0, cutCount);
  const lastId = toSummarize[toSummarize.length - 1]?.id;
  if (!lastId) return;

  const transcript = toSummarize
    .map((m) => {
      if (m.role === "user") return `USER: ${m.content}`;
      if (m.role === "assistant") {
        const tu = m.toolName ? ` [called ${m.toolName}]` : "";
        return `ASSISTANT${tu}: ${m.content}`;
      }
      return `TOOL_RESULT (${m.toolName ?? ""}): ${m.content.slice(0, 400)}`;
    })
    .join("\n");

  let newSummary = conv.summary;
  const e = env();
  if (e.AI_PROVIDER === "anthropic" && e.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: e.ANTHROPIC_MODEL_FAST,
        max_tokens: 600,
        system: SUMMARIZE_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Existing memo: ${conv.summary || "(none)"}\n\nNew conversation to fold in:\n${transcript}`,
          },
        ],
      });
      const block = resp.content.find((b) => b.type === "text");
      if (block && block.type === "text") newSummary = block.text.trim();
    } catch {
      // best-effort; on failure we still drop the messages and keep the old summary
    }
  } else {
    // Mock-mode summary: just append the user lines
    const userLines = toSummarize
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" / ");
    newSummary = (conv.summary + "\n" + userLines).trim().slice(0, 2000);
  }

  await db.$transaction([
    db.conciergeMessage.deleteMany({
      where: {
        conversationId,
        id: { in: toSummarize.map((m) => m.id) },
      },
    }),
    db.conciergeConversation.update({
      where: { id: conversationId },
      data: { summary: newSummary, summaryUpToMessageId: lastId },
    }),
  ]);
}
