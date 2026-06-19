import Link from "next/link";
import { Bell } from "lucide-react";

type AdminHeaderProps = {
  title: string;
  description: string;
  unreadNotificationCount: number;
};

export default function AdminHeader({
  title,
  description,
  unreadNotificationCount,
}: AdminHeaderProps) {
  const showUnread = unreadNotificationCount > 0;

  return (
    <header className="max-md:space-y-2 space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2 md:gap-4">
        <div className="min-w-0 flex-1 space-y-0.5 md:space-y-1">
          <h1 className="text-xl font-bold leading-tight text-[var(--text-primary)] md:text-3xl">{title}</h1>
          <p className="text-xs leading-snug text-[var(--text-muted)] max-md:line-clamp-2 md:text-sm md:leading-normal">
            {description}
          </p>
        </div>
        <Link
          href="/theall_manager_only/notifications"
          className="relative inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-[transform,background-color] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] md:min-h-11 md:min-w-11"
          aria-label={showUnread ? `알림 ${unreadNotificationCount}건 미읽음` : "알림 센터"}
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          {showUnread ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-[var(--bg)]">
              {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
