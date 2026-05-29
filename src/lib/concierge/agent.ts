// Concierge agent: runs the Claude tool-use loop and emits a stream of
// progress events suitable for SSE delivery to the chat UI.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { CONCIERGE_TOOLS } from "./tools";
import { dispatch, type DispatchContext } from "./dispatch";
import { loadHistory, persistMessage, toClaudeMessages, truncateAndSummarize } from "./memory";

const MAX_ROUNDS = 6;

export interface AgentEvent {
  type:
    | "thinking"
    | "text"
    | "tool_call"
    | "tool_result"
    | "needs_confirmation"
    | "done"
    | "error";
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolUseId?: string;
  toolResult?: unknown;
  preview?: unknown;
  error?: string;
}

export interface RunAgentParams {
  conversationId: string;
  ctx: DispatchContext;
  userMessage: string;
  toneBand?: string; // optional override (default reads UserPreferences)
}

function systemPrompt(opts: {
  summary: string;
  toneBand: string;
  eventTitle: string;
  eventCity: string;
  daysUntil: number;
}): string {
  const toneGuide: Record<string, string> = {
    warm: "Warm, family-led, slightly informal. Use first names. Keep replies short and kind.",
    formal: "Polished, respectful, no slang. Refer to 'the couple'.",
    brief: "Extremely concise. Bullet points. No fluff.",
    playful: "Light, witty, a little cheeky — never sarcastic.",
  };
  return `You are the Celebrate Concierge — a persistent AI co-planner for a Ghanaian wedding. The couple, their planner, or a family member is chatting with you.

CURRENT EVENT: ${opts.eventTitle} in ${opts.eventCity}, ${opts.daysUntil} day${opts.daysUntil === 1 ? "" : "s"} away.

TONE: ${toneGuide[opts.toneBand] ?? toneGuide.warm}

MEMORY SO FAR (running memo): ${opts.summary || "(none — first conversation)"}

OPERATING RULES:
- You have TOOLS to inspect and change the event. Prefer doing things over explaining things.
- Always call get_event_summary at the start of a fresh conversation so you ground in real data.
- For any tool that requires confirmation, FIRST call it WITHOUT confirm=true to preview, surface the preview to the user, and ONLY re-call with confirm=true after they say yes.
- After running a tool, narrate the result briefly in plain Ghanaian-English. Don't dump raw JSON.
- Never invent guest names, gift amounts, or vendors. Use tool results as ground truth.
- Money is always in GHS pesewas (100 pesewas = 1 GHS) when passed to tools.
- Default to action. If the user is asking for something the tools cover, just do it (confirming for write actions).
- If a tool returns ok:false with needsConfirmation:true, summarize the preview to the user and ask "Should I go ahead?". When they affirm, call the same tool again with confirm:true and identical other args.
- If the user pivots ("actually never mind"), acknowledge and stop. Never re-issue a write tool you've already executed in this turn.

You are speaking to a real person, not a system. Be human.`;
}

