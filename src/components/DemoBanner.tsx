import Link from "next/link";
import { env } from "@/lib/env";

export function DemoBanner() {
  if (!env().DEMO_MODE) return null;
  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-amber-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs">
        <span>⚠️</span>
        <p>
          <strong>Demo mode</strong> — phone OTP is bypassed. Set{" "}
          <code className="rounded bg-amber-200 px-1">DEMO_MODE=0</code> to restore real auth.
        </p>
        <Link
          href="/dashboard"
          className="ml-auto rounded bg-amber-950 px-2 py-0.5 font-medium text-amber-50"
        >
          Open dashboard →
        </Link>
        <Link
          href="/e/ama-kwame"
          className="rounded bg-amber-200 px-2 py-0.5 font-medium text-amber-900"
        >
          Public event page ↗
        </Link>
      </div>
    </div>
  );
}
