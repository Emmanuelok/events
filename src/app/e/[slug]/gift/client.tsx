"use client";

import { useMemo, useState } from "react";
import { ghsToMinor, formatGhs, giftFeeMinor, totalWithFeeMinor } from "@/lib/money";
import { GIFT_CHANNEL_LABEL, GIFT_CHANNELS, type GiftChannel } from "@/lib/gifts";

const PRESETS_GHS = [100, 250, 500, 1000];

function makeIdempotencyKey(): string {
  return `gift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function GiftClient({ eventId, slug: _slug }: { eventId: string; slug: string }) {
  const [amountGhs, setAmountGhs] = useState<number>(250);
  const [channel, setChannel] = useState<GiftChannel>("momo_mtn");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState<string>(() => makeIdempotencyKey());

  const amountMinor = useMemo(() => (Number.isFinite(amountGhs) ? ghsToMinor(amountGhs) : 0), [amountGhs]);
  const feeMinor = useMemo(() => (amountMinor > 0 ? giftFeeMinor(amountMinor) : 0), [amountMinor]);
  const totalMinor = useMemo(() => (amountMinor > 0 ? totalWithFeeMinor(amountMinor) : 0), [amountMinor]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountMinor < 500) {
      setError("Minimum gift is GHS 5.");
      return;
    }
    if (!name.trim()) {
      setError("Please tell the couple your name.");
      return;
    }
    if (channel !== "card" && !phone.trim()) {
      setError("Add the phone number your MoMo wallet is registered on.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/gifts/intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor,
          channel,
          guestName: name.trim(),
          guestPhone: phone.trim() || undefined,
          message: message.trim() || undefined,
          isPublic,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start your gift");
        return;
      }
      // Redirect to the gateway-provided authorization URL.
      // In mock mode this is our own callback page with status=success.
      window.location.href = data.authorizationUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div className="card">
        <label className="label" htmlFor="amount">
          Gift amount
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS_GHS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmountGhs(p)}
              className={
                amountGhs === p
                  ? "rounded-full bg-kente-600 px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full bg-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-200"
              }
            >
              GH₵ {p}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-base font-medium text-ink-700">GH₵</span>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            min={5}
            max={50000}
            step={1}
            className="input flex-1"
            value={amountGhs}
            onChange={(e) => setAmountGhs(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div className="mt-4 rounded-xl bg-ink-50 px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-600">Gift</span>
            <span className="font-medium text-ink-900">{formatGhs(amountMinor)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-600">Service fee</span>
            <span className="font-medium text-ink-900">{formatGhs(feeMinor)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-ink-200 pt-2">
            <span className="font-semibold text-ink-900">You pay</span>
            <span className="font-semibold text-ink-900">{formatGhs(totalMinor)}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            The couple receives {formatGhs(amountMinor)} in full.
          </p>
        </div>
      </div>

      <div className="card">
        <p className="label">How will you pay?</p>
        <div className="grid grid-cols-2 gap-2">
          {GIFT_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={
                channel === c
                  ? "rounded-xl bg-kente-600 px-3 py-3 text-sm font-medium text-white"
                  : "rounded-xl bg-ink-100 px-3 py-3 text-sm font-medium text-ink-700 hover:bg-ink-200"
              }
            >
              {GIFT_CHANNEL_LABEL[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Akosua Mensah"
          />
        </div>
        {channel !== "card" && (
          <div>
            <label className="label" htmlFor="phone">
              MoMo number
            </label>
            <input
              id="phone"
              type="tel"
              className="input"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0244 123 456"
            />
            <p className="mt-1 text-xs text-ink-500">
              You&apos;ll get a prompt on this number to confirm the gift.
            </p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="message">
            A short message <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <textarea
            id="message"
            className="input min-h-20"
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Congratulations! Wishing you both a lifetime of joy."
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300"
          />
          Show my name and message on the couple&apos;s gift wall.
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className="btn-primary w-full text-base" disabled={loading}>
        {loading ? "Starting your gift…" : `Pay ${formatGhs(totalMinor)}`}
      </button>
      <p className="text-center text-xs text-ink-500">
        Powered by Paystack. Your card / MoMo details never touch our servers.
      </p>
    </form>
  );
}
