import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { pageDesignSchema, type PageDesign } from "@/lib/design/types";
import { defaultDesignFor } from "@/lib/design/defaults";
import { TEMPLATE_LIST } from "@/lib/design/templates";
import DesignStudio from "./client";

export default async function DesignStudioPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const parsed = pageDesignSchema.safeParse(event.pageDesign);
  const design: PageDesign = parsed.success
    ? parsed.data
    : defaultDesignFor({
        brideName: event.brideName,
        groomName: event.groomName,
        title: event.title,
        eventDate: event.eventDate,
        city: event.city,
        venueName: event.venueName,
        templateId: event.templateId,
      });

  return (
    <DesignStudio
      eventId={event.id}
      slug={event.slug}
      initialDesign={design}
      templates={TEMPLATE_LIST.map((t) => ({
        id: t.id,
        name: t.name,
        tagline: t.tagline,
        description: t.description,
        accent: t.palette.accent,
        accentSoft: t.palette.accentSoft,
      }))}
    />
  );
}
