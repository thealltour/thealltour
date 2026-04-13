"use client";

import Link from "next/link";
import { CalendarPlus, Flame, Inbox, UserX, AlertCircle, CalendarCheck } from "lucide-react";
import type { InquiryDashboardKpis as Kpis } from "./inquiryDashboard.types";
import { buildInquiriesListUrl, kstStartOfTodayIso } from "./inquiryDashboard.utils";

type Props = { kpis: Kpis };

const CARD =
  "flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)]";

export function InquiryDashboardKpis({ kpis }: Props) {
  const items: {
    title: string;
    value: number;
    href: string;
    Icon: typeof Inbox;
  }[] = [
    {
      title: "오늘 신규",
      value: kpis.todayNewCount,
      href: buildInquiriesListUrl({ createdAfter: kstStartOfTodayIso() }),
      Icon: CalendarPlus,
    },
    {
      title: "진행중",
      value: kpis.inProgressCount,
      href: buildInquiriesListUrl({ status: "in_progress" }),
      Icon: Inbox,
    },
    {
      title: "예약확정",
      value: kpis.reservedCount,
      href: buildInquiriesListUrl({ status: "reserved" }),
      Icon: CalendarCheck,
    },
    {
      title: "HOT 리드",
      value: kpis.hotLeadCount,
      href: buildInquiriesListUrl({ priority: "high" }),
      Icon: Flame,
    },
    {
      title: "팔로업 지연",
      value: kpis.followUpOverdueCount,
      href: buildInquiriesListUrl({ quickFilter: "overdue" }),
      Icon: AlertCircle,
    },
    {
      title: "미배정",
      value: kpis.unassignedCount,
      href: buildInquiriesListUrl({ assigneeFilter: "unassigned" }),
      Icon: UserX,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map(({ title, value, href, Icon }) => (
        <Link key={title} href={href} className={CARD}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">{title}</span>
            <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} aria-hidden />
          </div>
          <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{value.toLocaleString()}</p>
        </Link>
      ))}
    </div>
  );
}
