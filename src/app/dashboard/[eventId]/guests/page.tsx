import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import GuestsClient from "./client";

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });
  if (!event) notFound();
  const guests = await db.guest.findMany({
    where: { eventId },
    include: { rsvp: true },
    orderBy: { createdAt: "desc" },
  });
  return <GuestsClient eventId={event.id} initialGuests={guests.map((g) => ({
    id: g.id,
    displayName: g.displayName,
    phone: g.phone,
    groupTag: g.groupTag,
    plusOnesAllowed: g.plusOnesAllowed,
    invitedVia: g.invitedVia,
    shortCode: g.shortCode,
    rsvpStatus: g.rsvp?.status ?? "pending",
  }))} />;
}
