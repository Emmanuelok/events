import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { generateBudget, budgetInputSchema } from "@/lib/ai/budget";

const overrideSchema = budgetInputSchema.partial();

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ overrides: overrideSchema.optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const settings = (event.settings as Record<string, unknown>) ?? {};
  const styleBand = (settings.styleBand as "budget" | "mid" | "premium" | "luxury" | undefined) ?? "mid";
  const components = (settings.components as ("traditional" | "white_wedding")[] | undefined) ?? [
    "white_wedding",
  ];

  const inputCandidate = {
    eventType: "wedding" as const,
    region: event.region as string,
    city: event.city,
    guestCount: event.guestCount,
    styleBand,
    components,
    ...parsed.data.overrides,
  };
  const validated = budgetInputSchema.parse(inputCandidate);

  const { output, source } = await generateBudget(validated, {
    eventId: event.id,
    userId: user.id,
  });

  const budget = await db.budget.upsert({
    where: { eventId: event.id },
    update: {
      totalMinor: output.totalMinor,
      generatedByAi: source === "ai",
      sourceInputs: validated,
      assumptions: output.assumptions,
      warnings: output.warnings,
      items: {
        deleteMany: {},
        create: output.categories.map((c, i) => ({
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
    create: {
      eventId: event.id,
      totalMinor: output.totalMinor,
      generatedByAi: source === "ai",
      sourceInputs: validated,
      assumptions: output.assumptions,
      warnings: output.warnings,
      items: {
        create: output.categories.map((c, i) => ({
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
    include: { items: { orderBy: { orderIndex: "asc" } } },
  });

  return NextResponse.json({ budget, source });
}
