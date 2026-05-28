import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-gradient-to-b from-kente-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded-lg bg-gradient-to-br from-kente-500 to-kente-700" />
          <span className="font-display text-xl font-semibold text-ink-900">Celebrate</span>
        </Link>
        <nav className="flex items-center gap-2">
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
              Plan your wedding the way <span className="text-kente-700">Ghana</span> actually celebrates.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-700">
              Beautiful event websites. RSVP over WhatsApp. Cash gifts via MoMo. Verified local
              vendors. And an AI that knows the difference between a traditional engagement and a
              white wedding.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="btn-primary text-base">
                Start your event — it&apos;s free
              </Link>
              <Link href="#how" className="btn-secondary text-base">
                See how it works
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
              title: "Your event website",
              body: "A mobile-first page for your wedding — story, schedule, venue, RSVP, gifts — at celebrate.gh/your-name.",
              icon: "🏛️",
            },
            {
              title: "WhatsApp invitations",
              body: "Send save-the-dates, invites and reminders where Ghanaians actually live: WhatsApp first, SMS fallback.",
              icon: "💬",
            },
            {
              title: "MoMo cash gifts",
              body: "Guests send cash from MTN, Telecel or AirtelTigo with one tap. You see who gave what, ready to thank.",
              icon: "💸",
            },
            {
              title: "Verified local vendors",
              body: "Caterers, decorators, photographers, MCs — hand-vetted by us, matched to your budget by AI.",
              icon: "✅",
            },
            {
              title: "AI budget estimator",
              body: "Tell us your region and guest count, get a realistic GHS line-item budget tuned to Ghana's market.",
              icon: "🧮",
            },
            {
              title: "One organizer dashboard",
              body: "Guests, RSVPs, gifts, vendors and your checklist — together, on your phone, even on patchy data.",
              icon: "📋",
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
