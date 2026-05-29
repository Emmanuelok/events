// Concierge tool dispatcher. Each handler returns a serializable result and
// writes an AuditLog entry for state-changing tools.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { sendInvitation, buildVars } from "@/lib/messaging/send";
import { ingestInboundMessage } from "@/lib/messaging/ingest";
import { draftThankYou } from "@/lib/ai/thank-you";
import { regenerateSection, designBriefSchema } from "@/lib/ai/design-studio";
import { getImageProvider } from "@/lib/providers/image";
import { pageDesignSchema, type PageDesign } from "@/lib/design/types";
import { requiresConfirmation } from "./tools";
import { formatGhs, minorToGhs as _minorToGhs } from "@/lib/money";
export type DispatchContext = {
  eventId: string;
  userId: string;
};

/** Generic result shape returned to Claude as tool_result content. */
export type ToolResult =
  | { ok: true; data: unknown; humanSummary?: string }
  | { ok: false; error: string; needsConfirmation?: boolean; preview?: unknown };

interface AnyInput {
  [k: string]: unknown;
}

export async function dispatch(
  toolName: string,
  rawInput: unknown,
  ctx: DispatchContext,
): Promise<ToolResult> {
  const input = (rawInput && typeof rawInput === "object" ? rawInput : {}) as AnyInput;

  try {
    switch (toolName) {
      case "get_event_summary":
        return await handleGetEventSummary(ctx);
      case "search_guests":
        return await handleSearchGuests(input, ctx);
      case "send_invitations":
        return await handleSendInvitations(input, ctx);
      case "draft_thank_you":
        return await handleDraftThankYou(input, ctx);
      case "regenerate_section":
        return await handleRegenerateSection(input, ctx);
      case "update_budget_item":
        return await handleUpdateBudgetItem(input, ctx);
      case "simulate_inbound_message":
        return await handleSimulateInbound(input, ctx);
      case "approve_ai_draft":
        return await handleApproveDraft(input, ctx);
      case "generate_image_for_section":
        return await handleGenerateImage(input, ctx);
      default:
        return { ok: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Read-only tools ───

async function handleGetEventSummary(ctx: DispatchContext): Promise<ToolResult> {
  const event = await db.event.findUnique({
    where: { id: ctx.eventId },
    include: {
      _count: { select: { guests: true } },
      rsvps: { select: { status: true } },
      budget: { select: { totalMinor: true } },
    },
  });
  if (!event) return { ok: false, error: "Event not found" };

  const rsvpCounts = event.rsvps.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const pendingDrafts = await db.aiDraft.count({
    where: { status: "pending", inboundMessage: { eventId: ctx.eventId } },
  });
  const giftAgg = await db.gift.aggregate({
    where: { eventId: ctx.eventId },
    _sum: { amountMinor: true },
    _count: true,
  });
  const missingRsvp = await db.guest.findMany({
    where: { eventId: ctx.eventId, rsvp: null },
    select: { id: true, displayName: true, phone: true, groupTag: true },
    take: 30,
  });

  const daysUntil = Math.ceil(
    (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return {
    ok: true,
    data: {
      title: event.title,
      eventDate: event.eventDate.toISOString(),
      city: event.city,
      daysUntil,
      guestCount: event._count.guests,
      rsvpCounts: {
        yes: rsvpCounts.yes ?? 0,
        no: rsvpCounts.no ?? 0,
        maybe: rsvpCounts.maybe ?? 0,
        pending: missingRsvp.length,
      },
      gifts: {
        count: giftAgg._count,
        totalGhs: (giftAgg._sum.amountMinor ?? 0) / 100,
      },
      pendingDrafts,
      missingRsvpSample: missingRsvp.slice(0, 10),
      budget: event.budget ? { totalGhs: event.budget.totalMinor / 100 } : null,
    },
    humanSummary: `${event.title} · ${daysUntil} days to go · ${event._count.guests} guests · ${rsvpCounts.yes ?? 0} yes / ${rsvpCounts.maybe ?? 0} maybe / ${rsvpCounts.no ?? 0} no / ${missingRsvp.length} pending · ${formatGhs(giftAgg._sum.amountMinor ?? 0)} in gifts · ${pendingDrafts} drafts waiting`,
  };
}

async function handleSearchGuests(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const rsvpStatus = typeof input.rsvp_status === "string" ? input.rsvp_status : "any";
  const groupTag = typeof input.group_tag === "string" ? input.group_tag : undefined;
  const hasPhone = typeof input.has_phone === "boolean" ? input.has_phone : undefined;
  const hasResponded = typeof input.has_responded === "boolean" ? input.has_responded : undefined;

  const where: Prisma.GuestWhereInput = { eventId: ctx.eventId };
  if (groupTag) where.groupTag = groupTag;
  if (hasPhone === true) where.phone = { not: "" };

  if (rsvpStatus === "pending" || hasResponded === false) {
    where.rsvp = null;
  } else if (rsvpStatus !== "any") {
    where.rsvp = {
      is: { status: rsvpStatus as "yes" | "no" | "maybe" },
    };
  } else if (hasResponded === true) {
    where.rsvp = { isNot: null };
  }

  const guests = await db.guest.findMany({
    where,
    include: { rsvp: { select: { status: true, plusOnes: true } } },
    take: 50,
  });

  return {
    ok: true,
    data: guests.map((g) => ({
      id: g.id,
      name: g.displayName,
      phone: g.phone,
      group: g.groupTag,
      plusOnesAllowed: g.plusOnesAllowed,
      rsvp: g.rsvp?.status ?? "pending",
      plusOnes: g.rsvp?.plusOnes ?? 0,
    })),
    humanSummary: `Found ${guests.length} matching guest${guests.length === 1 ? "" : "s"}.`,
  };
}

// ─── Write tools (require confirm=true) ───

async function handleSendInvitations(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const templateKey = String(input.template_key ?? "");
  const target = input.target;
  const confirm = input.confirm === true;
  const validTemplates = ["save_the_date", "rsvp_reminder", "thank_you_followup"];
  if (!validTemplates.includes(templateKey)) {
    return { ok: false, error: `Invalid template_key. Use one of: ${validTemplates.join(", ")}` };
  }

  // Resolve target guests
  let guests: { id: string; displayName: string; phone: string; shortCode: string }[];
  if (target === "missing_rsvp") {
    guests = await db.guest.findMany({
      where: { eventId: ctx.eventId, rsvp: null },
    });
  } else if (target === "all") {
    guests = await db.guest.findMany({ where: { eventId: ctx.eventId } });
  } else if (Array.isArray(target)) {
    const ids = target.filter((x): x is string => typeof x === "string");
    guests = await db.guest.findMany({ where: { eventId: ctx.eventId, id: { in: ids } } });
  } else {
    return { ok: false, error: "target must be 'missing_rsvp', 'all', or an array of guest ids." };
  }

  if (guests.length === 0) {
    return { ok: true, data: { sent: 0, target }, humanSummary: "No matching guests to send to." };
  }

  if (!confirm && requiresConfirmation("send_invitations")) {
    return {
      ok: false,
      error: "Confirmation required",
      needsConfirmation: true,
      preview: {
        templateKey,
        guestCount: guests.length,
        sampleNames: guests.slice(0, 5).map((g) => g.displayName),
      },
    };
  }

  const event = await db.event.findUnique({
    where: { id: ctx.eventId },
    select: {
      slug: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      city: true,
    },
  });
  if (!event) return { ok: false, error: "Event not found" };

  let sent = 0;
  let failed = 0;
  for (const g of guests) {
    const vars = buildVars({
      brideName: event.brideName,
      groomName: event.groomName,
      eventDate: event.eventDate,
      city: event.city,
      slug: event.slug,
      guestShortCode: g.shortCode,
      guestDisplayName: g.displayName,
    });
    const r = await sendInvitation({
      eventId: ctx.eventId,
      guestId: g.id,
      toPhone: g.phone,
      channelPreference: "auto",
      templateKey: templateKey as "save_the_date" | "rsvp_reminder" | "thank_you_followup",
      vars,
    });
    if (r.ok) sent++;
    else failed++;
  }

  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.send_invitations",
      metadata: { templateKey, sent, failed, target },
    },
  });

  return {
    ok: true,
    data: { sent, failed, templateKey },
    humanSummary: `Sent ${sent} ${templateKey.replace(/_/g, " ")}${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`,
  };
}

async function handleDraftThankYou(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const giftId = String(input.gift_id ?? "");
  const gift = await db.gift.findFirst({
    where: { id: giftId, eventId: ctx.eventId },
    include: { event: true },
  });
  if (!gift) return { ok: false, error: "Gift not found" };

  const result = await draftThankYou(
    {
      brideName: gift.event.brideName ?? "We",
      groomName: gift.event.groomName ?? "",
      guestName: gift.guestName,
      amountMinor: gift.amountMinor,
      guestMessage: gift.message,
    },
    { eventId: ctx.eventId, userId: ctx.userId, giftId },
  );
  return {
    ok: true,
    data: { text: result.text, source: result.source, giftId },
    humanSummary: `Drafted thank-you for ${gift.guestName}.`,
  };
}

async function handleRegenerateSection(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const sectionType = String(input.section_type ?? "") as
    | "hero"
    | "story"
    | "schedule"
    | "details"
    | "faq"
    | "gifts"
    | "rsvp";
  const prompt = String(input.prompt ?? "");
  if (!sectionType || !prompt) return { ok: false, error: "section_type and prompt required" };

  const event = await db.event.findUnique({ where: { id: ctx.eventId } });
  if (!event) return { ok: false, error: "Event not found" };

  const existing = pageDesignSchema.safeParse(event.pageDesign);
  if (!existing.success) {
    return {
      ok: false,
      error: "No design yet — open the Design Studio and generate the page first.",
    };
  }
  const design: PageDesign = existing.data;

  const settings = (event.settings as Record<string, unknown>) ?? {};
  const components = ((settings.components as ("traditional" | "white_wedding")[] | undefined) ?? [
    "white_wedding",
  ]).filter(
    (c): c is "traditional" | "white_wedding" => c === "traditional" || c === "white_wedding",
  );

  const brief = designBriefSchema.parse({
    brideName: event.brideName ?? "Bride",
    groomName: event.groomName ?? "Groom",
    eventDate: event.eventDate.toISOString(),
    city: event.city,
    venueName: event.venueName ?? "",
    brief: prompt,
    vibe: design.vibe,
    templateId: design.templateId as "adinkra" | "modern" | "kente",
    components: components.length ? components : ["white_wedding"],
  });

  const { section, source } = await regenerateSection(design, sectionType, prompt, brief, {
    eventId: ctx.eventId,
    userId: ctx.userId,
  });

  const nextSections = design.sections.map((s) => (s.type === sectionType ? section : s));
  const nextDesign: PageDesign = {
    ...design,
    sections: nextSections,
    updatedAt: new Date().toISOString(),
  };
  await db.event.update({
    where: { id: ctx.eventId },
    data: {
      pageDesign: nextDesign as unknown as Prisma.InputJsonValue,
      designVersion: { increment: 1 },
    },
  });

  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.regenerate_section",
      metadata: { sectionType, source },
    },
  });

  return {
    ok: true,
    data: { sectionType, source },
    humanSummary: `Regenerated the ${sectionType} section.`,
  };
}

