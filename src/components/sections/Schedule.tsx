import type { ScheduleSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Schedule({ section, template }: { section: ScheduleSection; template: Template }) {
  // Group items by date (empty string = main day)
  const groups = new Map<string, ScheduleSection["items"]>();
  for (const it of section.items) {
    const key = it.date || "_main";
    const list = groups.get(key) ?? [];
    list.push(it);
    groups.set(key, list);
  }
  const entries = Array.from(groups.entries());

  return (
    <section style={{ background: template.palette.accentSoft, color: template.palette.ink }}>
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h2
          className="font-display text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: `'${template.fonts.display}', serif` }}
        >
          {section.title}
        </h2>
        <div className="mt-8 space-y-10">
          {entries.map(([dateKey, items]) => (
            <div key={dateKey}>
              {dateKey !== "_main" && (
                <p
                  className="mb-3 text-xs uppercase tracking-[0.25em]"
                  style={{ color: template.palette.inkSoft }}
                >
                  {new Date(dateKey).toLocaleDateString("en-GH", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              <ol className="relative space-y-6 border-l-2 pl-6" style={{ borderColor: template.palette.accent }}>
                {items.map((it, i) => (
                  <li key={i} className="relative">
                    <span
                      className="absolute -left-[33px] mt-1.5 inline-block h-3 w-3 rounded-full"
                      style={{ background: template.palette.accent }}
                    />
                    <p
                      className="text-sm font-medium"
                      style={{ color: template.palette.accent }}
                    >
                      {it.time}
                    </p>
                    <p className="mt-1 font-display text-xl">{it.title}</p>
                    {it.description && (
                      <p className="mt-1" style={{ color: template.palette.inkSoft }}>
                        {it.description}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
