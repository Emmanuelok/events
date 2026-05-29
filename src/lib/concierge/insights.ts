// Deterministic Proactive Insights: looks at the event's current state and
// produces up to N short, actionable cards. No AI calls — pure data.

import { db } from "@/lib/db";
import { pageDesignSchema } from "@/lib/design/types";

export interface Insight {
  id: string;
  severity: "info" | "warn" | "urgent";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  conciergePrompt: string; // what gets sent to the agent if the user clicks "Ask Concierge"
}

const MAX_INSIGHTS = 3;

export async function computeInsights(eventId: string): Promise<Insight[]> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { guests: true } },
      rsvps: { select: { status: true } },
      budget: { include: { items: true } },
    },
  });
  if (!event) return [];

  const insights: Insight[] = [];
  const daysUntil = Math.ceil(
    (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  // ── 1) Pending AI drafts ──
  const pendingDrafts = await db.aiDraft.count({
    where: { status: "pending", inboundMessage: { eventId } },
  });
  if (pendingDrafts > 0) {
    insights.push({
      id: "pending_drafts",
      severity: pendingDrafts >= 5 ? "urgent" : "warn",
      title: `${pendingDrafts} AI ${pendingDrafts === 1 ? "draft" : "drafts"} waiting`,
      body: "Guests have replied; Claude has drafted responses you just need to approve.",
      ctaLabel: "Open AI Inbox",
      ctaHref: `/dashboard/${eventId}/inbox`,
      conciergePrompt: "Walk me through the pending AI drafts in the inbox.",
    });
  }

  // ── 2) Missing RSVPs (esp. close to event) ──
  const guestCount = event._count.guests;
  const responded = event.rsvps.length;
  const missing = guestCount - responded;
  if (missing > 0 && guestCount > 0) {
    const isUrgent = daysUntil <= 21 && missing >= 5;
    insights.push({
      id: "missing_rsvps",
      severity: isUrgent ? "urgent" : missing >= 10 ? "warn" : "info",
      title: `${missing} ${missing === 1 ? "guest hasn't" : "guests haven't"} replied`,
      body: isUrgent
        ? `Event is ${daysUntil} days away — send reminders today.`
        : "Send a quick reminder over WhatsApp.",
      ctaLabel: "Send RSVP reminder",
      ctaHref: `/dashboard/${eventId}/guests`,
      conciergePrompt: `Send an RSVP reminder to the ${missing} guests who haven't replied yet.`,
    });
  }

  // ── 3) Hero image is a placeholder ──
  const designParsed = pageDesignSchema.safeParse(event.pageDesign);
  if (designParsed.success) {
    const hero = designParsed.data.sections.find((s) => s.type === "hero");
    if (hero && hero.type === "hero" && !hero.imageUrl) {
      insights.push({
        id: "no_hero_image",
        severity: "info",
        title: "Hero image is still a placeholder",
        body: "Generate a cinematic AI hero image for your event page.",
        ctaLabel: "Open Design Studio",
        ctaHref: `/dashboard/${eventId}/design`,
        conciergePrompt: "Generate a hero image for our event page.",
      });
    }
  } else {
    insights.push({
      id: "no_design",
      severity: "warn",
      title: "Your event page is still default",
      body: "Generate your wedding website from a one-paragraph brief.",
      ctaLabel: "Open Design Studio",
      ctaHref: `/dashboard/${eventId}/design`,
      conciergePrompt: "Help me write the brief for our event page.",
    });
  }

  // ── 4) Budget overruns ──
  if (event.budget) {
    const items = event.budget.items;
    let worst: { category: string; over: number; label: string } | null = null;
    for (const it of items) {
      const high = it.highMinor;
      if (high > 0 && it.plannedMinor > high) {
        const overPct = ((it.plannedMinor - high) / high) * 100;
        if (!worst || overPct > worst.over) {
          worst = { category: it.category, over: overPct, label: it.label };
        }
      }
    }
    if (worst) {
      insights.push({
        id: "budget_overrun",
        severity: worst.over > 25 ? "urgent" : "warn",
        title: `${worst.label} is ${Math.round(worst.over)}% above typical`,
        body: "You may want to renegotiate or trim the scope.",
        ctaLabel: "Open budget",
        ctaHref: `/dashboard/${eventId}/budget`,
        conciergePrompt: `Help me trim the ${worst.label} budget item.`,
      });
    }
  }

  // ── 5) Countdown call-to-action ──
  if (daysUntil >= 0 && daysUntil <= 7) {
    insights.push({
      id: "final_week",
      severity: "info",
      title: `T-${daysUntil} days`,
      body: "Final-week checklist: confirm vendors, print seating, brief MC.",
      ctaLabel: "Open overview",
      ctaHref: `/dashboard/${eventId}`,
      conciergePrompt: "Give me my final-week checklist.",
    });
  }

  // Sort: urgent first, then warn, then info; keep original insertion order within bands.
  const order = { urgent: 0, warn: 1, info: 2 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);
  return insights.slice(0, MAX_INSIGHTS);
}
