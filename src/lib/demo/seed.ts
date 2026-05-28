// Seeds a rich "Ama & Kwame" example event so demo-mode reviewers see the
// whole platform working on first dashboard visit — no empty states.
//
// Idempotent: re-running returns the existing event by stable slug.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { generateShortCode, randomToken } from "@/lib/crypto";
import { PAGE_DESIGN_VERSION, type PageDesign } from "@/lib/design/types";
import { templateBudget } from "@/lib/ai/budget";

const DEMO_SLUG = "ama-kwame";

const DEMO_GUESTS: Array<{
  name: string;
  phone: string;
  group: string;
  plus: number;
  rsvp: "yes" | "no" | "maybe" | null;
  dietary?: string;
  message?: string;
}> = [
  { name: "Akosua Mensah", phone: "+233244000101", group: "family", plus: 1, rsvp: "yes", message: "So excited for you both!" },
  { name: "Yaw Boateng", phone: "+233244000102", group: "family", plus: 2, rsvp: "yes" },
  { name: "Esi Owusu", phone: "+233244000103", group: "family", plus: 0, rsvp: "yes", dietary: "Vegetarian" },
  { name: "Kojo Asante", phone: "+233244000104", group: "friends", plus: 1, rsvp: "yes" },
  { name: "Adwoa Sarpong", phone: "+233244000105", group: "friends", plus: 0, rsvp: "yes" },
  { name: "Kofi Nkrumah", phone: "+233244000106", group: "friends", plus: 1, rsvp: "maybe", message: "Will try my best to make it!" },
  { name: "Abena Annan", phone: "+233244000107", group: "work", plus: 0, rsvp: "maybe" },
  { name: "Kwabena Osei", phone: "+233244000108", group: "work", plus: 1, rsvp: "no", message: "So sorry, traveling that week." },
  { name: "Yaa Frimpong", phone: "+233244000109", group: "family", plus: 0, rsvp: null },
  { name: "Nana Kweku Addo", phone: "+233244000110", group: "family", plus: 2, rsvp: null },
  { name: "Adjoa Bediako", phone: "+233244000111", group: "friends", plus: 0, rsvp: null },
  { name: "Kwesi Tetteh", phone: "+233244000112", group: "work", plus: 0, rsvp: null },
];

const DEMO_GIFTS: Array<{
  guestPhone: string;
  guestName: string;
  amountMinor: number;
  channel: "momo_mtn" | "momo_telecel" | "momo_at" | "card";
  message?: string;
  thanked?: boolean;
}> = [
  { guestPhone: "+233244000101", guestName: "Akosua Mensah", amountMinor: 50000, channel: "momo_mtn", message: "A small something — wishing you both forever joy.", thanked: true },
  { guestPhone: "+233244000102", guestName: "Yaw Boateng", amountMinor: 100000, channel: "momo_mtn", message: "Congratulations cousin!" },
  { guestPhone: "+233244000104", guestName: "Kojo Asante", amountMinor: 25000, channel: "momo_telecel" },
  { guestPhone: "+233244000105", guestName: "Adwoa Sarpong", amountMinor: 30000, channel: "momo_at", message: "From all of us at Adwoa & Co." },
  { guestPhone: "+233244000108", guestName: "Kwabena Osei", amountMinor: 75000, channel: "card", message: "Sorry to miss it — gift in lieu." },
];

const DEMO_INBOUND: Array<{
  fromPhone: string;
  body: string;
  intent: "rsvp_yes" | "rsvp_no" | "rsvp_maybe" | "dietary" | "plus_one" | "question";
  confidence: number;
  draft: string;
}> = [
  {
    fromPhone: "+233244000109",
    body: "Yes I will be there. Can I bring my husband? +1",
    intent: "plus_one",
    confidence: 0.92,
    draft: "Of course, Yaa — we'll add +1 to your RSVP. So glad you'll both be there!",
  },
  {
    fromPhone: "+233244000110",
    body: "Definitely coming! Bringing two of my kids — is that okay?",
    intent: "plus_one",
    confidence: 0.88,
    draft: "Wonderful, Nana — we've got you down for +2. We can't wait to see you and the family.",
  },
  {
    fromPhone: "+233244000111",
    body: "What's the dress code? And are kids welcome?",
    intent: "question",
    confidence: 0.85,
    draft: "Hi Adjoa — great questions! Traditional engagement is kente/African print, white wedding is cocktail formal. We've opted for a grown-ups-only celebration. The couple will follow up with anything else!",
  },
];

