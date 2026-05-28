"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "phone" | "code";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not send code");
        return;
      }
      if (data.devCode) setDevCode(data.devCode);
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, displayName: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not verify code");
        return;
      }
      if (data.firstTime) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-kente-50 to-white">
      <header className="mx-auto w-full max-w-6xl px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-lg bg-gradient-to-br from-kente-500 to-kente-700" />
          <span className="font-display text-xl font-semibold text-ink-900">Celebrate</span>
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <div className="card">
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {step === "phone" ? "Sign in with your phone" : "Enter the 6-digit code"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {step === "phone"
              ? "We'll send a code by SMS. Your MoMo number works great here."
              : `We sent a code to ${phone}.`}
          </p>

          {step === "phone" ? (
            <form className="mt-5 space-y-4" onSubmit={requestCode}>
              <div>
                <label htmlFor="phone" className="label">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="0244 123 456"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  Ghana numbers only. We&apos;ll auto-format to +233.
                </p>
              </div>
              <div>
                <label htmlFor="name" className="label">
                  Your name <span className="font-normal text-ink-500">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ama Owusu"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form className="mt-5 space-y-4" onSubmit={verifyCode}>
              <div>
                <label htmlFor="code" className="label">
                  6-digit code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  placeholder="123456"
                  className="input tracking-[0.5em] text-center text-xl"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {devCode && (
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
                  <span className="font-medium">Dev mode:</span> your code is{" "}
                  <span className="font-mono">{devCode}</span>
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setDevCode(null);
                  setError(null);
                }}
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
