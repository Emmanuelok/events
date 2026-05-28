"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatGhs } from "@/lib/money";

interface IntentSummary {
  status: "initiated" | "authorized" | "succeeded" | "failed" | "reversed";
  amountMinor: number;
  feeMinor: number;
  totalMinor: number;
  guestName: string;
  channel: string;
  failureReason?: string;
}

export default function CallbackClient({ reference, slug }: { reference: string; slug: string }) {
  const [intent, setIntent] = useState<IntentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!reference) {
      setError("Missing gift reference.");
      return;
    }
    let cancelled = false;

    async function tick() {
      try {
        // Always verify first — handles mock mode and ensures the server has the latest state.
        const v = await fetch(`/api/gifts/${reference}/verify`, { method: "POST" });
        const vd = (await v.json()) as { status?: IntentSummary["status"]; error?: string };
        if (!v.ok && vd.error) setError(vd.error);

        const r = await fetch(`/api/gifts/${reference}/status`);
        const rd = (await r.json()) as { intent?: IntentSummary; error?: string };
        if (!r.ok) {
          setError(rd.error ?? "Could not load status");
          return;
        }
        if (cancelled) return;
        if (rd.intent) setIntent(rd.intent);
      } finally {
        if (!cancelled) setAttempts((a) => a + 1);
      }
    }

    tick();
    // Poll a few times in case the webhook is slightly delayed (real Paystack).
    const interval = setInterval(() => {
      if (intent?.status === "succeeded" || intent?.status === "failed" || attempts > 8) {
        clearInterval(interval);
        return;
      }
      tick();
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  if (error) {
    return (
      <div className="card text-center">
        <p className="text-3xl">⚠️</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-600">{error}</p>
        <Link href={`/e/${slug}/gift`} className="btn-secondary mt-4 inline-flex text-sm">
          Try again
        </Link>
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="card text-center">
        <p className="text-3xl">⏳</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink-900">
          Confirming your gift…
        </h1>
        <p className="mt-2 text-sm text-ink-600">This usually takes a few seconds.</p>
      </div>
    );
  }

  if (intent.status === "succeeded") {
    return (
      <div className="card text-center">
        <p className="text-3xl">🎉</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink-900">Thank you!</h1>
        <p className="mt-2 text-ink-700">
          Your gift of <strong>{formatGhs(intent.amountMinor)}</strong> is on its way to the couple.
        </p>
        <p className="mt-1 text-sm text-ink-600">
          They&apos;ll see your name and message on their dashboard.
        </p>
        <Link href={`/e/${slug}`} className="btn-secondary mt-5 inline-flex text-sm">
          Back to the event page
        </Link>
      </div>
    );
  }

  if (intent.status === "failed") {
    return (
      <div className="card text-center">
        <p className="text-3xl">😬</p>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink-900">Gift not completed</h1>
        <p className="mt-2 text-sm text-ink-600">
          {intent.failureReason ?? "We didn't see a successful charge from the gateway."}
        </p>
        <Link href={`/e/${slug}/gift`} className="btn-primary mt-5 inline-flex text-sm">
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="card text-center">
      <p className="text-3xl">⏳</p>
      <h1 className="mt-2 font-display text-xl font-semibold text-ink-900">
        Almost there…
      </h1>
      <p className="mt-2 text-sm text-ink-600">
        Approve the prompt on your phone. We&apos;ll update this page automatically.
      </p>
    </div>
  );
}
