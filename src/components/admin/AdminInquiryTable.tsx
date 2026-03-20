"use client";

import { Fragment } from "react";
import type { Inquiry, QuoteSnapshot, ConsultationStatus, BookingStatus } from "@/types/inquiry";
import { useAdminInquiryTable, type StatusFilter, type InquirySortOption } from "@/components/admin/hooks/useAdminInquiryTable";
import { parseHostname } from "@/lib/analytics/attribution";

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

  if (!hasOptions && !hasSummary && !snapshot.inquiredAt) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
      <h4 className="mb-3 font-semibold text-[var(--text-primary)]">고객 선택 구성</h4>
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
      {snapshot.inquiredAt ? (
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          문의 시각: {formatDate(snapshot.inquiredAt)}
        </p>
      ) : null}
    </div>
  );
}

export default function AdminInquiryTable() {
  const api = useAdminInquiryTable();

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
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
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
              <option value="reserved">예약확정</option>
              <option value="completed">여행완료</option>
              <option value="pending">미처리 (미종료·미예약)</option>
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
                api.setPage(1);
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
          전체 {api.total}건 · 미처리 {api.pendingCount}건 · 예약확정 {api.reservedCount}건 · 여행완료 {api.completedCount}건
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
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--primary-soft)] text-[var(--primary)]">
            <tr>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">상담 상태</th>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">여행 상태</th>
              <th className="w-[120px] px-4 py-3 text-left font-semibold">고객명</th>
              <th className="w-[150px] px-4 py-3 text-left font-semibold">연락처</th>
              <th className="w-[220px] px-4 py-3 text-left font-semibold">유입 상품</th>
              <th className="px-4 py-3 text-left font-semibold">최초유입</th>
              <th className="min-w-[320px] px-4 py-3 text-left font-semibold">문의 내용</th>
              <th className="w-[180px] px-4 py-3 text-left font-semibold">문의일시</th>
              <th className="w-[100px] px-4 py-3 text-left font-semibold">선택 구성</th>
              <th className="w-[200px] px-4 py-3 text-left font-semibold">액션</th>
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
                const consultationStatus = (inquiry.consultation_status ?? "new") as ConsultationStatus;
                const bookingStatus = (inquiry.booking_status ?? "none") as BookingStatus;
                const isExpanded = api.expandedRows.includes(inquiry.id);
                const canReserve = bookingStatus === "none" && inquiry.customer_profile_id;
                const canCompleteTrip = bookingStatus === "reserved";

                return (
                  <Fragment key={inquiry.id}>
                    <tr
                      className={`border-t border-[var(--divider)] ${
                        consultationStatus !== "closed" ? "bg-[var(--warning-bg)]/30 hover:bg-[var(--warning-bg)]/50" : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            consultationStatus === "new"
                              ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                              : consultationStatus === "contacted"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[var(--success-bg)] text-[var(--success)]"
                          }`}
                        >
                          {CONSULTATION_LABELS[consultationStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 font-medium text-[var(--primary)]">{inquiry.name}</td>
                      <td className="px-4 py-3 tabular-nums">{inquiry.phone}</td>
                      <td className="px-4 py-3">
                        {inquiry.product_title ? (
                          <div className="space-y-1">
                            <p className="font-medium text-[var(--text-secondary)]">{inquiry.product_title}</p>
                            {inquiry.source_path ? (
                              <p className="text-xs text-[var(--text-subtle)]">{inquiry.source_path}</p>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-subtle)]">일반 문의</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inquiry.acquisition_source_label != null || inquiry.first_touch ? (
                          <div
                            className="min-w-0 max-w-[200px] space-y-1"
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
                      <td className="px-4 py-3">
                        <p className={isExpanded ? "whitespace-pre-wrap text-sm leading-6" : "line-clamp-2 text-sm leading-6"}>
                          {inquiry.content}
                        </p>
                        {inquiry.content.length > 70 ? (
                          <button
                            type="button"
                            onClick={() => api.toggleExpand(inquiry.id)}
                            className="mt-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            {isExpanded ? "접기" : "더보기"}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[var(--text-muted)]">
                        {formatDate(inquiry.created_at ?? "")}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {consultationStatus === "new" && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.updateConsultationStatus(inquiry.id, "contacted")}
                              className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            >
                              상담중
                            </button>
                          )}
                          {consultationStatus === "contacted" && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.updateConsultationStatus(inquiry.id, "closed")}
                              className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-2 py-1 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
                            >
                              상담종료
                            </button>
                          )}
                          {canReserve && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.openReserveModal(inquiry)}
                              className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                            >
                              예약 확정
                            </button>
                          )}
                          {canCompleteTrip && (
                            <button
                              type="button"
                              disabled={api.pendingId === inquiry.id}
                              onClick={() => api.completeTrip(inquiry.id)}
                              className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-2 py-1 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
                            >
                              여행 완료
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={api.deletePendingId === inquiry.id || api.pendingId === inquiry.id}
                            onClick={() => api.deleteInquiry(inquiry.id)}
                            className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>
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

      {api.reserveModalInquiryId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reserve-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <h2 id="reserve-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
              예약 확정
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              출발일·귀국일을 입력한 뒤 저장하세요. 문의에 있는 상품 정보가 예약에 반영됩니다.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">출발일</span>
                <input
                  type="date"
                  value={api.reserveDeparture}
                  onChange={(e) => api.setReserveDeparture(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">귀국일</span>
                <input
                  type="date"
                  value={api.reserveReturn}
                  onChange={(e) => api.setReserveReturn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={api.closeReserveModal}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => api.submitReserveBooking()}
                disabled={api.isSubmittingReserve}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
              >
                {api.isSubmittingReserve ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
