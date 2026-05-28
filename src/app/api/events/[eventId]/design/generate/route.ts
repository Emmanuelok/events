import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { generateDesign, designBriefSchema } from "@/lib/ai/design-studio";
import { pageDesignSchema, type PageDesign } from "@/lib/design/types";

const inputSchema = z.object({
  brief: z.string().min(10).max(2000),
  vibe: z.enum(["warm", "elegant", "bold", "minimal"]).default("warm"),
  templateId: z.enum(["adinkra", "modern", "kente"]).default("adinkra"),
});

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const settings = (event.settings as Record<string, unknown>) ?? {};
  const components =
    ((settings.components as ("traditional" | "white_wedding")[] | undefined) ?? [
      "white_wedding",
    ]).filter((c): c is "traditional" | "white_wedding" =>
      c === "traditional" || c === "white_wedding",
    );

  const brief = designBriefSchema.parse({
    brideName: event.brideName ?? "Bride",
    groomName: event.groomName ?? "Groom",
    eventDate: event.eventDate.toISOString(),
    city: event.city,
    venueName: event.venueName ?? "",
    brief: parsed.data.brief,
    vibe: parsed.data.vibe,
    templateId: parsed.data.templateId,
    components: components.length ? components : ["white_wedding"],
  });

  const existing = pageDesignSchema.safeParse(event.pageDesign);
  const { design, source } = await generateDesign(brief, {
    eventId: event.id,
    userId: user.id,
    existing: existing.success ? (existing.data as PageDesign) : null,
  });

  await db.event.update({
    where: { id: event.id },
    data: {
      pageDesign: design as unknown as object,
      templateId: design.templateId,
      designVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ design, source });
}
