"use client";

import { useState } from "react";

type Step = "phone" | "code" | "details" | "done";

export default function RsvpClient({ slug, eventId }: { slug: string; eventId: string }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"yes" | "no" | "maybe">("yes");
  const [plusOnes, setPlusOnes] = useState(0);
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/rsvp/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, slug }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not send code");
        return;
      }
      if (data.devCode) setDevCode(data.devCode);
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/rsvp/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, slug }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      if (data.guest?.displayName) setName(data.guest.displayName);
      setStep("details");
    } finally {
      setLoading(false);
    }
  }

  async function submitRsvp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/rsvp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          phone,
          displayName: name,
          status,
          plusOnes,
          dietary: dietary || undefined,
          message: message || undefined,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Could not submit RSVP");
        return;
      }
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mt-8 card text-center">
        <p className="text-3xl">🎉</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-ink-900">
          {status === "yes"
            ? "Wonderful — see you there!"
            : status === "maybe"
              ? "Thanks, we'll keep your spot."
              : "Thanks for letting us know."}
        </h2>
        <p className="mt-2 text-sm text-ink-600">Your RSVP has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="mt-8 card">
      {step === "phone" && (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="phone">
              Your phone number
            </label>
            <input
              id="phone"
              type="tel"
              required
              placeholder="0244 123 456"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Sending…" : "Continue"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyAndContinue} className="space-y-4">
          <p className="text-sm text-ink-600">We sent a 6-digit code to {phone}.</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            className="input tracking-[0.5em] text-center text-xl"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          {devCode && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              <span className="font-medium">Dev mode:</span>{" "}
              <span className="font-mono">{devCode}</span>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}

      {step === "details" && (
        <form onSubmit={submitRsvp} className="space-y-4">
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Will you attend?</label>
            <div className="grid grid-cols-3 gap-2">
              {(["yes", "maybe", "no"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={
                    status === s
                      ? "rounded-xl bg-kente-600 px-3 py-3 text-sm font-medium text-white"
                      : "rounded-xl bg-ink-100 px-3 py-3 text-sm font-medium text-ink-700 hover:bg-ink-200"
                  }
                >
                  {s === "yes" ? "Yes" : s === "maybe" ? "Maybe" : "No"}
                </button>
              ))}
            </div>
          </div>
          {status !== "no" && (
            <>
              <div>
                <label className="label">Bringing anyone? (+1s)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  className="input"
                  value={plusOnes}
                  onChange={(e) => setPlusOnes(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="label">Dietary needs (optional)</label>
                <input
                  className="input"
                  placeholder="None / Vegetarian / Allergies"
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                />
              </div>
            </>
          )}
          <div>
            <label className="label">A message for the couple (optional)</label>
            <textarea
              className="input min-h-20"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Saving…" : "Send RSVP"}
          </button>
        </form>
      )}
    </div>
  );
}
