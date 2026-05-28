import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; guestId: string }> },
) {
  const { eventId, guestId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db.guest.deleteMany({ where: { id: guestId, eventId } });
  return NextResponse.json({ ok: true });
}
