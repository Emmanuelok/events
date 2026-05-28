// Read / overwrite the entire PageDesign. Used for manual saves from the studio.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { pageDesignSchema } from "@/lib/design/types";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { pageDesign: true, templateId: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ design: event.pageDesign, templateId: event.templateId });
}

export async function PUT(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = pageDesignSchema.safeParse(body?.design);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid design payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const design = parsed.data;
  await db.event.update({
    where: { id: eventId },
    data: {
      pageDesign: design as unknown as object,
      templateId: design.templateId,
      designVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true });
}
