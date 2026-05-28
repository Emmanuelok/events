import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import BudgetClient from "./client";

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { budget: { include: { items: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!event) notFound();

  return (
    <BudgetClient
      eventId={event.id}
      eventTitle={event.title}
      initialBudget={
        event.budget
          ? {
              totalMinor: event.budget.totalMinor,
              generatedByAi: event.budget.generatedByAi,
              assumptions: (event.budget.assumptions as string[]) ?? [],
              warnings: (event.budget.warnings as string[]) ?? [],
              items: event.budget.items.map((i) => ({
                category: i.category,
                label: i.label,
                plannedMinor: i.plannedMinor,
                lowMinor: i.lowMinor,
                highMinor: i.highMinor,
                notes: i.notes,
              })),
            }
          : null
      }
    />
  );
}
