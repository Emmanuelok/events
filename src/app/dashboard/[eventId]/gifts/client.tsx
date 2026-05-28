"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGhs } from "@/lib/money";
import { GIFT_CHANNEL_LABEL, type GiftChannel } from "@/lib/gifts";

interface GiftRow {
  id: string;
  guestName: string;
  guestPhone: string | null;
  amountMinor: number;
  feeMinor: number;
  channel: string;
  message: string | null;
  isPublic: boolean;
  thankedAt: string | null;
  thankYouDraft: string | null;
  settledAt: string;
}

export default function GiftsClient({
  eventId,
  slug,
  initialGifts,
  totals,
}: {
  eventId: string;
  slug: string;
  initialGifts: GiftRow[];
  totals: { count: number; amountMinor: number; feeMinor: number };
}) {
  const router = useRouter();
  const [gifts, setGifts] = useState<GiftRow[]>(initialGifts);
  const [active, setActive] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function draftThanks(giftId: string) {
    setError(null);
    setDrafting(giftId);
    try {
      const r = await fetch(`/api/events/${eventId}/gifts/${giftId}/thank-you`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft" }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not draft");
        return;
      }
      setGifts((prev) =>
        prev.map((g) => (g.id === giftId ? { ...g, thankYouDraft: data.text } : g)),
      );
    } finally {
      setDrafting(null);
    }
  }

  async function markSent(giftId: string, text: string) {
    const r = await fetch(`/api/events/${eventId}/gifts/${giftId}/thank-you`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", method: "whatsapp", text }),
    });
    if (r.ok) {
      setGifts((prev) =>
        prev.map((g) =>
          g.id === giftId ? { ...g, thankedAt: new Date().toISOString(), thankYouDraft: text } : g,
        ),
      );
      router.refresh();
    }
  }

  function openWhatsApp(phone: string | null, text: string) {
    const cleaned = phone?.replace("+", "") ?? "";
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  const pendingThanks = gifts.filter((g) => !g.thankedAt).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-sm text-ink-600">Gifts received</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink-900">{totals.count}</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-600">Total to the couple</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink-900">
            {formatGhs(totals.amountMinor)}
          </p>
          <p className="mt-1 text-xs text-ink-500">{formatGhs(totals.feeMinor)} in fees (guest-paid)</p>
        </div>
        <div className="card">
          <p className="text-sm text-ink-600">Thank-yous pending</p>
          <p className="mt-1 font-display text-3xl font-semibold text-kente-700">{pendingThanks}</p>
          <p className="mt-1 text-xs text-ink-500">Tap a gift to draft with AI.</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-900">Your gift link</h2>
            <p className="mt-1 text-sm text-ink-600">
              Share this anywhere — on the event page, in WhatsApp groups, on the invite.
            </p>
          </div>
          <code className="rounded-xl bg-ink-100 px-3 py-2 text-sm text-ink-900">
            /e/{slug}/gift
          </code>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden p-0">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink-900">All gifts</h2>
        </div>
        {gifts.length === 0 ? (
          <p className="px-5 py-12 text-center text-ink-600">
            No gifts yet. Share your gift link with guests.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {gifts.map((g) => (
              <li key={g.id} className="px-5 py-4">
                <button
                  type="button"
                  onClick={() => setActive(active === g.id ? null : g.id)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{g.guestName}</p>
                    <p className="text-sm text-ink-600">
                      {GIFT_CHANNEL_LABEL[g.channel as GiftChannel]} ·{" "}
                      {new Date(g.settledAt).toLocaleString("en-GH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold text-ink-900">
                      {formatGhs(g.amountMinor)}
                    </p>
                    {g.thankedAt ? (
                      <span className="chip bg-forest-100 text-forest-800">Thanked</span>
                    ) : (
                      <span className="chip bg-amber-100 text-amber-800">Pending</span>
                    )}
                  </div>
                </button>

                {active === g.id && (
                  <div className="mt-4 space-y-3 rounded-xl bg-ink-50 p-4">
                    {g.message && (
                      <div>
                        <p className="label text-xs">Their message</p>
                        <p className="rounded-lg bg-white px-3 py-2 text-sm text-ink-800">
                          &ldquo;{g.message}&rdquo;
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="label text-xs">AI thank-you draft</p>
                      {g.thankYouDraft ? (
                        <textarea
                          className="input min-h-28 text-sm"
                          value={g.thankYouDraft}
                          onChange={(e) =>
                            setGifts((prev) =>
                              prev.map((x) =>
                                x.id === g.id ? { ...x, thankYouDraft: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      ) : (
                        <button
                          className="btn-primary text-sm"
                          onClick={() => draftThanks(g.id)}
                          disabled={drafting === g.id}
                        >
                          {drafting === g.id ? "Drafting…" : "✨ Draft with AI"}
                        </button>
                      )}
                    </div>
                    {g.thankYouDraft && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="btn-primary text-sm"
                          onClick={() => openWhatsApp(g.guestPhone, g.thankYouDraft!)}
                          disabled={!g.guestPhone}
                          title={g.guestPhone ? "Send via WhatsApp" : "No phone number"}
                        >
                          Send via WhatsApp
                        </button>
                        <button
                          className="btn-secondary text-sm"
                          onClick={() => markSent(g.id, g.thankYouDraft!)}
                        >
                          Mark as sent
                        </button>
                        <button
                          className="btn-ghost text-sm"
                          onClick={() => draftThanks(g.id)}
                          disabled={drafting === g.id}
                        >
                          {drafting === g.id ? "Re-drafting…" : "Re-draft"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
