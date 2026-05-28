// The PageDesign type that lives on Event.pageDesign as JSON.
// Versioned so we can migrate later without breaking old events.

import { z } from "zod";

export const PAGE_DESIGN_VERSION = 1;

// ─── Section schemas (the source of truth for everything the page renders) ───

const heroSchema = z.object({
  type: z.literal("hero"),
  id: z.string(),
  eyebrow: z.string().default("We're getting married"),
  headline: z.string(),
  subhead: z.string().default(""),
  dateLine: z.string(),
  locationLine: z.string(),
  imagePrompt: z.string().default(""),
  imageUrl: z.string().nullable().default(null),
});

const storySchema = z.object({
  type: z.literal("story"),
  id: z.string(),
  title: z.string().default("Our story"),
  body: z.string(),
  imagePrompt: z.string().default(""),
  imageUrl: z.string().nullable().default(null),
});

const scheduleItemSchema = z.object({
  time: z.string(),
  title: z.string(),
  description: z.string().default(""),
  date: z.string().default(""),
});

const scheduleSchema = z.object({
  type: z.literal("schedule"),
  id: z.string(),
  title: z.string().default("The day, hour by hour"),
  items: z.array(scheduleItemSchema).min(1),
});

const detailsSchema = z.object({
  type: z.literal("details"),
  id: z.string(),
  title: z.string().default("When & where"),
  venueName: z.string().default(""),
  venueAddress: z.string().default(""),
  dressCode: z.string().default(""),
  notes: z.string().default(""),
});

const faqItemSchema = z.object({ q: z.string(), a: z.string() });

const faqSchema = z.object({
  type: z.literal("faq"),
  id: z.string(),
  title: z.string().default("Good to know"),
  items: z.array(faqItemSchema).min(1),
});

const giftsSchema = z.object({
  type: z.literal("gifts"),
  id: z.string(),
  title: z.string().default("A gift, the Ghanaian way"),
  body: z.string(),
  ctaLabel: z.string().default("Send a MoMo gift"),
});

const rsvpSchema = z.object({
  type: z.literal("rsvp"),
  id: z.string(),
  title: z.string().default("Will you celebrate with us?"),
  body: z.string(),
  deadlineLine: z.string().default(""),
  ctaLabel: z.string().default("RSVP"),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSchema,
  storySchema,
  scheduleSchema,
  detailsSchema,
  faqSchema,
  giftsSchema,
  rsvpSchema,
]);

export type Section = z.infer<typeof sectionSchema>;
export type HeroSection = z.infer<typeof heroSchema>;
export type StorySection = z.infer<typeof storySchema>;
export type ScheduleSection = z.infer<typeof scheduleSchema>;
export type DetailsSection = z.infer<typeof detailsSchema>;
export type FaqSection = z.infer<typeof faqSchema>;
export type GiftsSection = z.infer<typeof giftsSchema>;
export type RsvpSection = z.infer<typeof rsvpSchema>;

export const SECTION_TYPES = [
  "hero",
  "story",
  "schedule",
  "details",
  "faq",
  "gifts",
  "rsvp",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const pageDesignSchema = z.object({
  version: z.literal(PAGE_DESIGN_VERSION),
  templateId: z.string(),
  vibe: z.enum(["warm", "elegant", "bold", "minimal"]).default("warm"),
  sections: z.array(sectionSchema).min(1),
  paletteOverride: z
    .object({
      accent: z.string().optional(),
      ink: z.string().optional(),
      background: z.string().optional(),
    })
    .optional(),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type PageDesign = z.infer<typeof pageDesignSchema>;

export function isPageDesign(value: unknown): value is PageDesign {
  return pageDesignSchema.safeParse(value).success;
}
