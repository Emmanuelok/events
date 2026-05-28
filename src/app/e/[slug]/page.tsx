import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { regionLabel } from "@/lib/regions";

function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-GH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function countdown(d: Date) {
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return { days };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({ where: { slug } });
  if (!event) notFound();

  const cd = countdown(event.eventDate);

  return (
    <main className="min-h-screen bg-ink-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-kente-500 via-kente-600 to-forest-700 text-white">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#fff_0,transparent_40%),radial-gradient(circle_at_80%_80%,#fff_0,transparent_40%)]" />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">We&apos;re getting married</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-tight sm:text-7xl">
            {event.brideName}
            <span className="mx-3 opacity-70">&</span>
            {event.groomName}
          </h1>
          <p className="mt-5 text-lg opacity-95">{formatLongDate(event.eventDate)}</p>
          <p className="mt-1 text-sm opacity-85">
            {event.city}
            {event.venueName ? ` · ${event.venueName}` : ""}
          </p>
          {cd && (
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 backdrop-blur">
              <span className="font-display text-2xl font-semibold">{cd.days}</span>
              <span className="text-sm opacity-90">days to go</span>
            </div>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/e/${slug}/rsvp`} className="btn-secondary bg-white text-ink-900">
              RSVP
            </Link>
            <a
              href={`/e/${slug}#gifts`}
              className="rounded-full bg-white/15 px-5 py-3 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
            >
              Send a gift via MoMo
            </a>
          </div>
        </div>
      </section>

      {/* Our story */}
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="font-display text-3xl font-semibold text-ink-900">Our story</h2>
        <p className="mt-4 text-lg leading-relaxed text-ink-700">
          {event.story ??
            `We can't wait to celebrate with you. Save the date and join us in ${event.city} for ${event.brideName} & ${event.groomName}'s wedding.`}
        </p>
      </section>

      {/* Details */}
      <section className="mx-auto max-w-3xl px-5 pb-16">
        <h2 className="font-display text-3xl font-semibold text-ink-900">When & where</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="card">
            <p className="text-sm text-ink-600">Date</p>
            <p className="mt-1 font-display text-xl text-ink-900">{formatLongDate(event.eventDate)}</p>
            {event.eventTime && <p className="text-ink-700">{event.eventTime}</p>}
          </div>
          <div className="card">
            <p className="text-sm text-ink-600">Location</p>
            <p className="mt-1 font-display text-xl text-ink-900">
              {event.venueName ?? event.city}
            </p>
            <p className="text-ink-700">
              {event.city}, {regionLabel(event.region)}
            </p>
            {event.venueAddress && <p className="text-sm text-ink-600">{event.venueAddress}</p>}
          </div>
        </div>
      </section>

      {/* RSVP / gifts CTA */}
      <section id="gifts" className="mx-auto max-w-3xl px-5 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-forest-700 to-forest-900 p-8 text-white">
          <h2 className="font-display text-3xl font-semibold">A gift, the Ghanaian way</h2>
          <p className="mt-3 text-lg opacity-95">
            We&apos;re honoured if you&apos;d like to bless us with a MoMo cash gift. Coming soon
            — you&apos;ll be able to send from MTN, Telecel, or AirtelTigo right here.
          </p>
          <Link
            href={`/e/${slug}/rsvp`}
            className="btn-secondary mt-6 inline-flex bg-white text-ink-900"
          >
            For now, just RSVP →
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-5 py-6 text-sm text-ink-600">
          <p>
            Made with love on{" "}
            <Link href="/" className="font-medium text-kente-700">
              Celebrate
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
