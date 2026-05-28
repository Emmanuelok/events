// GET /api/gifts/[reference]/status — polled by the callback page after the gateway redirects back.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const intent = await db.giftIntent.findUnique({
    where: { gatewayRef: reference },
    select: {
      gatewayRef: true,
      status: true,
      amountMinor: true,
      feeMinor: true,
      totalMinor: true,
      guestName: true,
      channel: true,
      settledAt: true,
      failureReason: true,
    },
  });
  if (!intent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ intent });
}
