import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import GiftsClient from "./client";

export default async function GiftsPage({
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

  const [gifts, sum] = await Promise.all([
    db.gift.findMany({
      where: { eventId },
      orderBy: { settledAt: "desc" },
      take: 200,
    }),
    db.gift.aggregate({
      where: { eventId },
      _sum: { amountMinor: true, feeMinor: true },
      _count: true,
    }),
  ]);

  return (
    <GiftsClient
      eventId={event.id}
      slug={event.slug}
      initialGifts={gifts.map((g) => ({
        id: g.id,
        guestName: g.guestName,
        guestPhone: g.guestPhone,
        amountMinor: g.amountMinor,
        feeMinor: g.feeMinor,
        channel: g.channel,
        message: g.message,
        isPublic: g.isPublic,
        thankedAt: g.thankedAt?.toISOString() ?? null,
        thankYouDraft: g.thankYouDraft,
        settledAt: g.settledAt.toISOString(),
      }))}
      totals={{
        count: sum._count,
        amountMinor: sum._sum.amountMinor ?? 0,
        feeMinor: sum._sum.feeMinor ?? 0,
      }}
    />
  );
}
