import Link from "next/link";

// Force dynamic rendering so static prerender never touches modules that
// expect runtime env (DB, session secret, etc).
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-kente-50 to-white px-5">
      <div className="text-center">
        <p className="font-display text-6xl font-semibold text-kente-700">404</p>
        <p className="mt-2 text-ink-700">
          That page doesn&apos;t exist — but a wedding might.
        </p>
        <Link href="/" className="btn-primary mt-6 inline-flex text-sm">
          Back to Celebrate
        </Link>
      </div>
    </main>
  );
}
