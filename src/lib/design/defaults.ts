// Default design generated on the fly when an event has no pageDesign yet.

import { PAGE_DESIGN_VERSION, type PageDesign } from "./types";
import { randomToken } from "@/lib/crypto";

function sid() {
  return randomToken(6);
}

interface EventLike {
  brideName: string | null;
  groomName: string | null;
  title: string;
  eventDate: Date;
  city: string;
  venueName: string | null;
  templateId?: string;
}

export function defaultDesignFor(event: EventLike): PageDesign {
  const couple =
    event.brideName && event.groomName
      ? `${event.brideName} & ${event.groomName}`
      : event.title;
  const dateLine = event.eventDate.toLocaleDateString("en-GH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const locationLine = event.venueName
    ? `${event.venueName} · ${event.city}`
    : event.city;

  return {
    version: PAGE_DESIGN_VERSION,
    templateId: event.templateId ?? "adinkra",
    vibe: "warm",
    sections: [
      {
        type: "hero",
        id: sid(),
        eyebrow: "We're getting married",
        headline: couple,
        subhead: "Come and rejoice with us.",
        dateLine,
        locationLine,
        imagePrompt: "",
        imageUrl: null,
      },
      {
        type: "story",
        id: sid(),
        title: "Our story",
        body:
          "We can't wait to celebrate with you. Use the design studio in your dashboard to write your story, and AI will help you fill in the rest.",
        imagePrompt: "",
        imageUrl: null,
      },
      {
        type: "details",
        id: sid(),
        title: "When & where",
        venueName: event.venueName ?? "",
        venueAddress: "",
        dressCode: "",
        notes: "",
      },
      {
        type: "rsvp",
        id: sid(),
        title: "Will you celebrate with us?",
        body: "Tap below to let us know.",
        deadlineLine: "",
        ctaLabel: "RSVP",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}
