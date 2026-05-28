import Link from "next/link";
import type { PageDesign, Section } from "@/lib/design/types";
import { getTemplate } from "@/lib/design/templates";
import { Hero } from "./Hero";
import { Story } from "./Story";
import { Schedule } from "./Schedule";
import { Details } from "./Details";
import { Faq } from "./Faq";
import { Gifts } from "./Gifts";
import { Rsvp } from "./Rsvp";

export function PublicEventPage({
  design,
  slug,
}: {
  design: PageDesign;
  slug: string;
}) {
  const template = getTemplate(design.templateId);
  const rsvpHref = `/e/${slug}/rsvp`;

  return (
    <main
      style={{
        background: template.palette.background,
        color: template.palette.ink,
        fontFamily: `'${template.fonts.body}', system-ui, sans-serif`,
      }}
    >
      {design.sections.map((s) => (
        <SectionRenderer
          key={s.id}
          section={s}
          template={template}
          rsvpHref={rsvpHref}
        />
      ))}

      <footer style={{ background: template.palette.surface, color: template.palette.inkSoft }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-5 py-6 text-sm">
          <p>
            Made with love on{" "}
            <Link
              href="/"
              className="font-medium"
              style={{ color: template.palette.accent }}
            >
              Celebrate
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}

function SectionRenderer({
  section,
  template,
  rsvpHref,
}: {
  section: Section;
  template: ReturnType<typeof getTemplate>;
  rsvpHref: string;
}) {
  switch (section.type) {
    case "hero":
      return <Hero section={section} template={template} rsvpHref={rsvpHref} />;
    case "story":
      return <Story section={section} template={template} />;
    case "schedule":
      return <Schedule section={section} template={template} />;
    case "details":
      return <Details section={section} template={template} />;
    case "faq":
      return <Faq section={section} template={template} />;
    case "gifts":
      return <Gifts section={section} template={template} />;
    case "rsvp":
      return <Rsvp section={section} template={template} rsvpHref={rsvpHref} />;
  }
}
