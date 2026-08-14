"use client";

import Link from "next/link";

type AdminDashboardAlertStripProps = {
  pendingInquiries: number;
  delayedInquiries: number;
  unreadNotificationCount: number;
  reservedInquiries?: number;
  /** 신고·플래그 또는 고우선 검토 건수(0이면 미표시) */
  reviewRiskCount?: number;
  isLoading?: boolean;
};

type BadgeConfig = {
  key: string;
  href: string;
  label: string;
  count: number;
  variant: "delayed" | "review" | "pending" | "reserved" | "unread";
};

const BADGE_STYLES: Record<BadgeConfig["variant"], { wrap: string; count: string; label: string }> = {
  delayed: {
    wrap: "border-[var(--danger)]/40 bg-[var(--danger-bg)]/70",
    count: "text-[var(--danger)]",
    label: "text-[var(--text-muted)]",
  },
  review: {
    wrap: "border-[var(--danger)]/35 bg-[var(--danger-bg)]/50",
    count: "text-[var(--danger)]",
    label: "text-[var(--text-muted)]",
  },
  pending: {
    wrap: "border-[var(--warning)]/45 bg-[var(--warning-bg)]/60",
    count: "text-[var(--warning)]",
    label: "text-[var(--text-muted)]",
  },
  reserved: {
    wrap: "border-[var(--border)] bg-[var(--surface-muted)]",
    count: "text-[var(--text-secondary)]",
    label: "text-[var(--text-muted)]",
  },
  unread: {
    wrap: "border-[var(--brand)]/35 bg-[var(--surface-muted)]",
    count: "text-[var(--brand)]",
    label: "text-[var(--text-muted)]",
  },
};

export default function AdminDashboardAlertStrip({
  pendingInquiries,
  delayedInquiries,
  unreadNotificationCount,
  reservedInquiries = 0,
  reviewRiskCount = 0,
  isLoading,
}: AdminDashboardAlertStripProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 animate-pulse sm:px-2.5">
        <div className="h-7 max-w-md rounded-md bg-[var(--border)]" />
      </div>
    );
  }

  const hasReviewRisk = reviewRiskCount > 0;
  const hasUrgent = delayedInquiries > 0 || pendingInquiries > 0 || hasReviewRisk;
  const hasUnread = unreadNotificationCount > 0;
  const hasReserved = reservedInquiries > 0;
  const allQuiet = !hasUrgent && !hasUnread && !hasReserved;

  if (allQuiet) {
    return null;
  }

  const badges: BadgeConfig[] = [];

  if (delayedInquiries > 0) {
    badges.push({
      key: "delayed",
      href: "/theall_manager_only/inquiries?status=delayed",
      label: "지연",
      count: delayedInquiries,
      variant: "delayed",
    });
  }
  if (hasReviewRisk) {
    badges.push({
      key: "review",
      href: "/theall_manager_only/reviews/moderation?filter=flagged",
      label: "리뷰 위험",
      count: reviewRiskCount,
      variant: "review",
    });
  }
  if (pendingInquiries > 0) {
    badges.push({
      key: "pending",
      href: "/theall_manager_only/inquiries?status=pending",
      label: "미처리",
      count: pendingInquiries,
      variant: "pending",
    });
  }
  if (hasUnread) {
    badges.push({
      key: "unread",
      href: "/theall_manager_only/notifications?filter=unread",
      label: "알림",
      count: unreadNotificationCount,
      variant: "unread",
    });
  }
  if (hasReserved) {
    badges.push({
      key: "reserved",
      href: "/theall_manager_only/inquiries?status=reserved",
      label: "예약",
      count: reservedInquiries,
      variant: "reserved",
    });
  }

  const stripTone =
    delayedInquiries > 0 || hasReviewRisk
      ? "border-[var(--danger)]/30 bg-[var(--danger-bg)]/25"
      : pendingInquiries > 0
        ? "border-[var(--warning)]/30 bg-[var(--warning-bg)]/25"
        : "border-[var(--border)] bg-[var(--surface-muted)]";

  return (
    <div
      className={`rounded-lg border px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2 ${stripTone}`}
      role="status"
      aria-label="즉시 확인할 운영 항목"
    >
      <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
        즉시 확인
      </p>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {badges.map((b) => {
          const st = BADGE_STYLES[b.variant];
          return (
            <Link
              key={b.key}
              href={b.href}
              className={`inline-flex min-h-9 min-w-0 max-w-full shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 transition-[transform,box-shadow] hover:shadow-sm active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg)] sm:min-h-9 sm:px-2.5 sm:py-1.5 ${st.wrap}`}
            >
              <span className={`text-base font-bold tabular-nums leading-none sm:text-lg ${st.count}`}>{b.count}</span>
              <span className={`max-w-[5.5rem] truncate text-[10px] font-medium sm:max-w-none sm:text-[11px] ${st.label}`}>
                {b.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
