"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InboxRow {
  id: string;
  fromPhone: string;
  body: string;
  receivedAt: string;
  channel: string;
  intent: string | null;
  intentConfidence: number | null;
  handledAt: string | null;
  guestName: string | null;
  guestPhone: string | null;
  draft: {
    id: string;
    body: string;
    status: string;
    modelId: string;
  } | null;
}

const INTENT_LABEL: Record<string, { label: string; tone: string }> = {
  rsvp_yes: { label: "RSVP yes", tone: "bg-forest-100 text-forest-800" },
  rsvp_no: { label: "RSVP no", tone: "bg-red-100 text-red-800" },
  rsvp_maybe: { label: "RSVP maybe", tone: "bg-amber-100 text-amber-800" },
  dietary: { label: "Dietary", tone: "bg-kente-100 text-kente-800" },
  plus_one: { label: "Plus one", tone: "bg-kente-100 text-kente-800" },
  question: { label: "Question", tone: "bg-ink-200 text-ink-800" },
  other: { label: "Other", tone: "bg-ink-100 text-ink-700" },
};

export default function InboxClient({
  eventId,
  slug: _slug,
  initialMessages,
}: {
  eventId: string;
  slug: string;
  initialMessages: InboxRow[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<InboxRow[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [simPhone, setSimPhone] = useState("");
  const [simBody, setSimBody] = useState("Yes! We'll be there with bells on.");
  const [simBusy, setSimBusy] = useState(false);
  const [busyDraft, setBusyDraft] = useState<string | null>(null);

  async function simulateInbound(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimBusy(true);
    try {
      const r = await fetch(`/api/events/${eventId}/inbox/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromPhone: simPhone, body: simBody, channel: "whatsapp" }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Could not simulate");
        return;
      }
      // Refresh data
      router.refresh();
    } finally {
      setSimBusy(false);
    }
  }

  async function approveDraft(draftId: string, body: string) {
    setBusyDraft(draftId);
    setError(null);
    try {
      const r = await fetch(`/api/events/${eventId}/inbox/drafts/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", body, applyExtracted: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error ?? "Approve failed");
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.draft?.id === draftId
            ? {
                ...m,
                handledAt: new Date().toISOString(),
                draft: { ...m.draft, status: "approved", body },
              }
            : m,
        ),
      );
      router.refresh();
    } finally {
      setBusyDraft(null);
    }
  }

  async function rejectDraft(draftId: string) {
    setBusyDraft(draftId);
    try {
      const r = await fetch(`/api/events/${eventId}/inbox/drafts/${draftId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (r.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.draft?.id === draftId
              ? { ...m, handledAt: new Date().toISOString(), draft: { ...m.draft, status: "rejected" } }
              : m,
          ),
        );
        router.refresh();
      }
    } finally {
      setBusyDraft(null);
    }
  }

  const pending = messages.filter((m) => m.draft?.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-ink-600">Pending drafts</p>
          <p className="mt-1 font-display text-3xl font-semibold text-kente-700">{pending}</p>
          <p className="mt-1 text-xs text-ink-500">Approve or edit to send.</p>
        </div>
        <div className="card md:col-span-2">
          <h2 className="font-display text-lg font-semibold text-ink-900">How this works</h2>
          <p className="mt-1 text-sm text-ink-700">
            When a guest replies to your invitation by WhatsApp or SMS, Claude classifies their
            intent, applies what it can to the RSVP, and drafts a reply for you to approve. Nothing
            is sent without your tap.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-ink-900">
          Simulate an inbound message
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Useful for demos — pretends Meta&apos;s webhook just delivered a guest reply.
        </p>
        <form onSubmit={simulateInbound} className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input
            className="input"
            placeholder="Guest phone (e.g. 0244111222)"
            required
            value={simPhone}
            onChange={(e) => setSimPhone(e.target.value)}
          />
          <input
            className="input"
            placeholder="Their message"
            required
            value={simBody}
            onChange={(e) => setSimBody(e.target.value)}
          />
          <button className="btn-primary" disabled={simBusy}>
            {simBusy ? "Sending…" : "Simulate"}
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden p-0">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">All inbound</h2>
        </div>
        {messages.length === 0 ? (
          <p className="px-5 py-12 text-center text-ink-600">
            No inbound messages yet. Send invitations or simulate one above.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {messages.map((m) => {
              const intentBadge = m.intent ? INTENT_LABEL[m.intent] : null;
              return (
                <li key={m.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink-900">
                        {m.guestName ?? "Unknown guest"}{" "}
                        <span className="font-normal text-ink-600">{m.fromPhone}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {new Date(m.receivedAt).toLocaleString("en-GH", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        · via {m.channel}
                      </p>
                    </div>
                    {intentBadge && (
                      <span className={`chip ${intentBadge.tone}`}>
                        {intentBadge.label}
                        {m.intentConfidence !== null && (
                          <span className="ml-1 opacity-70">
                            {Math.round(m.intentConfidence * 100)}%
                          </span>
                        )}
                      </span>
                    )}
                    {m.handledAt ? (
                      <span className="chip bg-forest-100 text-forest-800">Handled</span>
                    ) : (
                      <span className="chip bg-amber-100 text-amber-800">Pending</span>
                    )}
                  </div>

                  <blockquote className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm italic text-ink-800">
                    &ldquo;{m.body}&rdquo;
                  </blockquote>

                  {m.draft && (
                    <div className="mt-3 rounded-xl border border-kente-200 bg-kente-50 p-3">
                      <p className="label text-xs">
                        ✨ AI draft reply{" "}
                        <span className="font-normal text-ink-500">({m.draft.modelId})</span>
                      </p>
                      <DraftEditor
                        draftId={m.draft.id}
                        initialBody={m.draft.body}
                        status={m.draft.status}
                        busy={busyDraft === m.draft.id}
                        onApprove={(body) => approveDraft(m.draft!.id, body)}
                        onReject={() => rejectDraft(m.draft!.id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DraftEditor({
  draftId: _draftId,
  initialBody,
  status,
  busy,
  onApprove,
  onReject,
}: {
  draftId: string;
  initialBody: string;
  status: string;
  busy: boolean;
  onApprove: (body: string) => void;
  onReject: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  if (status !== "pending") {
    return (
      <div>
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-ink-800">{initialBody}</p>
        <p className="mt-2 text-xs text-ink-500">Status: {status}</p>
      </div>
    );
  }
  return (
    <div>
      <textarea
        className="input min-h-24 bg-white text-sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="btn-primary text-sm"
          onClick={() => onApprove(body)}
          disabled={busy}
        >
          {busy ? "Sending…" : "Approve & send"}
        </button>
        <button
          className="btn-ghost text-sm"
          onClick={onReject}
          disabled={busy}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
