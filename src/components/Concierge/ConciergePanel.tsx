"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConciergeContext } from "./context";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

interface ConciergePanelProps {
  eventId: string;
  eventTitle: string;
  initialMessages: DisplayMessage[];
  initialOpen?: boolean;
  initialPrompt?: string;
  initialMessage?: string; // greeting injected by server on first open
}

export default function ConciergePanel({
  eventId,
  eventTitle,
  initialMessages,
  initialOpen,
  initialPrompt,
  initialMessage,
}: ConciergePanelProps) {
  const STORAGE_KEY = `celebrate-concierge-open-${eventId}`;
  const [open, setOpen] = useState(initialOpen ?? false);
  const [messages, setMessages] = useState<DisplayMessage[]>(() => {
    const seed = [...initialMessages];
    if (initialMessage && initialMessages.length === 0) {
      seed.push({ id: "greeting", role: "assistant", content: initialMessage });
    }
    return seed;
  });
  const [input, setInput] = useState(initialPrompt ?? "");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    toolName: string;
    toolInput: unknown;
    preview: unknown;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Restore open state across navigation
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open, STORAGE_KEY]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages.length, scrollToBottom]);

  // External trigger: when ConciergeLauncher dispatches a prompt
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ eventId: string; prompt: string; autoSend?: boolean }>;
      if (ce.detail.eventId !== eventId) return;
      setOpen(true);
      setInput(ce.detail.prompt);
      if (ce.detail.autoSend) {
        // Run after state settles
        setTimeout(() => send(ce.detail.prompt), 50);
      }
    };
    window.addEventListener("concierge:prompt", handler as EventListener);
    return () => window.removeEventListener("concierge:prompt", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function send(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();
    if (!message || streaming) return;

    const tempUserId = `u-${Date.now()}`;
    const tempAsstId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: message },
      { id: tempAsstId, role: "assistant", content: "" },
    ]);
    setInput("");
    setStreaming(true);
    setThinking(true);
    setPendingConfirm(null);

    try {
      const res = await fetch(`/api/events/${eventId}/concierge/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAsstId
              ? {
                  ...m,
                  content: `Sorry — ${(data as { error?: string }).error ?? "something went wrong"}.`,
                }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!chunk) continue;

          let eventName = "";
          let dataLine = "";
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
          }
          if (!eventName) continue;
          let parsed: Record<string, unknown> = {};
          try {
            parsed = JSON.parse(dataLine);
          } catch {
            continue;
          }
          handleEvent(eventName, parsed, tempAsstId);
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAsstId
            ? { ...m, content: `Connection error: ${err instanceof Error ? err.message : err}` }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      setThinking(false);
      scrollToBottom();
    }
  }

  function handleEvent(name: string, data: Record<string, unknown>, assistantMsgId: string) {
    switch (name) {
      case "thinking":
        setThinking(true);
        break;
      case "text": {
        const text = String(data.text ?? "");
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: text } : m)),
        );
        setThinking(false);
        scrollToBottom();
        break;
      }
      case "tool_call": {
        const toolName = String(data.toolName ?? "");
        setMessages((prev) => [
          ...prev,
          {
            id: `t-${Date.now()}-${Math.random()}`,
            role: "tool",
            content: `Calling ${friendlyToolName(toolName)}…`,
            toolName,
          },
        ]);
        scrollToBottom();
        break;
      }
      case "tool_result": {
        const toolName = String(data.toolName ?? "");
        const result = data.toolResult as { humanSummary?: string; ok?: boolean; error?: string };
        const text =
          result?.ok === false
            ? `❌ ${friendlyToolName(toolName)}: ${result.error ?? "failed"}`
            : `✓ ${result?.humanSummary ?? friendlyToolName(toolName)}`;
        setMessages((prev) => [
          ...prev,
          { id: `r-${Date.now()}-${Math.random()}`, role: "tool", content: text, toolName },
        ]);
        scrollToBottom();
        break;
      }
      case "needs_confirmation": {
        setPendingConfirm({
          toolName: String(data.toolName ?? ""),
          toolInput: data.toolInput,
          preview: data.preview,
        });
        scrollToBottom();
        break;
      }
      case "error": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `Sorry — ${String(data.error ?? "error")}.` }
              : m,
          ),
        );
        setThinking(false);
        break;
      }
      case "done":
        setThinking(false);
        break;
    }
  }

  function confirmPending() {
    if (!pendingConfirm) return;
    const tool = pendingConfirm;
    setPendingConfirm(null);
    // Re-issue as a natural-language message telling the agent to proceed.
    // The model will re-call the same tool with confirm=true based on system prompt.
    send(`Yes, please go ahead with ${friendlyToolName(tool.toolName)}.`);
  }

  function cancelPending() {
    if (!pendingConfirm) return;
    setPendingConfirm(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        role: "tool",
        content: "Cancelled. Nothing was sent.",
      },
    ]);
  }

  return (
    <ConciergeContext.Provider value={{ eventId, isOpen: open, open: () => setOpen(true) }}>
      {/* Launcher bubble */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-kente-600 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-kente-700 transition hover:bg-kente-700 active:scale-[0.98]"
          aria-label="Open Celebrate Concierge"
        >
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          Concierge
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 top-0 z-40 flex w-full flex-col bg-white shadow-2xl ring-1 ring-ink-200 sm:bottom-5 sm:right-5 sm:top-auto sm:h-[640px] sm:max-h-[80vh] sm:w-[420px] sm:rounded-2xl">
          <header className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-ink-500">Concierge</p>
              <p className="font-display text-base font-semibold text-ink-900">{eventTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-ink-500 hover:bg-ink-100"
              aria-label="Close Concierge"
            >
              ✕
            </button>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
                Hi! I&apos;m your event concierge. Ask me to send reminders, generate sections,
                check the budget, or draft thank-you notes — I&apos;ll do it.
              </div>
            )}
            <ul className="space-y-3">
              {messages.map((m) => (
                <Bubble key={m.id} role={m.role}>
                  {m.content}
                </Bubble>
              ))}
              {thinking && (
                <Bubble role="assistant">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400 [animation-delay:240ms]" />
                  </span>
                </Bubble>
              )}
            </ul>
          </div>

          {pendingConfirm && (
            <div className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Confirm: {friendlyToolName(pendingConfirm.toolName)}
              </p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-xs">
                {JSON.stringify(pendingConfirm.preview, null, 2)}
              </pre>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={confirmPending}
                  className="rounded-full bg-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-50"
                >
                  Yes, go ahead
                </button>
                <button
                  onClick={cancelPending}
                  className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-ink-100 p-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
                placeholder="Ask the Concierge…"
                className="input flex-1 text-sm"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="btn-primary text-sm"
              >
                Send
              </button>
            </div>
            {!streaming && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="rounded-full bg-ink-100 px-3 py-1 text-[11px] text-ink-700 hover:bg-ink-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      )}
    </ConciergeContext.Provider>
  );
}

const QUICK_PROMPTS = [
  "How are things looking?",
  "Send reminders to non-responders",
  "Generate a hero image",
];

function friendlyToolName(name: string): string {
  return name.replace(/_/g, " ");
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant" | "tool";
  children: React.ReactNode;
}) {
  if (role === "tool") {
    return (
      <li className="flex justify-center">
        <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] text-ink-600">{children}</span>
      </li>
    );
  }
  const isUser = role === "user";
  return (
    <li className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-kente-600 px-3 py-2 text-sm text-white"
            : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-ink-100 px-3 py-2 text-sm text-ink-900"
        }
      >
        {children}
      </div>
    </li>
  );
}
