import type { StorySection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Story({ section, template }: { section: StorySection; template: Template }) {
  const paragraphs = section.body.split(/\n\n+/).filter(Boolean);
  return (
    <section style={{ background: template.palette.background, color: template.palette.ink }}>
      <div className="mx-auto max-w-5xl px-5 py-20">
        <div className={section.imageUrl ? "grid gap-10 md:grid-cols-2 md:items-center" : ""}>
          <div>
            <h2
              className="font-display text-3xl font-semibold sm:text-4xl"
              style={{ fontFamily: `'${template.fonts.display}', serif` }}
            >
              {section.title}
            </h2>
            <div className="mt-5 space-y-4 text-lg leading-relaxed" style={{ color: template.palette.inkSoft }}>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          {section.imageUrl && (
            <img
              src={section.imageUrl}
              alt=""
              className="aspect-[4/5] w-full rounded-3xl object-cover shadow-soft"
            />
          )}
        </div>
      </div>
    </section>
  );
}
