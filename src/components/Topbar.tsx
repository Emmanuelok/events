import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function Topbar({
  userName,
  eventTitle,
  eventSlug,
}: {
  userName: string | null;
  eventTitle?: string;
  eventSlug?: string;
}) {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-kente-500 to-kente-700" />
            <span className="font-display text-lg font-semibold text-ink-900">Celebrate</span>
          </Link>
          {eventTitle && (
            <span className="ml-2 hidden truncate text-sm text-ink-600 sm:block">
              · {eventTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {eventSlug && (
            <Link
              href={`/e/${eventSlug}`}
              target="_blank"
              className="btn-ghost text-sm"
              prefetch={false}
            >
              View public page ↗
            </Link>
          )}
          {userName && <span className="hidden text-sm text-ink-600 sm:inline">{userName}</span>}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
