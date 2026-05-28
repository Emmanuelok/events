import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { ensureDemoEvent, DEMO_SLUG } from "@/lib/demo/seed";

export default async function LandingPage() {
  const user = await getCurrentUser();

  // In demo mode, make sure the example event exists so the "See example" link works.
  // Best-effort: if the DB is unreachable or unseeded, the landing page still renders.
  if (env().DEMO_MODE && user) {
    await ensureDemoEvent(user.id).catch(() => {});
  }
  const demoMode = env().DEMO_MODE;
  const dbHealthy = !!user || !demoMode; // in demo mode, user==null means DB is broken

  return (
    <main className="min-h-screen bg-gradient-to-b from-kente-50 to-white">
      {!dbHealthy && (
        <div className="bg-red-600 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-3 text-sm">
            <span>🛠️</span>
            <p>
              <strong>Database not reachable.</strong> Set{" "}
              <code className="rounded bg-red-800 px-1">DATABASE_URL</code> on your hosting env
              (free Postgres at <a className="underline" href="https://neon.tech" target="_blank" rel="noreferrer">neon.tech</a>) and redeploy. The build automatically applies the schema.
            </p>
          </div>
        </div>
      )}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-lg bg-gradient-to-br from-kente-500 to-kente-700" />
          <span className="font-display text-xl font-semibold text-ink-900">Celebrate</span>
        </Link>
        <nav className="flex items-center gap-2">
          {demoMode && (
            <Link
              href={`/e/${DEMO_SLUG}`}
              className="btn-ghost text-sm"
              target="_blank"
              rel="noreferrer"
            >
              View example event ↗
            </Link>
          )}
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/login" className="btn-primary">
                Start planning
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-20 pt-10 md:pt-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="chip bg-kente-100 text-kente-800">Built for Ghana 🇬🇭</span>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl md:text-6xl">
              An AI design studio for the way <span className="text-kente-700">Ghana</span> celebrates.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-700">
              Tell us one paragraph. We generate your whole wedding website — copy, schedule, FAQ,
              gift page — tuned to a Ghanaian wedding, with imagery you can generate too. Plus
              RSVP over WhatsApp, cash gifts via MoMo, and verified local vendors.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={demoMode ? "/dashboard" : "/login"}
                className="btn-primary text-base"
              >
                {demoMode ? "Open the demo dashboard" : "Start your event — it's free"}
              </Link>
              <Link
                href={demoMode ? `/e/${DEMO_SLUG}` : "#how"}
                className="btn-secondary text-base"
              >
                {demoMode ? "View example wedding page" : "See how it works"}
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-ink-600">
              <span>💍 Weddings first</span>
              <span>•</span>
              <span>📱 Mobile-first</span>
              <span>•</span>
              <span>💸 No card needed</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-kente-200 to-forest-200 opacity-50 blur-2xl" />
            <div className="relative rounded-3xl border border-ink-100 bg-white p-6 shadow-soft">
              <div className="rounded-2xl bg-gradient-to-br from-kente-500 via-kente-600 to-forest-700 p-6 text-white">
                <p className="text-xs uppercase tracking-widest opacity-80">Save the date</p>
                <p className="mt-2 font-display text-3xl">Ama & Kwame</p>
                <p className="mt-1 text-sm opacity-90">14 December 2026 • Accra</p>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">RSVPs received</span>
                  <span className="font-semibold text-ink-900">217 / 250</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">Gifts (MoMo)</span>
                  <span className="font-semibold text-ink-900">GH₵ 18,420</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-600">Vendors booked</span>
                  <span className="font-semibold text-ink-900">7 of 9</span>
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-forest-50 px-4 py-3 text-sm text-forest-900 ring-1 ring-forest-100">
                <span className="font-medium">Claude tip:</span> Send a reminder by Sunday — 33
                guests haven&apos;t replied.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          What you get from day one
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "AI Design Studio",
              body: "A paragraph in, a finished wedding website out. Claude writes your headline, story, schedule, FAQ and gift page — Ghanaian-correct, editable inline.",
              icon: "✨",
            },
            {
              title: "AI image & video (soon)",
              body: "Generate hero imagery and save-the-date videos tuned to your couple shoot and wedding aesthetic. Imagen 4 / Veo 3 ready.",
              icon: "🎨",
            },
            {
              title: "Three signature templates",
              body: "Adinkra (warm + cultural), Modern Romance (editorial elegance), Kente Bold (high-contrast magazine cover).",
              icon: "🪡",
            },
            {
              title: "WhatsApp invitations",
              body: "Send save-the-dates, invites and reminders where Ghanaians actually live: WhatsApp first, SMS fallback.",
              icon: "💬",
            },
            {
              title: "MoMo cash gifts",
              body: "Guests send from MTN, Telecel or AirtelTigo with one tap. You see who gave what, ready to thank.",
              icon: "💸",
            },
            {
              title: "AI budget estimator",
              body: "Tell us your region and guest count, get a realistic GHS line-item budget tuned to Ghana's market.",
              icon: "🧮",
            },
          ].map((f) => (
            <div key={f.title} className="card">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 font-display text-xl font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-ink-700">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <h2 className="font-display text-3xl font-semibold text-ink-900 sm:text-4xl">
          Not Joy. Not Zola. Built for here.
        </h2>
        <p className="mt-4 text-lg text-ink-700">
          Foreign tools were built for card registries, US zip codes and English-only guests. We
          were built for MoMo, WhatsApp, and ceremonies that span two days.
        </p>
        <Link href="/login" className="btn-primary mt-7 inline-flex text-base">
          Start your wedding plan
        </Link>
      </section>

      <footer className="border-t border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-ink-600 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Celebrate. Made in Accra.</p>
          <p>Currency: GHS · Timezone: Africa/Accra</p>
        </div>
      </footer>
    </main>
  );
}
