"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Guest {
  id: string;
  displayName: string;
  phone: string;
  groupTag: string | null;
  plusOnesAllowed: number;
  invitedVia: string;
  shortCode: string;
  rsvpStatus: string;
}

function statusChip(status: string) {
  switch (status) {
    case "yes":
      return <span className="chip bg-forest-100 text-forest-800">Yes</span>;
    case "no":
      return <span className="chip bg-red-100 text-red-800">No</span>;
    case "maybe":
      return <span className="chip bg-amber-100 text-amber-800">Maybe</span>;
    default:
      return <span className="chip bg-ink-100 text-ink-700">Pending</span>;
  }
}

export default function GuestsClient({
  eventId,
  initialGuests,
}: {
  eventId: string;
  initialGuests: Guest[];
}) {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [groupTag, setGroupTag] = useState("");
  const [plusOnes, setPlusOnes] = useState(0);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function addOne(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          phone,
          groupTag: groupTag || undefined,
          plusOnesAllowed: plusOnes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.errors?.length) {
        setError(`Failed: ${data.errors[0].reason}`);
        return;
      }
      setName("");
      setPhone("");
      setGroupTag("");
      setPlusOnes(0);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function addBulk(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const parsed = lines.map((line) => {
      const [n, p, g] = line.split(",").map((s) => s?.trim());
      return { displayName: n ?? "", phone: p ?? "", groupTag: g || undefined, plusOnesAllowed: 0 };
    });
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setBulkText("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this guest?")) return;
    setGuests((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/events/${eventId}/guests/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const [bulkBusy, setBulkBusy] = useState<null | "save_the_date" | "rsvp_reminder">(null);
  const [sendResult, setSendResult] = useState<string | null>(null);
  async function bulkSend(templateKey: "save_the_date" | "rsvp_reminder") {
    setBulkBusy(templateKey);
    setSendResult(null);
    try {
      const r = await fetch(`/api/events/${eventId}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey, channelPreference: "auto", all: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        setSendResult(d.error ?? "Send failed");
        return;
      }
      setSendResult(`Sent ${d.sent} · skipped ${d.skipped} · failed ${d.failed}`);
      router.refresh();
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900">Add one guest</h2>
          <form onSubmit={addOne} className="mt-3 space-y-3">
            <input
              className="input"
              placeholder="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              type="tel"
              placeholder="0244 123 456"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Group (family, work…)"
                value={groupTag}
                onChange={(e) => setGroupTag(e.target.value)}
              />
              <input
                className="input"
                type="number"
                min={0}
                max={5}
                placeholder="+1s allowed"
                value={plusOnes}
                onChange={(e) => setPlusOnes(Number(e.target.value) || 0)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              Add guest
            </button>
          </form>
        </div>

        <div className="card">
          <h2 className="font-display text-lg font-semibold text-ink-900">Bulk add (paste CSV)</h2>
          <p className="mt-1 text-sm text-ink-600">
            One per line: <code className="text-xs">Name, 024xxxxxxx, group</code>
          </p>
          <form onSubmit={addBulk} className="mt-3 space-y-3">
            <textarea
              className="input min-h-32 font-mono text-sm"
              placeholder="Ama Owusu, 0244111111, family\nKwame Boateng, 0501234567, work"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <button type="submit" className="btn-secondary w-full" disabled={loading}>
              Import
            </button>
          </form>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            Send invitations & reminders
          </h2>
          <p className="text-sm text-ink-600">
            WhatsApp first, SMS fallback. Same template won&apos;t resend within 24 hours.
          </p>
        </div>
        <button
          className="btn-primary text-sm"
          onClick={() => bulkSend("save_the_date")}
          disabled={bulkBusy !== null || guests.length === 0}
        >
          {bulkBusy === "save_the_date" ? "Sending…" : "Send save-the-date to all"}
        </button>
        <button
          className="btn-secondary text-sm"
          onClick={() => bulkSend("rsvp_reminder")}
          disabled={bulkBusy !== null || guests.length === 0}
        >
          {bulkBusy === "rsvp_reminder" ? "Sending…" : "Send RSVP reminder"}
        </button>
      </div>
      {sendResult && <p className="text-sm text-ink-700">{sendResult}</p>}

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">
            {guests.length} guest{guests.length === 1 ? "" : "s"}
          </h2>
        </div>
        {guests.length === 0 ? (
          <p className="px-5 py-12 text-center text-ink-600">
            No guests yet. Add your first one above.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {guests.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{g.displayName}</p>
                  <p className="text-sm text-ink-600">
                    {g.phone}
                    {g.groupTag ? ` · ${g.groupTag}` : ""}
                    {g.plusOnesAllowed > 0 ? ` · +${g.plusOnesAllowed}` : ""}
                  </p>
                </div>
                <div>{statusChip(g.rsvpStatus)}</div>
                <a
                  href={`/r/${g.shortCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-kente-700 underline"
                >
                  RSVP link
                </a>
                <button
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => remove(g.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
