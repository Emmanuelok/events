import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export default async function ShortLinkRedirect({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  const guest = await db.guest.findUnique({
    where: { shortCode },
    include: { event: { select: { slug: true } } },
  });
  if (!guest) notFound();
  redirect(`/e/${guest.event.slug}/rsvp`);
}
