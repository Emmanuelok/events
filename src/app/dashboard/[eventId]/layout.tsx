import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessEvent } from "@/lib/event-access";
import Topbar from "@/components/Topbar";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await canAccessEvent(user.id, eventId);
  if (!ok) notFound();
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true },
  });
  if (!event) notFound();

  const tabs = [
    { href: `/dashboard/${event.id}`, label: "Overview" },
    { href: `/dashboard/${event.id}/design`, label: "Design Studio ✨" },
    { href: `/dashboard/${event.id}/guests`, label: "Guests" },
    { href: `/dashboard/${event.id}/budget`, label: "Budget" },
  ];

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar userName={user.displayName ?? user.phone} eventTitle={event.title} eventSlug={event.slug} />
      <nav className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="border-b-2 border-transparent px-4 py-3 text-sm font-medium text-ink-700 hover:text-kente-700 hover:border-kente-300"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
