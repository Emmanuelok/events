import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Topbar from "@/components/Topbar";
import { env } from "@/lib/env";
import { ensureDemoEvent } from "@/lib/demo/seed";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" });
}

export default async function DashboardIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Demo mode: auto-seed a rich example event so reviewers see everything
  // working immediately. Idempotent — re-running returns the same event.
  if (env().DEMO_MODE) {
    const demoEventId = await ensureDemoEvent(user.id);
    redirect(`/dashboard/${demoEventId}`);
  }

  const memberships = await db.eventMember.findMany({
    where: { userId: user.id },
    include: {
      event: {
        include: {
          _count: { select: { guests: true, rsvps: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar userName={user.displayName ?? user.phone} />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold text-ink-900">Your events</h1>
          <Link href="/onboarding" className="btn-primary">
            New event
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => (
            <li key={m.id}>
              <Link href={`/dashboard/${m.event.id}`} className="block">
                <div className="card transition hover:shadow-md">
                  <div className="rounded-xl bg-gradient-to-br from-kente-500 via-kente-600 to-forest-700 p-5 text-white">
                    <p className="text-xs uppercase tracking-widest opacity-80">Wedding</p>
                    <p className="mt-1 font-display text-2xl">{m.event.title}</p>
                    <p className="mt-1 text-sm opacity-90">
                      {formatDate(m.event.eventDate)} · {m.event.city}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-ink-600">Guests</p>
                      <p className="font-semibold text-ink-900">{m.event._count.guests}</p>
                    </div>
                    <div>
                      <p className="text-ink-600">RSVPs</p>
                      <p className="font-semibold text-ink-900">{m.event._count.rsvps}</p>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
