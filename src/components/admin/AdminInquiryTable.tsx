"use client";

/** 데스크톱 전용 문의 테이블 UI. 모바일은 MobileAdminInquiryList를 사용합니다. */

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus } from "@/types/inquiry";
import { buildAdminBookingNewUrl } from "@/lib/bookings/bookingNewUrl";
import {
  useAdminInquiryTable,
  type AdminInquiryTableController,
  type StatusFilter,
  type InquirySortOption,
} from "@/components/admin/hooks/useAdminInquiryTable";
import { parseHostname } from "@/lib/analytics/attribution";
import { InquiryResponseGuide } from "@/components/admin/inquiries/InquiryResponseGuide";
import { MessageSendPanel } from "@/components/admin/inquiries/MessageSendPanel";
import { InquiryMemberLinkPanel } from "@/components/admin/inquiries/InquiryMemberLinkPanel";
import { InquiryAssigneeFilters } from "@/components/admin/inquiries/InquiryAssigneeFilters";
import { InquiryQuickFilters } from "@/components/admin/inquiries/InquiryQuickFilters";
import { InquirySummaryCards } from "@/components/admin/inquiries/InquirySummaryCards";
import { InquiryWorkloadSummary } from "@/components/admin/inquiries/InquiryWorkloadSummary";
import {
  formatInquiryOpsDetailLine,
  isFollowUpOverdue,
  isHotLead,
} from "@/components/admin/inquiries/inquiryQueue.utils";
import {
  applyTemplateToMessage,
  type TemplateInsertMode,
} from "@/components/admin/inquiries/messageSend.utils";
import { DesiredDepartureBadge } from "@/components/admin/inquiries/DesiredDepartureBadge";
import { ReserveBookingWizardModal } from "@/components/admin/inquiries/ReserveBookingWizardModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { stripDesiredDepartureLineFromContent } from "@/lib/inquiry/desiredDeparture";

const ADMIN_SMS_INSERT_MODE_KEY = "admin:message-insert-mode";

function readStoredSmsInsertMode(): TemplateInsertMode {
  if (typeof window === "undefined") return "append";
  try {
    const raw = sessionStorage.getItem(ADMIN_SMS_INSERT_MODE_KEY);
    return raw === "replace" || raw === "append" ? raw : "append";
  } catch {
    return "append";
  }
}

