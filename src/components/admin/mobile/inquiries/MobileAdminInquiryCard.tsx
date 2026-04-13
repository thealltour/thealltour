"use client";

import { useState } from "react";
import type { Inquiry, ConsultationStatus, BookingStatus } from "@/types/inquiry";

const CONSULTATION_LABELS: Record<ConsultationStatus, string> = {
  new: "신규",
  contacted: "상담중",
  closed: "상담종료",
  on_hold: "보류",
};

const BOOKING_LABELS: Record<BookingStatus, string> = {
  none: "미확정",
  reserved: "예약확정",
  completed: "여행완료",
  canceled: "취소",
};

function formatInquiryDate(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

type MobileAdminInquiryCardProps = {
  inquiry: Inquiry;
  consultationStatus: ConsultationStatus;
  bookingStatus: BookingStatus;
  canReserve: boolean;
  canCompleteTrip: boolean;
  isRowPending: boolean;
  isDeletePending: boolean;
  onSetContacted: () => void;
  onSetClosed: () => void;
  onSetOnHold: () => void;
  onResumeContacted: () => void;
  onOpenReserve: () => void;
  onCompleteTrip: () => void;
  onDelete: () => void;
};

export function MobileAdminInquiryCard({
  inquiry,
  consultationStatus,
  bookingStatus,
  canReserve,
  canCompleteTrip,
  isRowPending,
  isDeletePending,
  onSetContacted,
  onSetClosed,
  onSetOnHold,
  onResumeContacted,
  onOpenReserve,
  onCompleteTrip,
  onDelete,
}: MobileAdminInquiryCardProps) {
  const [showQuote, setShowQuote] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [metaExpanded, setMetaExpanded] = useState(false);
  const hasQuote = Boolean(inquiry.quote_snapshot);
  const rawContent = (inquiry.content ?? "").trim();
  const metaLine = (inquiry.acquisition_summary ?? inquiry.source_path ?? "").trim();

  return (
    <article
      data-inquiry-id={inquiry.id}
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]/60 ${
        consultationStatus === "new" || consultationStatus === "contacted"
          ? "bg-[var(--warning-bg)]/20"
          : consultationStatus === "on_hold"
            ? "bg-[var(--surface-muted)]/60"
            : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--primary)]">{inquiry.name}</p>
          <p className="mt-0.5 text-sm tabular-nums text-[var(--text-secondary)]">{inquiry.phone}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              consultationStatus === "new"
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : consultationStatus === "contacted"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  : consultationStatus === "on_hold"
                    ? "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                    : "bg-[var(--success-bg)] text-[var(--success)]"
            }`}
          >
            {CONSULTATION_LABELS[consultationStatus]}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              bookingStatus === "none"
                ? "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                : bookingStatus === "reserved"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                  : bookingStatus === "completed"
                    ? "bg-[var(--success-bg)] text-[var(--success)]"
                    : "bg-[var(--danger-bg)] text-[var(--danger)]"
            }`}
          >
            {BOOKING_LABELS[bookingStatus]}
          </span>
        </div>
      </div>

      {inquiry.product_title ? (
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">{inquiry.product_title}</p>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-subtle)]">일반 문의</p>
      )}

      <p className="mt-1 text-xs tabular-nums text-[var(--text-muted)]">
        {formatInquiryDate(inquiry.created_at ?? "")}
      </p>

      {rawContent ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setContentExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setContentExpanded((v) => !v);
            }
          }}
          className={`mt-2 cursor-pointer text-sm leading-relaxed text-[var(--text-primary)] outline-none ring-[var(--primary)]/40 focus-visible:ring-2 ${
            contentExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-3"
          }`}
          aria-expanded={contentExpanded}
          aria-label={contentExpanded ? "문의 내용 접기" : "문의 내용 전체 보기"}
        >
          {rawContent}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-muted)]">내용 없음</p>
      )}

      {metaLine ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setMetaExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setMetaExpanded((v) => !v);
            }
          }}
          className={`mt-2 cursor-pointer text-xs text-[var(--text-subtle)] outline-none ring-[var(--primary)]/40 focus-visible:ring-2 ${
            metaExpanded ? "break-words whitespace-pre-wrap" : "truncate"
          }`}
          aria-expanded={metaExpanded}
          aria-label={metaExpanded ? "유입 경로 접기" : "유입 경로 전체 보기"}
        >
          {metaLine}
        </div>
      ) : null}

      {hasQuote ? (
        <button
          type="button"
          onClick={() => setShowQuote((v) => !v)}
          className="mt-2 text-xs font-semibold text-[var(--primary)] hover:underline"
          aria-expanded={showQuote}
        >
          {showQuote ? "견적·선택 구성 접기" : "견적·선택 구성 보기"}
        </button>
      ) : null}

      {hasQuote && showQuote && inquiry.quote_snapshot ? (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-muted)]">
          {inquiry.quote_snapshot.quoteSummary?.total != null ? (
            <p className="font-medium text-[var(--text-primary)]">
              예상 합계: {inquiry.quote_snapshot.quoteSummary.total.toLocaleString()}원
            </p>
          ) : null}
          {inquiry.quote_snapshot.selectedOptions &&
          Object.keys(inquiry.quote_snapshot.selectedOptions).length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5">
              {Object.entries(inquiry.quote_snapshot.selectedOptions).map(([k, v]) => (
                <li key={k}>
                  {k}: {v}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {consultationStatus === "new" && (
          <button
            type="button"
            disabled={isRowPending || isDeletePending}
            onClick={onSetContacted}
            className="min-h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            상담중
          </button>
        )}
        {consultationStatus === "contacted" && (
          <>
            <button
              type="button"
              disabled={isRowPending || isDeletePending}
              onClick={onSetClosed}
              className="min-h-9 rounded-lg border border-[var(--success)]/50 bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
            >
              상담종료
            </button>
            <button
              type="button"
              disabled={isRowPending || isDeletePending}
              onClick={onSetOnHold}
              className="min-h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200"
            >
              보류
            </button>
          </>
        )}
        {consultationStatus === "on_hold" && (
          <button
            type="button"
            disabled={isRowPending || isDeletePending}
            onClick={onResumeContacted}
            className="min-h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          >
            재개
          </button>
        )}
        {consultationStatus === "closed" && bookingStatus === "none" && (
          <>
            <button
              type="button"
              disabled={isRowPending || isDeletePending}
              onClick={onSetOnHold}
              className="min-h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200"
            >
              보류
            </button>
            <button
              type="button"
              disabled={isRowPending || isDeletePending}
              onClick={onSetContacted}
              className="min-h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            >
              상담 재개
            </button>
          </>
        )}
        {canReserve && (
          <button
            type="button"
            disabled={isRowPending || isDeletePending}
            onClick={onOpenReserve}
            className="min-h-9 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100"
          >
            예약 확정
          </button>
        )}
        {canCompleteTrip && (
          <button
            type="button"
            disabled={isRowPending || isDeletePending}
            onClick={onCompleteTrip}
            className="min-h-9 rounded-lg border border-[var(--success)]/50 bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
          >
            여행 완료
          </button>
        )}
        <button
          type="button"
          disabled={isDeletePending || isRowPending}
          onClick={onDelete}
          className="min-h-9 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
        >
          삭제
        </button>
      </div>
    </article>
  );
}
