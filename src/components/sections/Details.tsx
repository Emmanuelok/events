import type { DetailsSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Details({ section, template }: { section: DetailsSection; template: Template }) {
  const cards = [
    section.venueName ? { label: "Venue", value: section.venueName, sub: section.venueAddress } : null,
    section.dressCode ? { label: "Dress code", value: section.dressCode, sub: "" } : null,
    section.notes ? { label: "Good to know", value: section.notes, sub: "" } : null,
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  if (cards.length === 0) return null;

  return (
    <section style={{ background: template.palette.background, color: template.palette.ink }}>
      <div className="mx-auto max-w-5xl px-5 py-20">
        <h2
          className="font-display text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: `'${template.fonts.display}', serif` }}
        >
          {section.title}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.label}
              className="rounded-2xl p-6 shadow-soft ring-1"
              style={{ background: template.palette.surface, borderColor: "transparent" as never }}
            >
              <p
                className="text-xs uppercase tracking-[0.25em]"
                style={{ color: template.palette.inkSoft }}
              >
                {c.label}
              </p>
              <p className="mt-2 font-display text-xl">{c.value}</p>
              {c.sub && (
                <p className="mt-1 text-sm" style={{ color: template.palette.inkSoft }}>
                  {c.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