function formatDate(dateText: string) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${n >= 0 ? "" : "-"}${Math.abs(n).toLocaleString()}원`;
}

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

function QuoteSnapshotSection({ snapshot }: { snapshot: QuoteSnapshot }) {
  const hasOptions =
    (snapshot.selectedOptions && Object.keys(snapshot.selectedOptions).length > 0) ||
    (snapshot.quoteSummary?.breakdown?.length ?? 0) > 0;
  const hasSummary =
    snapshot.quoteSummary &&
    (snapshot.quoteSummary.total != null ||
      snapshot.quoteSummary.basePrice != null ||
      (snapshot.quoteSummary.breakdown?.length ?? 0) > 0);

  const hasDesiredDeparture = Boolean(
    snapshot.desiredDeparture?.flexible || snapshot.desiredDeparture?.date?.trim(),
  );
  const hasPointsUse =
    typeof snapshot.pointsUseRequested === "number" && snapshot.pointsUseRequested > 0;

  if (!hasOptions && !hasSummary && !snapshot.inquiredAt && !hasDesiredDeparture && !hasPointsUse) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
      <h4 className="mb-3 font-semibold text-[var(--text-primary)]">고객 선택 구성</h4>
      {hasDesiredDeparture ? (
        <div className="mb-3">
          <DesiredDepartureBadge
            inquiry={{
              content: "",
              quote_snapshot: { desiredDeparture: snapshot.desiredDeparture },
            }}
          />
        </div>
      ) : null}
      {hasOptions ? (
        <ul className="mb-3 list-inside list-disc space-y-1 text-[var(--text-muted)]">
          {(snapshot.quoteSummary?.breakdown?.length ?? 0) > 0
            ? snapshot.quoteSummary!.breakdown.map((b, i) => (
                <li key={i}>
                  {b.groupLabel} · {b.optionLabel}
                </li>
              ))
            : snapshot.selectedOptions
              ? Object.entries(snapshot.selectedOptions).map(([k, v]) => (
                  <li key={k}>
                    {k}: {v}
                  </li>
                ))
              : null}
        </ul>
      ) : null}
      {hasSummary && snapshot.quoteSummary ? (
        <div className="space-y-1 border-t border-[var(--divider)] pt-3 text-[var(--text-secondary)]">
          {snapshot.quoteSummary.basePrice != null ? (
            <p>예상 기본가: {formatPrice(snapshot.quoteSummary.basePrice)}</p>
          ) : null}
          {(snapshot.quoteSummary.breakdown?.length ?? 0) > 0
            ? snapshot.quoteSummary.breakdown!.map((b, i) => (
                <p key={i}>
                  예상 옵션 · {b.groupLabel} – {b.optionLabel}: {formatPrice(b.priceDelta)}
                </p>
              ))
            : null}
          {snapshot.quoteSummary.total != null ? (
            <p className="font-semibold text-[var(--text-primary)]">예상 합계: {formatPrice(snapshot.quoteSummary.total)}</p>
          ) : null}
        </div>
      ) : null}
      {hasPointsUse ? (
        <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[var(--text-secondary)]">
          <p className="font-semibold text-emerald-800">포인트 사용 요청</p>
          <p>
            요청: {Number(snapshot.pointsUseRequested).toLocaleString("ko-KR")}P
            {typeof snapshot.pointsBalanceAtSubmit === "number"
              ? ` · 제출 시 보유: ${Number(snapshot.pointsBalanceAtSubmit).toLocaleString("ko-KR")}P`
              : ""}
          </p>
        </div>
      ) : null}
      {snapshot.inquiredAt ? (
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          문의 시각: {formatDate(snapshot.inquiredAt)}
        </p>
      ) : null}
    </div>
  );
}

function getInquiryActionFlags(inquiry: Inquiry) {
  const consultationStatus = (inquiry.consultation_status ?? "new") as ConsultationStatus;
  const bookingStatus = (inquiry.booking_status ?? "none") as BookingStatus;
  const canReserve =
    bookingStatus === "none" &&
    Boolean(inquiry.customer_profile_id) &&
    (consultationStatus === "new" ||
      consultationStatus === "contacted" ||
      consultationStatus === "closed");
  const canHoldFromClosed = consultationStatus === "closed" && bookingStatus === "none";
  const canCompleteTrip = bookingStatus === "reserved";
  return { consultationStatus, bookingStatus, canReserve, canHoldFromClosed, canCompleteTrip };
}

/** MobileAdminInquiryCard와 동일 팔레트(라이트/다크) */
const INQUIRY_ACTION_STYLES = {
  amber:
    "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  success:
    "border-[var(--success)]/50 bg-[var(--success-bg)] text-[var(--success)] hover:opacity-90",
  slate:
    "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200",
  blue: "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100",
  red: "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
} as const;

function inquiryActionBtnClass(variant: "table" | "modal", tone: keyof typeof INQUIRY_ACTION_STYLES): string {
  const base =
    variant === "table"
      ? "shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50"
      : "min-h-9 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  return `${base} ${INQUIRY_ACTION_STYLES[tone]}`;
}

function InquiryActionButtons({
  inquiry,
  api,
  variant,
  onBeforeReserve,
}: {
  inquiry: Inquiry;
  api: AdminInquiryTableController;
  variant: "table" | "modal";
  onBeforeReserve?: () => void;
}) {
  const { consultationStatus, bookingStatus, canReserve, canHoldFromClosed, canCompleteTrip } =
    getInquiryActionFlags(inquiry);
  const b = (tone: keyof typeof INQUIRY_ACTION_STYLES) => inquiryActionBtnClass(variant, tone);

  const openReserve = () => {
    onBeforeReserve?.();
    api.openReserveModal(inquiry);
  };

  return (
    <div
      className={
        variant === "table"
          ? "flex w-full max-w-full flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-width:thin]"
          : "flex flex-wrap items-center gap-1.5"
      }
    >
      {consultationStatus === "new" && (
        <button
          type="button"
          disabled={api.pendingId === inquiry.id}
          onClick={() => api.updateConsultationStatus(inquiry.id, "contacted")}
          className={b("amber")}
        >
          상담중
        </button>
      )}
      {consultationStatus === "contacted" && (
        <>
          <button
            type="button"
            disabled={api.pendingId === inquiry.id}
            onClick={() => api.updateConsultationStatus(inquiry.id, "closed")}
            className={b("success")}
          >
            상담종료
          </button>
          <button
            type="button"
            disabled={api.pendingId === inquiry.id}
            onClick={() => api.updateConsultationStatus(inquiry.id, "on_hold")}
            className={b("slate")}
          >
            보류
          </button>
        </>
      )}
      {consultationStatus === "on_hold" && (
        <button
          type="button"
          disabled={api.pendingId === inquiry.id}
          onClick={() => api.updateConsultationStatus(inquiry.id, "contacted")}
          className={b("amber")}
        >
          재개
        </button>
      )}
      {canHoldFromClosed ? (
        <>
          <button
            type="button"
            disabled={api.pendingId === inquiry.id}
            onClick={() => api.updateConsultationStatus(inquiry.id, "on_hold")}
            className={b("slate")}
          >
            보류
          </button>
          <button
            type="button"
            disabled={api.pendingId === inquiry.id}
            onClick={() => api.updateConsultationStatus(inquiry.id, "contacted")}
            className={b("amber")}
          >
            상담 재개
          </button>
        </>
      ) : null}
      {canReserve && (
        <>
          <button
            type="button"
            disabled={api.pendingId === inquiry.id}
            onClick={openReserve}
            className={b("blue")}
          >
            예약 확정
          </button>
          {inquiry.customer_profile_id ? (
            <Link
              href={buildAdminBookingNewUrl({
                customer_profile_id: inquiry.customer_profile_id,
                member_id: inquiry.member_id,
                product_id: inquiry.product_id,
                product_title: inquiry.product_title,
                inquiry_id: inquiry.id,
              })}
              className={b("slate")}
            >
              예약 허브
            </Link>
          ) : null}
        </>
      )}
      {canCompleteTrip && (
        <button
          type="button"
          disabled={api.pendingId === inquiry.id}
          onClick={() => api.completeTrip(inquiry.id)}
          className={b("success")}
        >
          여행 완료
        </button>
      )}
      <button
        type="button"
        disabled={api.deletePendingId === inquiry.id || api.pendingId === inquiry.id}
        onClick={() => api.deleteInquiry(inquiry.id)}
        className={b("red")}
      >
        삭제
      </button>
    </div>
  );
}

export default function AdminInquiryTable() {
  const api = useAdminInquiryTable();
  const [detailInquiry, setDetailInquiry] = useState<Inquiry | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [smsTimelineBump, setSmsTimelineBump] = useState(0);
  const [templateInsertMode, setTemplateInsertMode] = useState<TemplateInsertMode>("append");

  const closeDetailModal = useCallback(() => setDetailInquiry(null), []);

  useEffect(() => {
    setTemplateInsertMode(readStoredSmsInsertMode());
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(ADMIN_SMS_INSERT_MODE_KEY, templateInsertMode);
    } catch {
      /* ignore */
    }
  }, [templateInsertMode]);

  useEffect(() => {
    setMessageDraft("");
    setSmsTimelineBump(0);
  }, [detailInquiry?.id]);

  useEffect(() => {
    if (!detailInquiry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetailModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailInquiry, closeDetailModal]);

  const handleRowBackgroundClick = useCallback((inquiry: Inquiry, e: React.MouseEvent<HTMLTableRowElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, select, textarea, label")) return;
    setDetailInquiry(inquiry);
  }, []);

  const detailInquiryLive =
    detailInquiry != null ? (api.inquiries.find((i) => i.id === detailInquiry.id) ?? detailInquiry) : null;

  if (api.isLoading) {
    return (
      <div className="space-y-3 px-4 py-6">
        <div className="h-9 w-80 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">문의 목록을 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 px-4 pt-4">
        <InquirySummaryCards
          unresponded={api.newCount}
          overdue={api.queueOverdueCount}
          today={api.queueFollowUpTodayCount}
          hot={api.queueHotLeadCount}
          unassigned={api.queueUnassignedCount}
          customerReply={api.queueCustomerReplyCount}
          activeQuick={api.quickFilter}
          onSelectQuick={api.setQuickFilter}
        />
        <InquiryQuickFilters value={api.quickFilter} onChange={api.setQuickFilter} />
        <InquiryAssigneeFilters
          assigneeFilter={api.assigneeFilter}
          onAssigneeFilterChange={api.setAssigneeFilter}
          assignees={api.assigneePickList}
          selfDisplayName={api.selfDisplayName}
          onSelfDisplayNameCommit={api.setSelfDisplayName}
        />
        <InquiryWorkloadSummary
          workload={api.assigneeWorkload}
          assigneeFilter={api.assigneeFilter}
          onPickAssignee={api.setAssigneeFilter}
          capped={api.assigneeWorkloadCapped}
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-0">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-64 flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            검색(이름/연락처/문의내용)
            <input
              type="text"
              value={api.searchQuery}
              onChange={(event) => {
                api.setSearchQuery(event.target.value);
                api.setPage(1);
              }}
              placeholder="검색어를 입력하세요"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            상태 필터
            <select
              value={api.statusFilter}
              onChange={(event) => {
                api.setStatusFilter(event.target.value as StatusFilter);
                api.setPage(1);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="all">전체</option>
              <option value="new">신규 문의</option>
              <option value="contacted">상담중</option>
              <option value="closed">상담종료</option>
              <option value="on_hold">보류</option>
              <option value="reserved">예약확정</option>
              <option value="completed">여행완료</option>
              <option value="pending">미처리 (신규·상담중)</option>
              <option value="in_progress">진행중 (신규·상담중·보류)</option>
              <option value="delayed">지연 (접수 24시간+)</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            정렬
            <select
              value={api.sortBy}
              onChange={(event) => {
                api.setSortBy(event.target.value as InquirySortOption);
                api.setPage(1);
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
            <option value="priority_queue">처리 우선순위 (대기열)</option>
            <option value="pending_first">미완료 우선</option>
            <option value="recent">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="name">이름순</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-muted)]">
            페이지 크기
            <select
              value={api.pageSize}
              onChange={(event) => {
                api.setPageSize(Number(event.target.value));
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => api.loadInquiries({ silent: true })}
            disabled={api.isRefreshing}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed"
          >
            {api.isRefreshing ? "새로고침 중..." : "새로고침"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-[var(--text-muted)]">
        <p>
          전체 {api.total}건 · 미처리 {api.pendingCount}건 · 보류 {api.onHoldCount}건 · 예약확정 {api.reservedCount}건 · 여행완료{" "}
          {api.completedCount}건
        </p>
      </div>

      {api.errorMessage ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)] ring-1 ring-[var(--danger)]/30">
          <span>{api.errorMessage}</span>
          <button
            type="button"
            onClick={() => api.loadInquiries({ silent: true, resetSelection: false })}
            className="rounded-md border border-[var(--danger)]/50 bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-muted)]"
          >
            다시 시도
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>
              <th className="w-[92px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                상담 상태
              </th>
              <th className="w-[92px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                여행 상태
              </th>
              <th className="w-[112px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                고객명
              </th>
              <th className="w-[132px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                연락처
              </th>
              <th className="w-[120px] px-2 py-3 text-left align-top text-xs font-semibold leading-snug">
                유입 상품
              </th>
              <th className="w-[108px] px-2 py-3 text-left align-top text-xs font-semibold leading-snug">
                최초 유입
              </th>
              <th className="min-w-0 px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                문의 내용
              </th>
              <th className="w-[152px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                문의일시
              </th>
              <th className="w-[72px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                선택 구성
              </th>
              <th className="min-w-[360px] w-[400px] px-3 py-3 text-left align-top text-xs font-semibold leading-snug">
                액션
              </th>
            </tr>
          </thead>
          <tbody>
            {api.inquiries.length === 0 ? (
              <tr className="border-t border-[var(--divider)]">
                <td colSpan={10} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            ) : (
              api.inquiries.map((inquiry) => {
                const { consultationStatus, bookingStatus } = getInquiryActionFlags(inquiry);
                const isExpanded = api.expandedRows.includes(inquiry.id);
                const overdue = isFollowUpOverdue(inquiry);
                const hot = isHotLead(inquiry);
                const rowQueueHighlight = overdue
                  ? "bg-red-50/90 hover:bg-red-100/80 dark:bg-red-950/25 dark:hover:bg-red-950/35"
                  : consultationStatus === "new" || consultationStatus === "contacted"
                    ? "bg-[var(--warning-bg)]/30 hover:bg-[var(--warning-bg)]/50"
                    : consultationStatus === "on_hold"
                      ? "bg-[var(--surface-muted)]/80 hover:bg-[var(--surface-muted)]"
                      : "hover:bg-[var(--surface-muted)]";

                return (
                  <Fragment key={inquiry.id}>
                    <tr
                      data-inquiry-id={inquiry.id}
                      className={`cursor-pointer border-t border-[var(--divider)] ${rowQueueHighlight} ${
                        hot ? "border-l-[3px] border-l-red-400 dark:border-l-red-500" : ""
                      }`}
                      onClick={(e) => handleRowBackgroundClick(inquiry, e)}
                    >
                      <td className="px-3 py-3 align-top text-left">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            consultationStatus === "new"
                              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                              : consultationStatus === "contacted"
                                ? "bg-amber-100 text-amber-800"
                                : consultationStatus === "on_hold"
                                  ? "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                                  : "bg-[var(--success-bg)] text-[var(--success)]"
                          }`}
                        >
                          {CONSULTATION_LABELS[consultationStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-left">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            bookingStatus === "none"
                              ? "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                              : bookingStatus === "reserved"
                                ? "bg-blue-100 text-blue-800"
                                : bookingStatus === "completed"
                                  ? "bg-[var(--success-bg)] text-[var(--success)]"
                                  : "bg-[var(--danger-bg)] text-[var(--danger)]"
                          }`}
                        >
                          {BOOKING_LABELS[bookingStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--primary)]">{inquiry.name}</span>
                          {(inquiry.unread_inbound_sms_count ?? 0) > 0 ? (
                            <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                              회신 {inquiry.unread_inbound_sms_count}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-left tabular-nums">{inquiry.phone}</td>
                      <td className="min-w-0 max-w-[120px] px-2 py-3 align-top text-left">
                        {inquiry.product_title ? (
                          <div className="min-w-0 space-y-0.5">
                            <p
                              className="truncate text-sm font-medium text-[var(--text-secondary)]"
                              title={inquiry.product_title}
                            >
                              {inquiry.product_title}
                            </p>
                            {inquiry.source_path ? (
                              <p className="truncate text-xs text-[var(--text-subtle)]" title={inquiry.source_path}>
                                {inquiry.source_path}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">일반 문의</span>
                        )}
                      </td>
                      <td className="min-w-0 max-w-[108px] px-2 py-3 align-top text-left">
                        {inquiry.acquisition_source_label != null || inquiry.first_touch ? (
                          <div
                            className="min-w-0 space-y-1"
                            title={[
                              inquiry.acquisition_summary,
                              inquiry.inquiry_page_url,
                              inquiry.first_touch?.firstReferrer,
                            ]
                              .filter(Boolean)
                              .join(" · ") || undefined}
                          >
                            <p className="truncate font-medium text-[var(--text-primary)]">
                              {inquiry.acquisition_source_label ??
                                inquiry.first_touch?.utm_source ??
                                (inquiry.first_touch?.firstReferrer
                                  ? parseHostname(inquiry.first_touch.firstReferrer) ?? inquiry.first_touch.firstReferrer
                                  : null) ??
                                "direct"}
                            </p>
                            <p className="flex items-center gap-1">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  inquiry.acquisition_channel === "paid"
                                    ? "bg-amber-100 text-amber-800"
                                    : inquiry.acquisition_channel === "social"
                                      ? "bg-blue-100 text-blue-800"
                                      : inquiry.acquisition_channel === "organic"
                                        ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                        : inquiry.acquisition_channel === "referral"
                                          ? "bg-slate-100 text-slate-700"
                                          : "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                                }`}
                              >
                                {inquiry.acquisition_channel ?? inquiry.first_touch?.utm_medium ?? "-"}
                              </span>
                            </p>
                            <p className="truncate text-xs text-[var(--text-subtle)]" title={inquiry.acquisition_summary ?? undefined}>
                              {inquiry.first_landing_path ?? inquiry.acquisition_summary ?? "-"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">미확인</span>
                        )}
                      </td>
                      <td className="min-w-0 px-3 py-3 align-top text-left">
                        <DesiredDepartureBadge inquiry={inquiry} className="mb-2" />
                        <p className={isExpanded ? "whitespace-pre-wrap text-sm leading-6" : "line-clamp-2 text-sm leading-6"}>
                          {stripDesiredDepartureLineFromContent(inquiry.content ?? "") || "(내용 없음)"}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-[var(--text-subtle)]">
                          {formatInquiryOpsDetailLine(inquiry)}
                        </p>
                        {(stripDesiredDepartureLineFromContent(inquiry.content ?? "") || inquiry.content).length > 70 ? (
                          <button
                            type="button"
                            onClick={() => api.toggleExpand(inquiry.id)}
                            className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {isExpanded ? "접기" : "더보기"}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top text-left text-xs tabular-nums text-[var(--text-muted)]">
                        {formatDate(inquiry.created_at ?? "")}
                      </td>
                      <td className="px-3 py-3 align-top text-left">
                        {inquiry.quote_snapshot ? (
                          <button
                            type="button"
                            onClick={() =>
                              api.setExpandedQuoteId(api.expandedQuoteId === inquiry.id ? null : inquiry.id)
                            }
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {api.expandedQuoteId === inquiry.id ? "접기" : "보기"}
                          </button>
                        ) : (
                          <span className="text-[var(--text-subtle)]">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-left">
                        <InquiryActionButtons inquiry={inquiry} api={api} variant="table" />
                      </td>
                    </tr>
                    {inquiry.quote_snapshot && api.expandedQuoteId === inquiry.id ? (
                      <tr className="border-t border-[var(--divider)] bg-[var(--surface-muted)]">
                        <td colSpan={10} className="px-4 py-3">
                          <QuoteSnapshotSection snapshot={inquiry.quote_snapshot} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 pb-4 pt-1 text-sm text-[var(--text-muted)]">
        <p>
          총 {api.total}건 중 {api.total === 0 ? 0 : (api.safePage - 1) * api.pageSize + 1}
          -
          {Math.min(api.safePage * api.pageSize, api.total)}건 표시
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => api.movePage(api.safePage - 1)}
            disabled={api.safePage <= 1}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {api.safePage} / {api.totalPages}
          </span>
          <button
            type="button"
            onClick={() => api.movePage(api.safePage + 1)}
            disabled={api.safePage >= api.totalPages}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>

      {detailInquiryLive ? (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-detail-title"
          onClick={closeDetailModal}
        >
          <div
            className="flex max-h-[94vh] w-[98vw] max-w-[1920px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const inv = detailInquiryLive;
              const { consultationStatus, bookingStatus } = getInquiryActionFlags(inv);
              return (
                <>
                  <div className="sticky top-0 z-[1] flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                    <div className="min-w-0">
                      <h2 id="inquiry-detail-title" className="text-lg font-semibold text-[var(--text-primary)]">
                        문의 상세
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        전체 내용 확인 · 아래에서 동일하게 처리할 수 있습니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeDetailModal}
                      className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.92fr)_minmax(0,0.92fr)_minmax(0,1.05fr)]">
                    <div className="min-h-0 overflow-y-auto border-b border-[var(--border)] px-4 py-4 xl:border-b-0 xl:border-r xl:max-h-none max-h-[min(44vh,520px)]">
                      <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          consultationStatus === "new"
                            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                            : consultationStatus === "contacted"
                              ? "bg-amber-100 text-amber-800"
                              : consultationStatus === "on_hold"
                                ? "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300"
                                : "bg-[var(--success-bg)] text-[var(--success)]"
                        }`}
                      >
                        상담 · {CONSULTATION_LABELS[consultationStatus]}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          bookingStatus === "none"
                            ? "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                            : bookingStatus === "reserved"
                              ? "bg-blue-100 text-blue-800"
                              : bookingStatus === "completed"
                                ? "bg-[var(--success-bg)] text-[var(--success)]"
                                : "bg-[var(--danger-bg)] text-[var(--danger)]"
                        }`}
                      >
                        여행 · {BOOKING_LABELS[bookingStatus]}
                      </span>
                    </div>
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold text-[var(--text-muted)]">고객명</dt>
                        <dd className="mt-0.5 font-medium text-[var(--primary)]">{inv.name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-[var(--text-muted)]">연락처</dt>
                        <dd className="mt-0.5 tabular-nums text-[var(--text-primary)]">{inv.phone}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold text-[var(--text-muted)]">문의일시</dt>
                        <dd className="mt-0.5 text-xs tabular-nums text-[var(--text-secondary)]">
                          {formatDate(inv.created_at ?? "")}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs font-semibold text-[var(--text-muted)]">유입 상품</dt>
                        <dd className="mt-0.5 text-[var(--text-primary)]">
                          {inv.product_title ? (
                            <span>
                              {inv.product_title}
                              {inv.source_path ? (
                                <span className="mt-1 block text-xs text-[var(--text-subtle)]">{inv.source_path}</span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-[var(--text-subtle)]">일반 문의</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)]">최초 유입</h3>
                      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3 text-sm">
                        {inv.acquisition_source_label != null || inv.first_touch ? (
                          <div className="space-y-2">
                            <p className="font-medium text-[var(--text-primary)]">
                              {inv.acquisition_source_label ??
                                inv.first_touch?.utm_source ??
                                (inv.first_touch?.firstReferrer
                                  ? parseHostname(inv.first_touch.firstReferrer) ?? inv.first_touch.firstReferrer
                                  : null) ??
                                "direct"}
                            </p>
                            <p className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  inv.acquisition_channel === "paid"
                                    ? "bg-amber-100 text-amber-800"
                                    : inv.acquisition_channel === "social"
                                      ? "bg-blue-100 text-blue-800"
                                      : inv.acquisition_channel === "organic"
                                        ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                                        : inv.acquisition_channel === "referral"
                                          ? "bg-slate-100 text-slate-700"
                                          : "bg-[var(--text-muted)]/20 text-[var(--text-secondary)]"
                                }`}
                              >
                                {inv.acquisition_channel ?? inv.first_touch?.utm_medium ?? "-"}
                              </span>
                            </p>
                            <p className="break-all text-xs text-[var(--text-subtle)]">
                              {inv.first_landing_path ?? inv.acquisition_summary ?? "-"}
                            </p>
                            {inv.inquiry_page_url ? (
                              <p className="break-all text-xs text-[var(--text-muted)]">{inv.inquiry_page_url}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">미확인</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)]">문의 내용</h3>
                      <DesiredDepartureBadge inquiry={inv} className="mt-2" />
                      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3 text-sm leading-relaxed text-[var(--text-primary)]">
                        {stripDesiredDepartureLineFromContent(inv.content ?? "") || "(내용 없음)"}
                      </p>
                    </div>
                    <InquiryMemberLinkPanel
                      inquiry={inv}
                      onLinked={(memberId) => {
                        api.applyInquiryMerge(inv.id, { ...inv, member_id: memberId });
                      }}
                      onUnlinked={() => {
                        api.applyInquiryMerge(inv.id, { ...inv, member_id: null });
                      }}
                    />
                        {inv.quote_snapshot ? (
                          <QuoteSnapshotSection snapshot={inv.quote_snapshot} />
                        ) : null}
                      </div>
                    </div>
                    <InquiryResponseGuide
                        key={inv.id}
                        inquiry={inv}
                        layout="split"
                        onSaved={(updated) => {
                          api.applyInquiryMerge(updated.id, updated);
                        }}
                        onUseAsMessageDraft={(text) =>
                          setMessageDraft((prev) =>
                            applyTemplateToMessage({
                              currentText: prev,
                              templateText: text,
                              mode: templateInsertMode,
                            }),
                          )
                        }
                        externalTimelineBump={smsTimelineBump}
                      />
                    <aside className="min-h-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-muted)]/15 px-3 py-4 xl:border-t-0 xl:border-l xl:max-h-none max-h-[min(42vh,480px)]">
                      <MessageSendPanel
                        inquiry={inv}
                        message={messageDraft}
                        onMessageChange={setMessageDraft}
                        templateInsertMode={templateInsertMode}
                        onTemplateInsertModeChange={setTemplateInsertMode}
                        onSent={() => setSmsTimelineBump((b) => b + 1)}
                      />
                    </aside>
                  </div>
                  <div className="sticky bottom-0 z-[1] shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4">
                    <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">처리</p>
                    <InquiryActionButtons
                      inquiry={inv}
                      api={api}
                      variant="modal"
                      onBeforeReserve={closeDetailModal}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}

      {api.reserveModalInquiryId ? (
        <ReserveBookingWizardModal
          inquiry={api.inquiries.find((i) => i.id === api.reserveModalInquiryId) ?? null}
          api={api}
          variant="desktop"
        />
      ) : null}
    </div>
  );
}
