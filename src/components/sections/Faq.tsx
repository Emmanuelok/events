import type { FaqSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Faq({ section, template }: { section: FaqSection; template: Template }) {
  return (
    <section style={{ background: template.palette.accentSoft, color: template.palette.ink }}>
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h2
          className="font-display text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: `'${template.fonts.display}', serif` }}
        >
          {section.title}
        </h2>
        <div className="mt-8 divide-y" style={{ borderColor: "rgba(0,0,0,0.08)" } as never}>
          {section.items.map((it, i) => (
            <details key={i} className="group py-5">
              <summary
                className="flex cursor-pointer items-center justify-between font-display text-lg"
                style={{ color: template.palette.ink }}
              >
                <span>{it.q}</span>
                <span
                  className="ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs transition group-open:rotate-45"
                  style={{ background: template.palette.accent, color: template.palette.accentInk }}
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-base leading-relaxed" style={{ color: template.palette.inkSoft }}>
                {it.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