export async function* runAgent(
  params: RunAgentParams,
): AsyncGenerator<AgentEvent, void, void> {
  const { conversationId, ctx, userMessage } = params;

  // Persist the user's turn first so it survives even if the model call fails
  await persistMessage({ conversationId, role: "user", content: userMessage });

  const conv = await loadHistory(conversationId);
  const event = await db.event.findUnique({
    where: { id: ctx.eventId },
    select: { title: true, city: true, eventDate: true },
  });
  if (!event) {
    yield { type: "error", error: "Event not found" };
    return;
  }
  const daysUntil = Math.ceil(
    (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  // Resolve tone preference
  const prefs = await db.userPreferences.findUnique({ where: { userId: ctx.userId } });
  const toneBand = params.toneBand ?? prefs?.toneBand ?? "warm";

  const sys = systemPrompt({
    summary: conv.summary,
    toneBand,
    eventTitle: event.title,
    eventCity: event.city,
    daysUntil,
  });

  // Mock fallback: deterministic canned response if no API key
  const e = env();
  if (e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) {
    yield* runMockAgent({ conversationId, ctx, userMessage });
    return;
  }

  const client = new Anthropic({ apiKey: e.ANTHROPIC_API_KEY });

  const messages = toClaudeMessages(conv.messages);
  // Add the new user message at the end (it's not in the conv until we re-fetch,
  // but we already persisted it, so just append the same content).
  messages.push({ role: "user", content: userMessage });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    yield { type: "thinking" };

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: e.ANTHROPIC_MODEL_FAST,
        max_tokens: 2048,
        system: sys,
        tools: CONCIERGE_TOOLS,
        messages,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      yield { type: "error", error: errMsg };
      return;
    }

    // Persist the assistant turn (with possible tool_use)
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    const assistantText = textBlocks.map((b) => b.text).join("\n").trim();

    if (assistantText) {
      yield { type: "text", text: assistantText };
    }

    // Save the assistant text + optional first tool_use block
    if (assistantText || toolUseBlocks.length > 0) {
      const firstTool = toolUseBlocks[0];
      await persistMessage({
        conversationId,
        role: "assistant",
        content: assistantText,
        toolName: firstTool?.name,
        toolInput: firstTool?.input,
        toolUseId: firstTool?.id,
        modelId: e.ANTHROPIC_MODEL_FAST,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
    }

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      yield { type: "done" };
      break;
    }

    // Execute the first tool_use this round (we limit to one tool per round
    // for predictability and to keep the chat UI digestible)
    const toolBlock = toolUseBlocks[0];
    if (!toolBlock) {
      yield { type: "done" };
      break;
    }

    yield {
      type: "tool_call",
      toolName: toolBlock.name,
      toolInput: toolBlock.input,
      toolUseId: toolBlock.id,
    };

    const result = await dispatch(toolBlock.name, toolBlock.input, ctx);

    const resultStr = JSON.stringify(result);
    await persistMessage({
      conversationId,
      role: "tool_result",
      content: resultStr,
      toolName: toolBlock.name,
      toolResult: result,
      toolUseId: toolBlock.id,
    });

    if (!result.ok && result.needsConfirmation) {
      yield {
        type: "needs_confirmation",
        toolName: toolBlock.name,
        toolInput: toolBlock.input,
        preview: result.preview,
      };
    } else {
      yield {
        type: "tool_result",
        toolName: toolBlock.name,
        toolResult: result,
      };
    }

    // Append assistant + tool_result to the messages array for the next round
    messages.push({
      role: "assistant",
      content: response.content as unknown as Anthropic.ContentBlockParam[],
    });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolBlock.id,
          content: resultStr,
        },
      ],
    });
  }

  // Maybe summarize
  await truncateAndSummarize(conversationId).catch(() => {});
}

// ─── Mock agent (no Anthropic key) ───

async function* runMockAgent(params: RunAgentParams): AsyncGenerator<AgentEvent, void, void> {
  const { conversationId, ctx, userMessage } = params;

  yield { type: "thinking" };

  const lc = userMessage.toLowerCase();
  let response: string;
  let toolName: string | null = null;
  let toolResult: unknown = null;

  if (/summary|status|where|how is|how are|stand|going|looking|update|overview|rundown/.test(lc)) {
    toolName = "get_event_summary";
    const r = await dispatch("get_event_summary", {}, ctx);
    toolResult = r;
    response = r.ok
      ? `Here's where things stand: ${"humanSummary" in r ? r.humanSummary : "summary unavailable"}.`
      : `I couldn't fetch the summary: ${r.error}`;
  } else if (/remind|reminder|nudge/.test(lc)) {
    response =
      "Happy to send an RSVP reminder to everyone who hasn't replied. Should I go ahead? (Reply 'yes' to confirm.)";
  } else if (/thank/.test(lc)) {
    response =
      "I can draft thank-you notes for your settled gifts — open the Gifts tab and tap 'Draft with AI' on any pending gift, or tell me a gift to draft.";
  } else {
    response = `(Demo / mock mode — set ANTHROPIC_API_KEY for the full Concierge.) I heard: "${userMessage.slice(0, 120)}".`;
  }

  yield { type: "text", text: response };
  if (toolName && toolResult) {
    yield { type: "tool_result", toolName, toolResult };
  }
  await persistMessage({
    conversationId,
    role: "assistant",
    content: response,
    toolName: toolName ?? undefined,
    toolResult: toolResult ?? undefined,
    modelId: "mock",
  });
  yield { type: "done" };
}
