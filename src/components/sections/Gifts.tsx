import Link from "next/link";
import type { GiftsSection } from "@/lib/design/types";
import type { Template } from "@/lib/design/templates";

export function Gifts({
  section,
  template,
  giftHref,
}: {
  section: GiftsSection;
  template: Template;
  giftHref: string;
}) {
  return (
    <section style={{ background: template.palette.background, color: template.palette.ink }}>
      <div className="mx-auto max-w-3xl px-5 py-20">
        <div
          className="rounded-3xl p-8 sm:p-10"
          style={{
            background: `linear-gradient(135deg, ${template.palette.accent}, ${shade(template.palette.accent, -30)})`,
            color: template.palette.accentInk,
          }}
        >
          <h2
            className="font-display text-3xl font-semibold sm:text-4xl"
            style={{ fontFamily: `'${template.fonts.display}', serif` }}
          >
            {section.title}
          </h2>
          <p className="mt-4 text-lg opacity-95">{section.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
              MTN MoMo
            </div>
            <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
              Telecel Cash
            </div>
            <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
              AirtelTigo Money
            </div>
            <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur">
              Card
            </div>
          </div>
          <Link
            href={giftHref}
            className="btn mt-7 px-6 py-3 text-sm font-semibold"
            style={{ background: "#ffffff", color: template.palette.ink }}
          >
            {section.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

function shade(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = clamp(parseInt(n.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(n.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(n.slice(4, 6), 16) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}
function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}
