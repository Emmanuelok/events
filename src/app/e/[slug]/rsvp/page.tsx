import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import RsvpClient from "./client";

export default async function RsvpPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await db.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      eventDate: true,
      brideName: true,
      groomName: true,
      city: true,
    },
  });
  if (!event) notFound();
  return (
    <main className="min-h-screen bg-gradient-to-b from-kente-50 to-white">
      <div className="mx-auto max-w-md px-5 py-10">
        <p className="text-center text-xs uppercase tracking-widest text-kente-700">RSVP</p>
        <h1 className="mt-2 text-center font-display text-3xl font-semibold text-ink-900">
          {event.brideName} & {event.groomName}
        </h1>
        <p className="mt-1 text-center text-sm text-ink-600">
          {event.eventDate.toLocaleDateString("en-GH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          · {event.city}
        </p>
        <RsvpClient slug={event.slug} eventId={event.id} />
      </div>
    </main>
  );
}