async function handleUpdateBudgetItem(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const category = String(input.category ?? "");
  const plannedMinor = Number(input.planned_minor);
  const confirm = input.confirm === true;
  if (!category || !Number.isInteger(plannedMinor) || plannedMinor < 0) {
    return { ok: false, error: "Need category and integer planned_minor (>= 0)" };
  }
  const item = await db.budgetLineItem.findFirst({
    where: { category, budget: { eventId: ctx.eventId } },
  });
  if (!item) return { ok: false, error: `No budget line with category '${category}'.` };

  if (!confirm) {
    return {
      ok: false,
      error: "Confirmation required",
      needsConfirmation: true,
      preview: {
        category,
        oldMinor: item.plannedMinor,
        newMinor: plannedMinor,
        deltaGhs: (plannedMinor - item.plannedMinor) / 100,
      },
    };
  }

  await db.budgetLineItem.update({
    where: { id: item.id },
    data: { plannedMinor },
  });
  // Recompute total
  const items = await db.budgetLineItem.findMany({ where: { budgetId: item.budgetId } });
  const newTotal = items.reduce((sum, i) => sum + i.plannedMinor, 0);
  await db.budget.update({ where: { id: item.budgetId }, data: { totalMinor: newTotal } });

  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.update_budget_item",
      metadata: { category, oldMinor: item.plannedMinor, newMinor: plannedMinor },
    },
  });

  return {
    ok: true,
    data: { category, newMinor: plannedMinor, newTotalMinor: newTotal },
    humanSummary: `Updated ${category} to ${formatGhs(plannedMinor)} (new total: ${formatGhs(newTotal)}).`,
  };
}

