"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PageDesign, Section, SectionType } from "@/lib/design/types";

interface TemplateChoice {
  id: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  accentSoft: string;
}

const VIBES: { id: "warm" | "elegant" | "bold" | "minimal"; label: string; description: string }[] = [
  { id: "warm", label: "Warm", description: "Kente, storytelling, family-led." },
  { id: "elegant", label: "Elegant", description: "Editorial, airy, quiet luxury." },
  { id: "bold", label: "Bold", description: "High contrast, magazine-cover energy." },
  { id: "minimal", label: "Minimal", description: "Pared-back, type-led, modern." },
];

export default function DesignStudio({
  eventId,
  slug,
  initialDesign,
  templates,
}: {
  eventId: string;
  slug: string;
  initialDesign: PageDesign;
  templates: TemplateChoice[];
}) {
  const router = useRouter();
  const [design, setDesign] = useState<PageDesign>(initialDesign);
  const [vibe, setVibe] = useState<"warm" | "elegant" | "bold" | "minimal">(initialDesign.vibe);
  const [templateId, setTemplateId] = useState(initialDesign.templateId);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiSource, setAiSource] = useState<"ai" | "template" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionType | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  async function generateAll() {
    setError(null);
    if (brief.trim().length < 10) {
      setError("Tell us a sentence or two about you both — at least 10 characters.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/design/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, vibe, templateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate design");
        return;
      }
      setDesign(data.design);
      setAiSource(data.source);
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function switchTemplate(nextId: string) {
    setTemplateId(nextId);
    const updated: PageDesign = { ...design, templateId: nextId, updatedAt: new Date().toISOString() };
    setDesign(updated);
    await fetch(`/api/events/${eventId}/design`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design: updated }),
    });
    router.refresh();
  }

  async function regenerateSection(type: SectionType, prompt: string) {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/design/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionType: type, prompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not regenerate");
        return;
      }
      const next: Section = data.section;
      setDesign((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => (s.type === type ? next : s)),
      }));
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function updateSection(type: SectionType, updates: Partial<Section>) {
    const next: PageDesign = {
      ...design,
      sections: design.sections.map((s) =>
        s.type === type ? ({ ...s, ...updates } as Section) : s,
      ),
      updatedAt: new Date().toISOString(),
    };
    setDesign(next);
    await fetch(`/api/events/${eventId}/design`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design: next }),
    });
  }

  async function generateImageFor(type: "hero" | "story") {
    const target = design.sections.find((s) => s.type === type);
    if (!target || (target.type !== "hero" && target.type !== "story")) return;
    const prompt =
      target.imagePrompt ||
      (type === "hero"
        ? "Editorial portrait of a Ghanaian couple in kente, warm golden hour light, tasteful and photographic."
        : "Candid Ghanaian couple laughing together, documentary style, soft natural light.");

    setImageBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio: type === "hero" ? "16:9" : "4:5",
          attachTo: { sectionType: type },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate image");
        return;
      }
      setDesign((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.type === type && (s.type === "hero" || s.type === "story")
            ? { ...s, imageUrl: data.asset.url }
            : s,
        ),
      }));
      router.refresh();
    } finally {
      setImageBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Brief card */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Design Studio</h1>
            <p className="mt-1 text-sm text-ink-600">
              Tell us about you in a sentence or two. Claude writes your whole site — copy, schedule,
              FAQ — tuned to a Ghanaian wedding. Edit anything inline.
            </p>
          </div>
          {aiSource && (
            <span
              className={
                aiSource === "ai"
                  ? "chip bg-kente-100 text-kente-800"
                  : "chip bg-ink-200 text-ink-700"
              }
            >
              {aiSource === "ai" ? "✨ Generated by Claude" : "Template (no AI key)"}
            </span>
          )}
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="brief">
            About you both
          </label>
          <textarea
            id="brief"
            className="input min-h-24 text-base"
            placeholder="We met at university in Legon five years ago. Kwame proposed in Cape Coast, on the beach, with akple. We want our wedding to feel like a Saturday afternoon at home with our families."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={2000}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            {brief.length}/2000 — be specific, that&apos;s what makes the output sing.
          </p>
        </div>

        <div className="mt-5">
          <p className="label">Vibe</p>
          <div className="flex flex-wrap gap-2">
            {VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVibe(v.id)}
                className={
                  vibe === v.id
                    ? "rounded-2xl bg-kente-600 px-4 py-3 text-left text-sm text-white"
                    : "rounded-2xl bg-ink-100 px-4 py-3 text-left text-sm text-ink-800 hover:bg-ink-200"
                }
              >
                <p className="font-medium">{v.label}</p>
                <p className="text-xs opacity-80">{v.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="label">Template</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {templates.map((t) => {
              const selected = templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTemplateId(t.id);
                    switchTemplate(t.id);
                  }}
                  className={
                    selected
                      ? "rounded-2xl bg-white p-4 text-left text-sm shadow-soft ring-2 ring-kente-500"
                      : "rounded-2xl bg-white p-4 text-left text-sm ring-1 ring-ink-200 hover:ring-ink-300"
                  }
                >
                  <div
                    className="mb-3 h-10 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${t.accent}, ${t.accentSoft})`,
                    }}
                  />
                  <p className="font-display text-base text-ink-900">{t.name}</p>
                  <p className="mt-1 text-xs text-ink-600">{t.tagline}</p>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          <button onClick={generateAll} className="btn-primary" disabled={generating}>
            {generating ? "Writing your site…" : "Generate my site"}
          </button>
          <a
            href={`/e/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary text-sm"
          >
            Preview public page ↗
          </a>
        </div>
      </div>

      {/* Sections editor + preview */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {design.sections.map((s) => (
            <SectionEditor
              key={s.id}
              section={s}
              active={activeSection === s.type}
              busy={generating}
              imageBusy={imageBusy}
              onActivate={() => setActiveSection(activeSection === s.type ? null : s.type)}
              onSave={(updates) => updateSection(s.type, updates)}
              onRegenerate={(prompt) => regenerateSection(s.type, prompt)}
              onGenerateImage={
                s.type === "hero" || s.type === "story" ? () => generateImageFor(s.type) : undefined
              }
            />
          ))}
        </div>

        <DesignPreview design={design} slug={slug} />
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  active,
  busy,
  imageBusy,
  onActivate,
  onSave,
  onRegenerate,
  onGenerateImage,
}: {
  section: Section;
  active: boolean;
  busy: boolean;
  imageBusy: boolean;
  onActivate: () => void;
  onSave: (updates: Partial<Section>) => void;
  onRegenerate: (prompt: string) => void;
  onGenerateImage?: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  return (
    <div className="card">
      <button
        type="button"
        onClick={onActivate}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-500">{section.type}</p>
          <p className="font-display text-lg text-ink-900">{summary(section)}</p>
        </div>
        <span className="text-xs text-ink-500">{active ? "Close" : "Edit"}</span>
      </button>

      {active && (
        <div className="mt-4 space-y-3 border-t border-ink-100 pt-4">
          <SectionFields section={section} onChange={onSave} />

          {onGenerateImage && (
            <div className="rounded-xl bg-ink-50 p-3">
              <p className="text-sm font-medium text-ink-800">AI image for this section</p>
              <p className="mt-1 text-xs text-ink-600">
                Uses the image prompt above. Currently <strong>mocked</strong> (Picsum placeholder)
                unless you set <code className="rounded bg-ink-100 px-1 text-[10px]">IMAGE_PROVIDER=gemini</code>{" "}
                + <code className="rounded bg-ink-100 px-1 text-[10px]">GEMINI_API_KEY</code>.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 text-sm"
                onClick={onGenerateImage}
                disabled={imageBusy}
              >
                {imageBusy ? "Generating…" : "Generate image"}
              </button>
            </div>
          )}

          <div className="rounded-xl bg-ink-50 p-3">
            <label className="label text-xs">Rewrite this section with AI</label>
            <div className="flex gap-2">
              <input
                className="input text-sm"
                placeholder="e.g. make it shorter and mention Cape Coast"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  if (prompt.trim().length >= 5) {
                    onRegenerate(prompt);
                    setPrompt("");
                  }
                }}
                disabled={busy}
              >
                Rewrite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function summary(s: Section): string {
  switch (s.type) {
    case "hero":
      return s.headline || "Hero";
    case "story":
      return s.title;
    case "schedule":
      return `${s.title} · ${s.items.length} items`;
    case "details":
      return s.title;
    case "faq":
      return `${s.title} · ${s.items.length} questions`;
    case "gifts":
      return s.title;
    case "rsvp":
      return s.title;
  }
}

function SectionFields({
  section,
  onChange,
}: {
  section: Section;
  onChange: (updates: Partial<Section>) => void;
}) {
  if (section.type === "hero") {
    return (
      <div className="space-y-3">
        <Field label="Eyebrow" value={section.eyebrow} onChange={(v) => onChange({ eyebrow: v })} />
        <Field label="Headline" value={section.headline} onChange={(v) => onChange({ headline: v })} />
        <Field label="Subhead" value={section.subhead} onChange={(v) => onChange({ subhead: v })} />
        <Field
          label="Image prompt"
          value={section.imagePrompt}
          onChange={(v) => onChange({ imagePrompt: v })}
          hint="Used for AI image generation."
        />
      </div>
    );
  }
  if (section.type === "story") {
    return (
      <div className="space-y-3">
        <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
        <Field
          label="Body"
          value={section.body}
          onChange={(v) => onChange({ body: v })}
          textarea
        />
        <Field
          label="Image prompt"
          value={section.imagePrompt}
          onChange={(v) => onChange({ imagePrompt: v })}
        />
      </div>
    );
  }
  if (section.type === "schedule") {
    return (
      <div className="space-y-3">
        <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
        <p className="text-xs text-ink-500">Edit items by re-running the AI rewrite below.</p>
        <ul className="text-sm">
          {section.items.map((it, i) => (
            <li key={i} className="border-b border-ink-100 py-2">
              <span className="font-mono text-xs text-ink-500">{it.time}</span>{" "}
              <strong className="text-ink-900">{it.title}</strong>{" "}
              <span className="text-ink-600">— {it.description}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (section.type === "details") {
    return (
      <div className="space-y-3">
        <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
        <Field
          label="Venue name"
          value={section.venueName}
          onChange={(v) => onChange({ venueName: v })}
        />
        <Field
          label="Venue address"
          value={section.venueAddress}
          onChange={(v) => onChange({ venueAddress: v })}
        />
        <Field
          label="Dress code"
          value={section.dressCode}
          onChange={(v) => onChange({ dressCode: v })}
        />
        <Field label="Notes" value={section.notes} onChange={(v) => onChange({ notes: v })} textarea />
      </div>
    );
  }
  if (section.type === "faq") {
    return (
      <div className="space-y-3">
        <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
        <ul className="text-sm">
          {section.items.map((q, i) => (
            <li key={i} className="border-b border-ink-100 py-2">
              <p className="font-medium text-ink-900">{q.q}</p>
              <p className="text-ink-600">{q.a}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (section.type === "gifts") {
    return (
      <div className="space-y-3">
        <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
        <Field label="Body" value={section.body} onChange={(v) => onChange({ body: v })} textarea />
        <Field
          label="CTA label"
          value={section.ctaLabel}
          onChange={(v) => onChange({ ctaLabel: v })}
        />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Title" value={section.title} onChange={(v) => onChange({ title: v })} />
      <Field label="Body" value={section.body} onChange={(v) => onChange({ body: v })} textarea />
      <Field
        label="Deadline line"
        value={section.deadlineLine}
        onChange={(v) => onChange({ deadlineLine: v })}
      />
      <Field
        label="CTA label"
        value={section.ctaLabel}
        onChange={(v) => onChange({ ctaLabel: v })}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="label text-xs">{label}</label>
      {textarea ? (
        <textarea
          className="input min-h-20 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function DesignPreview({ design, slug }: { design: PageDesign; slug: string }) {
  const url = `/e/${slug}`;
  return (
    <div className="lg:sticky lg:top-4">
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <p className="text-sm font-medium text-ink-900">Live preview</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-kente-700">
            Open in new tab ↗
          </a>
        </div>
        <iframe
          key={design.updatedAt}
          src={url}
          className="block aspect-[9/16] w-full bg-white sm:aspect-[3/4] lg:aspect-[4/5]"
          title="Public event preview"
        />
      </div>
    </div>
  );
}
