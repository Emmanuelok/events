import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { regenerateSection, designBriefSchema } from "@/lib/ai/design-studio";
import { pageDesignSchema, SECTION_TYPES, type PageDesign } from "@/lib/design/types";

const inputSchema = z.object({
  sectionType: z.enum(SECTION_TYPES),
  prompt: z.string().min(5).max(800),
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

  const existing = pageDesignSchema.safeParse(event.pageDesign);
  if (!existing.success) {
    return NextResponse.json(
      { error: "No design yet — generate the full page first." },
      { status: 400 },
    );
  }
  const design: PageDesign = existing.data;

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
    brief: parsed.data.prompt,
    vibe: design.vibe,
    templateId: design.templateId as "adinkra" | "modern" | "kente",
    components: components.length ? components : ["white_wedding"],
  });

  const { section, source } = await regenerateSection(
    design,
    parsed.data.sectionType,
    parsed.data.prompt,
    brief,
    { eventId: event.id, userId: user.id },
  );

  // Replace the section in design.sections (matched by type — single instance per type for now)
  const nextSections = design.sections.map((s) => (s.type === section.type ? section : s));
  const nextDesign: PageDesign = {
    ...design,
    sections: nextSections,
    updatedAt: new Date().toISOString(),
  };

  await db.event.update({
    where: { id: event.id },
    data: {
      pageDesign: nextDesign as unknown as object,
      designVersion: { increment: 1 },
    },
  });

  return NextResponse.json({ section, source });
}
