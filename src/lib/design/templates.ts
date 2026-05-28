// Three launch templates. Each defines a palette + fonts + a heroLayout hint.
// The actual section renderers live in src/components/sections; templates only
// own the tokens, not the markup.

export type TemplateId = "adinkra" | "modern" | "kente";

export interface Template {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  vibe: "warm" | "elegant" | "bold" | "minimal";
  palette: {
    accent: string;        // primary brand color
    accentSoft: string;    // tinted background
    accentInk: string;     // text-on-accent
    background: string;    // page bg
    surface: string;       // card bg
    ink: string;           // body text
    inkSoft: string;       // muted text
  };
  fonts: {
    display: string;       // headings
    body: string;          // body text
  };
  heroStyle: "image-bg" | "split" | "centered-portrait";
  ornament: "adinkra" | "lines" | "geometric" | "none";
}

export const TEMPLATES: Record<TemplateId, Template> = {
  adinkra: {
    id: "adinkra",
    name: "Adinkra",
    tagline: "Kente-warm, story-led, unmistakably Ghanaian.",
    description:
      "Earthy ochre, kente accents, and Adinkra symbols. Built for traditional engagements and white weddings that lean into the culture.",
    vibe: "warm",
    palette: {
      accent: "#bc4a0b",
      accentSoft: "#fff8ed",
      accentInk: "#ffffff",
      background: "#fffaf2",
      surface: "#ffffff",
      ink: "#1f1c19",
      inkSoft: "#5b554c",
    },
    fonts: {
      display: "Fraunces",
      body: "Inter",
    },
    heroStyle: "image-bg",
    ornament: "adinkra",
  },
  modern: {
    id: "modern",
    name: "Modern Romance",
    tagline: "Editorial, airy, quietly luxurious.",
    description:
      "Cream backgrounds, fine serif headlines, generous whitespace. The look couples send to friends who told them their wedding site looked 'so well done.'",
    vibe: "elegant",
    palette: {
      accent: "#2f3a2a",
      accentSoft: "#f1f8f3",
      accentInk: "#ffffff",
      background: "#fbf8f3",
      surface: "#ffffff",
      ink: "#2a2620",
      inkSoft: "#736c60",
    },
    fonts: {
      display: "Fraunces",
      body: "Inter",
    },
    heroStyle: "centered-portrait",
    ornament: "lines",
  },
  kente: {
    id: "kente",
    name: "Kente Bold",
    tagline: "High contrast, modern Pan-African energy.",
    description:
      "Saturated kente colors meet a bold modern type system. Best for couples who want their site to look like a magazine cover.",
    vibe: "bold",
    palette: {
      accent: "#316b4b",
      accentSoft: "#deeee2",
      accentInk: "#ffffff",
      background: "#0f2017",
      surface: "#1d3a2b",
      ink: "#fbf8f3",
      inkSoft: "#bedcc7",
    },
    fonts: {
      display: "Fraunces",
      body: "Inter",
    },
    heroStyle: "split",
    ornament: "geometric",
  },
};

export const TEMPLATE_LIST: Template[] = Object.values(TEMPLATES);

export function getTemplate(id: string): Template {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.adinkra;
}
