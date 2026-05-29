import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessEvent } from "@/lib/event-access";
import Topbar from "@/components/Topbar";
import ConciergePanel from "@/components/Concierge/ConciergePanel";
import { getOrCreateConversation, loadHistory } from "@/lib/concierge/memory";
import { computeInsights } from "@/lib/concierge/insights";
import { env } from "@/lib/env";

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
    select: {
      id: true,
      title: true,
      slug: true,
      brideName: true,
      groomName: true,
      eventDate: true,
    },
  });
  if (!event) notFound();

  // Concierge: load conversation history once for the layout. Best-effort.
  let initialMessages: Array<{ id: string; role: "user" | "assistant" | "tool"; content: string }> =
    [];
  let initialGreeting: string | undefined;
  try {
    const conv = await getOrCreateConversation(eventId, user.id);
    const full = await loadHistory(conv.id);
    initialMessages = full.messages.map((m) => {
      const role: "user" | "assistant" | "tool" =
        m.role === "tool_result" ? "tool" : (m.role as "user" | "assistant");
      let content = m.content;
      if (m.role === "tool_result") {
        const r = m.toolResult as { humanSummary?: string; ok?: boolean; error?: string } | null;
        content = r?.ok === false ? `❌ ${r.error ?? "failed"}` : `✓ ${r?.humanSummary ?? "done"}`;
      }
      return { id: m.id, role, content };
    });

    // In demo mode, when the conversation is empty, show a personalized greeting
    if (env().DEMO_MODE && initialMessages.length === 0) {
      const insights = await computeInsights(eventId);
      const top = insights[0];
      const daysUntil = Math.ceil(
        (event.eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      const couple =
        event.brideName && event.groomName
          ? `${event.brideName} & ${event.groomName}'s wedding`
          : event.title;
      const intro = `Welcome — ${couple} is in ${daysUntil} days.`;
      const nudge = top
        ? ` ${top.title}. Want me to help with that?`
        : " Everything looks great. Want a quick rundown?";
      initialGreeting = intro + nudge;
    }
  } catch {
    // DB might be unreachable; the layout still renders, the panel just has no history
  }

  const tabs = [
    { href: `/dashboard/${event.id}`, label: "Overview" },
    { href: `/dashboard/${event.id}/design`, label: "Design Studio ✨" },
    { href: `/dashboard/${event.id}/guests`, label: "Guests" },
    { href: `/dashboard/${event.id}/inbox`, label: "AI Inbox ✨" },
    { href: `/dashboard/${event.id}/gifts`, label: "Gifts" },
    { href: `/dashboard/${event.id}/budget`, label: "Budget" },
  ];

  return (
    <div className="min-h-screen bg-ink-50">
      <Topbar
        userName={user.displayName ?? user.phone}
        eventTitle={event.title}
        eventSlug={event.slug}
      />
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
      <ConciergePanel
        eventId={event.id}
        eventTitle={event.title}
        initialMessages={initialMessages}
        initialMessage={initialGreeting}
      />
    </div>
  );
}
