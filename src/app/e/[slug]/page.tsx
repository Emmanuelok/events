import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PublicEventPage } from "@/components/sections/PublicEventPage";
import { pageDesignSchema } from "@/lib/design/types";
import { defaultDesignFor } from "@/lib/design/defaults";

export default async function PublicEvent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({ where: { slug } });
  if (!event) notFound();

  const parsed = pageDesignSchema.safeParse({
    ...(event.pageDesign as object),
    templateId: (event.pageDesign as { templateId?: string }).templateId ?? event.templateId,
  });
  const design = parsed.success
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

  return <PublicEventPage design={design} slug={event.slug} />;
}
