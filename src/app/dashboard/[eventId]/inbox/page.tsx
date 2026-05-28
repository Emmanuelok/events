import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import InboxClient from "./client";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, slug: true },
  });
  if (!event) notFound();

  const messages = await db.inboundMessage.findMany({
    where: { eventId },
    include: {
      guest: { select: { displayName: true, phone: true } },
      draft: true,
    },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  return (
    <InboxClient
      eventId={event.id}
      slug={event.slug}
      initialMessages={messages.map((m) => ({
        id: m.id,
        fromPhone: m.fromPhone,
        body: m.body,
        receivedAt: m.receivedAt.toISOString(),
        channel: m.channel,
        intent: m.intent,
        intentConfidence: m.intentConfidence,
        handledAt: m.handledAt?.toISOString() ?? null,
        guestName: m.guest?.displayName ?? null,
        guestPhone: m.guest?.phone ?? null,
        draft: m.draft
          ? {
              id: m.draft.id,
              body: m.draft.draftBody,
              status: m.draft.status,
              modelId: m.draft.modelId,
            }
          : null,
      }))}
    />
  );
}