async function handleSimulateInbound(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const fromPhone = String(input.from_phone ?? "");
  const body = String(input.body ?? "");
  if (!fromPhone || !body) return { ok: false, error: "from_phone and body required" };
  const r = await ingestInboundMessage({ fromPhone, body, channel: "whatsapp" });
  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.simulate_inbound",
      metadata: { fromPhone, intent: r.intent ?? null },
    },
  });
  return {
    ok: true,
    data: r,
    humanSummary: `Simulated inbound from ${fromPhone}; intent classified as ${r.intent ?? "unknown"}.`,
  };
}

async function handleApproveDraft(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const draftId = String(input.draft_id ?? "");
  const body = String(input.body ?? "");
  const confirm = input.confirm === true;
  if (!draftId || !body) return { ok: false, error: "draft_id and body required" };

  const draft = await db.aiDraft.findUnique({
    where: { id: draftId },
    include: { inboundMessage: { include: { guest: true, event: true } } },
  });
  if (!draft || draft.inboundMessage.eventId !== ctx.eventId) {
    return { ok: false, error: "Draft not found for this event" };
  }
  if (draft.status !== "pending") {
    return { ok: false, error: `Draft is already ${draft.status}` };
  }

  if (!confirm) {
    return {
      ok: false,
      error: "Confirmation required",
      needsConfirmation: true,
      preview: { draftId, willSendTo: draft.inboundMessage.guest?.phone, body },
    };
  }

  // Reuse approval logic inline (we avoid HTTP self-call from the dispatcher)
  const guest = draft.inboundMessage.guest;
  if (!guest) return { ok: false, error: "No guest attached to this inbound message" };

  // Apply structured RSVP update if intent is clear
  const intent = draft.inboundMessage.intent;
  if (intent === "rsvp_yes" || intent === "rsvp_no" || intent === "rsvp_maybe") {
    const status = intent === "rsvp_yes" ? "yes" : intent === "rsvp_no" ? "no" : "maybe";
    await db.rsvp.upsert({
      where: { guestId: guest.id },
      update: {
        status,
        channel: draft.inboundMessage.channel === "whatsapp" ? "whatsapp" : "sms",
        respondedAt: new Date(),
      },
      create: {
        guestId: guest.id,
        eventId: ctx.eventId,
        status,
        channel: draft.inboundMessage.channel === "whatsapp" ? "whatsapp" : "sms",
        respondedAt: new Date(),
      },
    });
  }

  const out = await db.outboundMessage.create({
    data: {
      eventId: ctx.eventId,
      guestId: guest.id,
      toPhone: guest.phone,
      channel: draft.inboundMessage.channel,
      templateKey: "rsvp_reply",
      body,
      status: "queued",
      provider: "pending",
    },
  });

  const { getWhatsAppProvider } = await import("@/lib/providers/whatsapp");
  const { getSmsProvider } = await import("@/lib/providers/sms");
  const provider =
    draft.inboundMessage.channel === "whatsapp" ? getWhatsAppProvider() : getSmsProvider();
  const result = await provider.send({ to: guest.phone, body });
  await db.outboundMessage.update({
    where: { id: out.id },
    data: {
      provider: provider.name(),
      status: result.ok ? "sent" : "failed",
      sentAt: result.ok ? new Date() : null,
      providerMessageId: result.ok ? result.messageId : null,
      failureReason: result.ok ? null : result.error,
    },
  });
  await db.aiDraft.update({
    where: { id: draft.id },
    data: {
      draftBody: body,
      status: result.ok ? "approved" : "pending",
      approverUserId: ctx.userId,
      approvedAt: new Date(),
      sentOutboundMessageId: out.id,
    },
  });
  await db.inboundMessage.update({
    where: { id: draft.inboundMessageId },
    data: { handledByUserId: ctx.userId, handledAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.approve_ai_draft",
      target: draft.id,
      metadata: { ok: result.ok, channel: draft.inboundMessage.channel },
    },
  });

  return {
    ok: true,
    data: { draftId: draft.id, sent: result.ok },
    humanSummary: result.ok
      ? `Sent reply to ${guest.displayName} via ${draft.inboundMessage.channel}.`
      : `Send failed: ${"error" in result ? result.error : "unknown error"}`,
  };
}

