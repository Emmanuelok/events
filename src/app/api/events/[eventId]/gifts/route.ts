// GET /api/events/[eventId]/gifts — organizer view: settled gifts + totals.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [gifts, sum, intentCounts] = await Promise.all([
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
    db.giftIntent.groupBy({
      by: ["status"],
      where: { eventId },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    gifts,
    totals: {
      count: sum._count,
      amountMinor: sum._sum.amountMinor ?? 0,
      feeMinor: sum._sum.feeMinor ?? 0,
    },
    intentCounts,
  });
}