function buildDemoDesign(eventDate: Date): PageDesign {
  return {
    version: PAGE_DESIGN_VERSION,
    templateId: "adinkra",
    vibe: "warm",
    sections: [
      {
        type: "hero",
        id: randomToken(6),
        eyebrow: "We're getting married",
        headline: "Ama & Kwame",
        subhead: "Two families. One Saturday. Come and rejoice.",
        dateLine: eventDate.toLocaleDateString("en-GH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        locationLine: "Labadi Beach Hotel · Accra",
        imagePrompt: "Editorial portrait of a young Ghanaian couple in elegant kente attire, warm golden-hour light at Labadi beach, tasteful, photographic, not AI-generated-looking.",
        imageUrl: "https://picsum.photos/seed/ama-kwame-hero/1600/900",
      },
      {
        type: "story",
        id: randomToken(6),
        title: "How we got here",
        body:
          "We met seven years ago, sitting at the back of a Statistics lecture at UG Legon — Ama lent Kwame her calculator, Kwame never gave it back. That same calculator now lives on a shelf in our home.\n\nThree continents, two job changes and one very small puppy later, Kwame proposed on Labadi Beach last December. We said yes the moment the sun touched the water.\n\nNow we'd like to do the rest of the chapters with the people we love most in the room. That's you. Thank you for being part of this.",
        imagePrompt: "Candid documentary photograph of a Ghanaian couple walking by Labadi beach at sunset, warm tones, natural light.",
        imageUrl: "https://picsum.photos/seed/ama-kwame-story/1080/1350",
      },
      {
        type: "schedule",
        id: randomToken(6),
        title: "The two days, hour by hour",
        items: [
          { time: "09:00", title: "Traditional engagement begins", description: "Arrival of the groom's family at the bride's home for introductions.", date: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
          { time: "11:30", title: "Bride price & blessing", description: "Elders bless the union. Photos to follow.", date: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
          { time: "14:00", title: "Engagement reception", description: "Lunch, kente change, dancing.", date: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
          { time: "10:30", title: "White wedding ceremony", description: "Processional, vows, exchange of rings.", date: "" },
          { time: "13:00", title: "Cocktail hour & lunch", description: "Drinks on the lawn, then seated lunch.", date: "" },
          { time: "16:00", title: "Reception & dancing", description: "Toasts, cake, first dance, MC games into the evening.", date: "" },
        ],
      },
      {
        type: "details",
        id: randomToken(6),
        title: "When & where",
        venueName: "Labadi Beach Hotel",
        venueAddress: "1 Labadi Beach, Accra",
        dressCode: "Traditional engagement: kente or African prints. White wedding: cocktail formal.",
        notes: "Doors open one hour before each event. Parking is available on-site. The hotel has a small block of rooms reserved at our wedding rate — ask at reception.",
      },
      {
        type: "faq",
        id: randomToken(6),
        title: "Good to know",
        items: [
          { q: "What should I wear?", a: "Traditional engagement: kente or African prints. White wedding: cocktail formal. Sandals are absolutely fine — it's a beach venue." },
          { q: "Are kids welcome?", a: "We adore your children, but we'd love a grown-ups-only celebration. Thank you for understanding." },
          { q: "Can I bring a plus-one?", a: "Plus-ones are noted on your invitation. If you weren't sure, just check with us." },
          { q: "How do I send a gift?", a: "MoMo is the easiest way — MTN, Telecel, or AirtelTigo. Tap the gift button on this page; it takes about 30 seconds." },
          { q: "Is there parking?", a: "Yes, plenty of on-site parking at Labadi Beach Hotel. Look out for the kente bunting." },
          { q: "Will there be food for vegetarians?", a: "Yes — let us know on your RSVP and we'll make sure the caterer takes care of you." },
        ],
      },
      {
        type: "gifts",
        id: randomToken(6),
        title: "A gift, the Ghanaian way",
        body: "If you'd like to bless us with a gift, MoMo is the easiest way. One tap from MTN, Telecel, or AirtelTigo — and we'll thank you personally.",
        ctaLabel: "Send a MoMo gift",
      },
      {
        type: "rsvp",
        id: randomToken(6),
        title: "Will you celebrate with us?",
        body: "Your reply helps us plan the catering, seating, and that very long drinks list.",
        deadlineLine: `Kindly reply by ${new Date(eventDate.getTime() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" })}.`,
        ctaLabel: "RSVP",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export async function ensureDemoEvent(ownerUserId: string): Promise<string> {
  const existing = await db.event.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) return existing.id;

  // Event date 6 months out
  const eventDate = new Date();
  eventDate.setMonth(eventDate.getMonth() + 6);
  eventDate.setHours(10, 30, 0, 0);

  const design = buildDemoDesign(eventDate);

  const event = await db.event.create({
    data: {
      slug: DEMO_SLUG,
      title: "Ama & Kwame",
      type: "wedding",
      ownerId: ownerUserId,
      brideName: "Ama",
      groomName: "Kwame",
      eventDate,
      region: "greater_accra",
      city: "Accra",
      venueName: "Labadi Beach Hotel",
      venueAddress: "1 Labadi Beach, Accra",
      guestCount: 250,
      visibility: "unlisted",
      status: "published",
      publishedAt: new Date(),
      templateId: "adinkra",
      pageDesign: design as unknown as Prisma.InputJsonValue,
      settings: { styleBand: "premium", components: ["traditional", "white_wedding"] } as Prisma.InputJsonValue,
      members: {
        create: { userId: ownerUserId, role: "owner" },
      },
    },
  });

  // Guests + RSVPs
  for (const g of DEMO_GUESTS) {
    const guest = await db.guest.create({
      data: {
        eventId: event.id,
        displayName: g.name,
        phone: g.phone,
        groupTag: g.group,
        plusOnesAllowed: g.plus,
        invitedVia: "whatsapp",
        shortCode: generateShortCode(),
      },
    });
    if (g.rsvp) {
      await db.rsvp.create({
        data: {
          guestId: guest.id,
          eventId: event.id,
          status: g.rsvp,
          plusOnes: g.rsvp === "yes" ? g.plus : 0,
          dietary: g.dietary ?? null,
          message: g.message ?? null,
          channel: "whatsapp",
          respondedAt: new Date(),
        },
      });
    }
  }

  // Gifts: create both an intent (succeeded) and a materialized Gift row
  for (const gift of DEMO_GIFTS) {
    const feeMinor = Math.min(5000, Math.ceil(gift.amountMinor * 0.015) + 50);
    const totalMinor = gift.amountMinor + feeMinor;
    const ref = `DEMO-${randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
    const intent = await db.giftIntent.create({
      data: {
        eventId: event.id,
        guestPhone: gift.guestPhone,
        guestName: gift.guestName,
        amountMinor: gift.amountMinor,
        feeMinor,
        totalMinor,
        channel: gift.channel,
        status: "succeeded",
        gateway: "mock",
        gatewayRef: ref,
        idempotencyKey: `seed-${ref}`,
        message: gift.message ?? null,
        isPublic: true,
        settledAt: new Date(),
      },
    });
    await db.gift.create({
      data: {
        giftIntentId: intent.id,
        eventId: event.id,
        amountMinor: gift.amountMinor,
        feeMinor,
        guestName: gift.guestName,
        guestPhone: gift.guestPhone,
        channel: gift.channel,
        message: gift.message ?? null,
        isPublic: true,
        thankedAt: gift.thanked ? new Date() : null,
        thankYouMethod: gift.thanked ? "whatsapp" : null,
        thankYouDraft: gift.thanked
          ? `${gift.guestName.split(" ")[0]}, your words touched us deeply. Thank you for sharing this moment with us. We can't wait to celebrate with you.\n\nWith love,\nAma & Kwame`
          : null,
      },
    });
  }

  // Inbound messages with pending AI drafts
  for (const inb of DEMO_INBOUND) {
    const guest = await db.guest.findFirst({
      where: { eventId: event.id, phone: inb.fromPhone },
    });
    const inbound = await db.inboundMessage.create({
      data: {
        eventId: event.id,
        guestId: guest?.id ?? null,
        fromPhone: inb.fromPhone,
        channel: "whatsapp",
        body: inb.body,
        intent: inb.intent,
        intentConfidence: inb.confidence,
      },
    });
    await db.aiDraft.create({
      data: {
        inboundMessageId: inbound.id,
        draftBody: inb.draft,
        modelId: "claude-sonnet-4-6",
        status: "pending",
      },
    });
  }

  // Budget (generated by template fallback so it works without Anthropic key)
  const budgetOutput = templateBudget({
    eventType: "wedding",
    region: "greater_accra",
    city: "Accra",
    guestCount: 250,
    styleBand: "premium",
    components: ["traditional", "white_wedding"],
  });
  await db.budget.create({
    data: {
      eventId: event.id,
      totalMinor: budgetOutput.totalMinor,
      generatedByAi: false,
      sourceInputs: { region: "greater_accra", guestCount: 250 } as Prisma.InputJsonValue,
      assumptions: budgetOutput.assumptions as unknown as Prisma.InputJsonValue,
      warnings: budgetOutput.warnings as unknown as Prisma.InputJsonValue,
      items: {
        create: budgetOutput.categories.map((c, i) => ({
          category: c.category,
          label: c.label,
          plannedMinor: c.typicalMinor,
          lowMinor: c.lowMinor,
          highMinor: c.highMinor,
          notes: c.notes,
          orderIndex: i,
        })),
      },
    },
  });

  return event.id;
}

export { DEMO_SLUG };
