import Link from "next/link";
import AskConciergeButton from "./AskConciergeButton";
import type { Insight } from "@/lib/concierge/insights";

const TONE: Record<Insight["severity"], string> = {
  urgent: "bg-red-50 ring-red-200 text-red-900",
  warn: "bg-amber-50 ring-amber-200 text-amber-900",
  info: "bg-forest-50 ring-forest-200 text-forest-900",
};
const ICON: Record<Insight["severity"], string> = {
  urgent: "🚨",
  warn: "⚠️",
  info: "✨",
};

export default function InsightsStrip({
  eventId,
  insights,
}: {
  eventId: string;
  insights: Insight[];
}) {
  if (insights.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {insights.map((i) => (
        <div key={i.id} className={`rounded-2xl p-4 ring-1 ${TONE[i.severity]}`}>
          <p className="text-xs uppercase tracking-widest opacity-75">
            <span className="mr-1">{ICON[i.severity]}</span>
            {i.severity === "urgent" ? "Action needed" : i.severity === "warn" ? "Heads up" : "Tip"}
          </p>
          <p className="mt-1 font-display text-lg font-semibold">{i.title}</p>
          <p className="mt-1 text-sm opacity-90">{i.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={i.ctaHref}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-sm ring-1 ring-ink-200"
            >
              {i.ctaLabel}
            </Link>
            <AskConciergeButton
              eventId={eventId}
              prompt={i.conciergePrompt}
              className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Ask the Concierge ✨
            </AskConciergeButton>
          </div>
        </div>
      ))}
    </div>
  );
}
