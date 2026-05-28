import Link from "next/link";
import type { HeroSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Hero({
  section,
  template,
  rsvpHref,
}: {
  section: HeroSection;
  template: Template;
  rsvpHref: string;
}) {
  const hasImage = !!section.imageUrl;

  if (template.heroStyle === "centered-portrait") {
    return (
      <section
        className="relative overflow-hidden"
        style={{ background: template.palette.background, color: template.palette.ink }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center px-5 pb-20 pt-20 text-center sm:pt-28">
          <p
            className="text-xs uppercase tracking-[0.35em]"
            style={{ color: template.palette.inkSoft }}
          >
            {section.eyebrow}
          </p>
          <h1
            className="mt-5 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl"
            style={{ fontFamily: `'${template.fonts.display}', serif` }}
          >
            {section.headline}
          </h1>
          {section.subhead && (
            <p
              className="mt-4 max-w-xl text-lg"
              style={{ color: template.palette.inkSoft }}
            >
              {section.subhead}
            </p>
          )}
          {hasImage && (
            <div className="mt-10 w-full max-w-2xl">
              <img
                src={section.imageUrl ?? ""}
                alt=""
                className="aspect-[4/5] w-full rounded-3xl object-cover shadow-soft"
              />
            </div>
          )}
          <p className="mt-8 text-base" style={{ color: template.palette.ink }}>
            {section.dateLine}
          </p>
          <p style={{ color: template.palette.inkSoft }}>{section.locationLine}</p>
          <Link
            href={rsvpHref}
            className="btn mt-8 px-6 py-3 text-sm font-semibold"
            style={{ background: template.palette.accent, color: template.palette.accentInk }}
          >
            RSVP
          </Link>
        </div>
      </section>
    );
  }

  if (template.heroStyle === "split") {
    return (
      <section
        className="relative overflow-hidden"
        style={{ background: template.palette.background, color: template.palette.ink }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p
              className="text-xs uppercase tracking-[0.3em]"
              style={{ color: template.palette.inkSoft }}
            >
              {section.eyebrow}
            </p>
            <h1
              className="mt-4 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl"
              style={{ fontFamily: `'${template.fonts.display}', serif` }}
            >
              {section.headline}
            </h1>
            {section.subhead && (
              <p
                className="mt-4 max-w-xl text-lg"
                style={{ color: template.palette.inkSoft }}
              >
                {section.subhead}
              </p>
            )}
            <p className="mt-8 text-base" style={{ color: template.palette.ink }}>
              {section.dateLine}
            </p>
            <p style={{ color: template.palette.inkSoft }}>{section.locationLine}</p>
            <Link
              href={rsvpHref}
              className="btn mt-8 px-6 py-3 text-sm font-semibold"
              style={{ background: template.palette.accent, color: template.palette.accentInk }}
            >
              RSVP
            </Link>
          </div>
          <div className="relative">
            <div
              className="absolute -inset-4 rounded-3xl opacity-50 blur-2xl"
              style={{
                background: `linear-gradient(135deg, ${template.palette.accent}, ${template.palette.accentSoft})`,
              }}
            />
            {hasImage ? (
              <img
                src={section.imageUrl ?? ""}
                alt=""
                className="relative aspect-[4/5] w-full rounded-3xl object-cover shadow-soft"
              />
            ) : (
              <div
                className="relative aspect-[4/5] w-full rounded-3xl"
                style={{
                  background: `linear-gradient(135deg, ${template.palette.accent}, ${template.palette.accentSoft})`,
                }}
              />
            )}
          </div>
        </div>
      </section>
    );
  }

  // image-bg (default)
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        backgroundImage: hasImage
          ? `linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 90%), url(${section.imageUrl})`
          : `linear-gradient(135deg, ${template.palette.accent}, #793311 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:py-32">
        <p className="text-xs uppercase tracking-[0.35em] opacity-90">{section.eyebrow}</p>
        <h1
          className="mt-4 font-display text-5xl font-semibold leading-[1.05] sm:text-7xl"
          style={{ fontFamily: `'${template.fonts.display}', serif` }}
        >
          {section.headline}
        </h1>
        {section.subhead && (
          <p className="mt-5 mx-auto max-w-xl text-lg opacity-95">{section.subhead}</p>
        )}
        <p className="mt-8 text-base">{section.dateLine}</p>
        <p className="opacity-90">{section.locationLine}</p>
        <Link
          href={rsvpHref}
          className="btn mt-8 px-6 py-3 text-sm font-semibold"
          style={{ background: "#ffffff", color: template.palette.ink }}
        >
          RSVP
        </Link>
      </div>
    </section>
  );
}
