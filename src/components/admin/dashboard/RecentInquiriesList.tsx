"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Inquiry, ConsultationStatus } from "@/types/inquiry";
import { formatRelativeTimeKo } from "./formatRelativeTimeKo";

type RecentInquiriesListProps = {
  items: Inquiry[];
  isLoading?: boolean;
  isError?: boolean;
};

function statusMeta(inquiry: Inquiry): { label: string; tone: "new" | "progress" | "done" | "hold" } {
  if (inquiry.booking_status === "completed") return { label: "여행완료", tone: "done" };
  if (inquiry.booking_status === "reserved") return { label: "예약확정", tone: "progress" };
  if (inquiry.consultation_status === "on_hold") return { label: "보류", tone: "hold" };
  if (inquiry.consultation_status === "closed") return { label: "상담종료", tone: "done" };
  if (inquiry.consultation_status === "contacted") return { label: "연락완료", tone: "progress" };
  if (inquiry.consultation_status === "new") return { label: "NEW", tone: "new" };
  if (inquiry.is_completed === true) return { label: "완료", tone: "done" };
  return { label: "진행중", tone: "progress" };
}

const BADGE_BY_TONE = {
  new: "bg-[var(--warning-bg)] text-[var(--warning)] ring-2 ring-[var(--warning)]/30",
  progress: "bg-[var(--surface-muted)] text-[var(--text-secondary)] ring-2 ring-[var(--border)]",
  done: "bg-[var(--success-bg)] text-[var(--success)] ring-2 ring-[var(--success)]/25",
  hold: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/90 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-600/50",
} as const;

async function patchConsultationStatus(id: string, consultation_status: ConsultationStatus) {
  const response = await fetch(`/api/inquiries/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update_status", consultation_status }),
  });
  return response.ok;
}

export default function RecentInquiriesList({ items, isLoading, isError }: RecentInquiriesListProps) {
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const runStatus = async (inquiryId: string, next: ConsultationStatus) => {
    setActingId(inquiryId);
    try {
      const ok = await patchConsultationStatus(inquiryId, next);
      if (ok) {
        await queryClient.invalidateQueries({ queryKey: ["admin-dashboard-recent-inquiries"] });
        await queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      }
    } finally {
      setActingId(null);
    }
  };

  if (isLoading) {
    return (
      <ul className="flex flex-col gap-4">
        {[0, 1, 2].map((k) => (
          <li key={k} className="animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 shadow-sm">
            <div className="h-4 w-2/5 rounded bg-[var(--border)]" />
            <div className="mt-2 h-3 w-full rounded bg-[var(--border)]" />
            <div className="mt-2 h-3 w-1/4 rounded bg-[var(--border)]" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return <p className="text-xs text-[var(--danger)]">최근 문의를 불러오지 못했습니다.</p>;
  }

  if (items.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">최근 문의가 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((inquiry) => {
        const { label, tone } = statusMeta(inquiry);
        const badgeClass = BADGE_BY_TONE[tone];
        const consultation = (inquiry.consultation_status ?? "new") as ConsultationStatus;
        const detailHref = `/admin/inquiries?id=${encodeURIComponent(inquiry.id)}`;
        const busy = actingId === inquiry.id;
        const showContacted = consultation === "new";
        const showCloseConsultation = consultation === "new" || consultation === "contacted";
        const showHold = consultation === "contacted";
        const showResume = consultation === "on_hold";
        const showActionRow = showContacted || showCloseConsultation || showHold || showResume;

        return (
          <li key={inquiry.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-shadow hover:shadow-md">
            <Link
              href={detailHref}
              className="block p-3.5 pb-2 transition-colors hover:bg-[var(--surface-muted)]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold leading-tight text-[var(--text-primary)]">
                  {inquiry.name || "이름 없음"}
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                >
                  {label}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-snug text-[var(--text-secondary)]">
                {(inquiry.content ?? "").trim() || "내용 없음"}
              </p>
              <p className="mt-2 text-[11px] tabular-nums text-[var(--text-muted)]">
                {formatRelativeTimeKo(inquiry.created_at)}
              </p>
            </Link>
            {showActionRow ? (
              <div className="flex flex-wrap gap-2 border-t border-[var(--border)]/70 bg-[var(--surface-muted)]/35 px-3.5 py-2">
                {showContacted ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      void runStatus(inquiry.id, "contacted");
                    }}
                    className="min-h-9 rounded-md border border-amber-400/50 bg-amber-50 px-3 text-xs font-bold text-amber-900 transition active:scale-[0.98] disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    상담중
                  </button>
                ) : null}
                {showCloseConsultation ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      void runStatus(inquiry.id, "closed");
                    }}
                    className="min-h-9 rounded-md border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 text-xs font-bold text-[var(--success)] transition active:scale-[0.98] disabled:opacity-50"
                  >
                    상담종료
                  </button>
                ) : null}
                {showHold ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      void runStatus(inquiry.id, "on_hold");
                    }}
                    className="min-h-9 rounded-md border border-slate-300/80 bg-slate-50 px-3 text-xs font-bold text-slate-800 transition active:scale-[0.98] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200"
                  >
                    보류
                  </button>
                ) : null}
                {showResume ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      void runStatus(inquiry.id, "contacted");
                    }}
                    className="min-h-9 rounded-md border border-amber-400/50 bg-amber-50 px-3 text-xs font-bold text-amber-900 transition active:scale-[0.98] disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    재개
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
