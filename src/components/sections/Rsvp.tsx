import Link from "next/link";
import type { RsvpSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Rsvp({
  section,
  template,
  rsvpHref,
}: {
  section: RsvpSection;
  template: Template;
  rsvpHref: string;
}) {
  return (
    <section style={{ background: template.palette.accentSoft, color: template.palette.ink }}>
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2
          className="font-display text-3xl font-semibold sm:text-4xl"
          style={{ fontFamily: `'${template.fonts.display}', serif` }}
        >
          {section.title}
        </h2>
        <p className="mt-4 text-lg" style={{ color: template.palette.inkSoft }}>
          {section.body}
        </p>
        {section.deadlineLine && (
          <p className="mt-2 text-sm font-medium" style={{ color: template.palette.accent }}>
            {section.deadlineLine}
          </p>
        )}
        <Link
          href={rsvpHref}
          className="btn mt-6 inline-flex px-8 py-3.5 text-base font-semibold"
          style={{ background: template.palette.accent, color: template.palette.accentInk }}
        >
          {section.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
