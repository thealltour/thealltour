"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminNotificationItem } from "@/lib/adminNotifications";
import { formatRelativeTimeKo } from "./formatRelativeTimeKo";

type RecentNotificationsListProps = {
  items: AdminNotificationItem[];
  isLoading?: boolean;
  isError?: boolean;
};

function rawTypeKey(type: string) {
  const t = type?.trim();
  return t || "notification";
}

/** 레거시 알림 target을 /admin 경로로 정규화 */
function normalizeTargetUrl(url: string | null): string {
  const fallback = "/admin/notifications";
  const u = url?.trim();
  if (!u) return fallback;
  if (u.startsWith("/theall_manager_only/inquiries")) {
    return u.replace("/theall_manager_only/inquiries", "/admin/inquiries");
  }
  if (u.startsWith("/theall_manager_only/notifications")) {
    return u.replace("/theall_manager_only/notifications", "/admin/notifications");
  }
  if (u.startsWith("/theall_manager_only/reviews")) {
    return u.replace("/theall_manager_only/reviews", "/admin/reviews");
  }
  return u;
}

function isHighPriorityType(type: string) {
  return type === "new_inquiry" || type === "new_review";
}

export default function RecentNotificationsList({ items, isLoading, isError }: RecentNotificationsListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const openNotification = async (n: AdminNotificationItem) => {
    const href = normalizeTargetUrl(n.target_url);
    if (!n.is_read) {
      try {
        await fetch(`/api/admin/notifications/${n.id}/read`, { method: "PATCH" });
        await queryClient.invalidateQueries({ queryKey: ["admin-dashboard-recent-notifications"] });
        await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        router.refresh();
      } catch {
        // 읽음 처리 실패해도 이동은 진행
      }
    }
    router.push(href);
  };

  if (isLoading) {
    return (
      <ul className="flex flex-col gap-4">
        {[0, 1, 2].map((k) => (
          <li key={k} className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 shadow-sm">
            <div className="h-3.5 w-24 rounded bg-[var(--border)]" />
            <div className="mt-2 h-4 w-3/5 rounded bg-[var(--border)]" />
            <div className="mt-2 h-3 w-full rounded bg-[var(--border)]" />
            <div className="mt-2 h-3 w-1/4 rounded bg-[var(--border)]" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return <p className="text-xs text-[var(--danger)]">최근 알림을 불러오지 못했습니다.</p>;
  }

  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">최근 알림이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((n) => {
        const unread = !n.is_read;
        const typeKey = rawTypeKey(n.type || "");
        const high = isHighPriorityType(n.type || "");
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => void openNotification(n)}
              className={`relative w-full min-h-[4.75rem] overflow-hidden rounded-lg border p-3.5 pl-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color,background-color] hover:border-[var(--brand)]/40 hover:bg-[var(--surface-muted)] hover:shadow-md active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                high
                  ? "border-[var(--danger)]/35 bg-[var(--danger-bg)]/25"
                  : unread
                    ? "border-[var(--brand)]/45 bg-[var(--brand)]/[0.07] ring-1 ring-inset ring-[var(--brand)]/15"
                    : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {unread ? <span className="absolute left-0 top-0 h-full w-1 bg-[var(--brand)]" aria-hidden /> : null}
              <div className={unread ? "pl-0.5" : undefined}>
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <span className="inline-block max-w-full truncate rounded-md bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
                    {typeKey}
                  </span>
                  {unread ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
                      미읽음
                    </span>
                  ) : null}
                  {high ? (
                    <span className="rounded-md bg-[var(--danger)]/15 px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger)]">
                      긴급
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-sm font-extrabold leading-tight text-[var(--text-primary)]">{n.title}</p>
                <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-[var(--text-secondary)]">
                  {(n.message ?? "").trim() || "—"}
                </p>
                <p className="mt-2 text-[11px] tabular-nums text-[var(--text-muted)]">
                  {formatRelativeTimeKo(n.created_at)}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
