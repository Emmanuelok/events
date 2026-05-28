import { env } from "@/lib/env";

export function DemoBanner() {
  if (!env().DEMO_MODE) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1.5 text-xs">
        <span>⚠️</span>
        <p>
          <strong>Demo mode</strong> — phone OTP is bypassed and anyone can view every event. Set{" "}
          <code className="rounded bg-amber-200 px-1">DEMO_MODE=0</code> in your Vercel env to
          restore auth.
        </p>
      </div>
    </div>
  );
}