async function handleGenerateImage(input: AnyInput, ctx: DispatchContext): Promise<ToolResult> {
  const sectionType = String(input.section_type ?? "") as "hero" | "story";
  if (sectionType !== "hero" && sectionType !== "story") {
    return { ok: false, error: "section_type must be 'hero' or 'story'" };
  }

  const event = await db.event.findUnique({ where: { id: ctx.eventId } });
  if (!event) return { ok: false, error: "Event not found" };
  const existing = pageDesignSchema.safeParse(event.pageDesign);
  if (!existing.success) return { ok: false, error: "No design yet" };
  const design = existing.data;
  const target = design.sections.find((s) => s.type === sectionType);
  if (!target || (target.type !== "hero" && target.type !== "story")) {
    return { ok: false, error: "Section not found" };
  }
  const prompt =
    target.imagePrompt ||
    (sectionType === "hero"
      ? "Editorial portrait of a Ghanaian couple in kente at golden hour, photographic."
      : "Candid documentary photograph of a Ghanaian couple laughing together.");

  const provider = getImageProvider();
  let generated;
  try {
    generated = await provider.generate({
      prompt,
      aspectRatio: sectionType === "hero" ? "16:9" : "4:5",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Image generation failed",
    };
  }

  await db.mediaAsset.create({
    data: {
      eventId: ctx.eventId,
      kind: "image",
      url: generated.url,
      prompt,
      provider: generated.provider,
      modelId: generated.modelId,
      mimeType: generated.mimeType,
      width: generated.width,
      height: generated.height,
    },
  });

  const sections = design.sections.map((s) => {
    if (s.type !== sectionType) return s;
    if (s.type === "hero" || s.type === "story") {
      return { ...s, imageUrl: generated.url };
    }
    return s;
  });
  const next = { ...design, sections, updatedAt: new Date().toISOString() };
  await db.event.update({
    where: { id: ctx.eventId },
    data: {
      pageDesign: next as unknown as Prisma.InputJsonValue,
      designVersion: { increment: 1 },
    },
  });

  await db.auditLog.create({
    data: {
      eventId: ctx.eventId,
      actorUserId: ctx.userId,
      action: "concierge.generate_image",
      metadata: { sectionType, provider: generated.provider },
    },
  });

  return {
    ok: true,
    data: { sectionType, provider: generated.provider, url: generated.url },
    humanSummary: `Generated a new ${sectionType} image via ${generated.provider}.`,
  };
}
