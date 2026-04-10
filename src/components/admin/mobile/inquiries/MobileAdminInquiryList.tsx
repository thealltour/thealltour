"use client";

import {
  useAdminInquiryTable,
  type StatusFilter,
  type InquirySortOption,
} from "@/components/admin/hooks/useAdminInquiryTable";
import type { ConsultationStatus, BookingStatus } from "@/types/inquiry";
import { MobileAdminInquiryCard } from "@/components/admin/mobile/inquiries/MobileAdminInquiryCard";
import { MobileAdminInquiryFilters } from "@/components/admin/mobile/inquiries/MobileAdminInquiryFilters";

/**
 * 모바일 전용 문의 목록. 비즈니스 로직은 useAdminInquiryTable 단일 훅 재사용.
 */
export function MobileAdminInquiryList() {
  const api = useAdminInquiryTable();

  if (api.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="문의 목록 로딩">
        <div className="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        <p className="text-center text-sm text-[var(--text-muted)]">문의 목록을 불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          전체 <span className="tabular-nums text-[var(--primary)]">{api.total}</span>건
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          미처리 {api.pendingCount} · 보류 {api.onHoldCount} · 예약 {api.reservedCount} · 완료 {api.completedCount}
        </p>
      </div>

      <MobileAdminInquiryFilters
        searchQuery={api.searchQuery}
        onSearchChange={api.setSearchQuery}
        statusFilter={api.statusFilter as StatusFilter}
        onStatusFilterChange={api.setStatusFilter}
        sortBy={api.sortBy as InquirySortOption}
        onSortChange={api.setSortBy}
        isRefreshing={api.isRefreshing}
        onRefresh={() => api.loadInquiries({ silent: true })}
        onResetPage={() => api.setPage(1)}
      />

      {api.errorMessage ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)] ring-1 ring-[var(--danger)]/30">
          <span>{api.errorMessage}</span>
          <button
            type="button"
            onClick={() => api.loadInquiries({ silent: true, resetSelection: false })}
            className="self-start rounded-lg border border-[var(--danger)]/50 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {api.inquiries.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <p className="text-sm font-medium text-[var(--text-muted)]">조건에 맞는 문의가 없습니다.</p>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {api.inquiries.map((inquiry) => {
            const consultationStatus = (inquiry.consultation_status ?? "new") as ConsultationStatus;
            const bookingStatus = (inquiry.booking_status ?? "none") as BookingStatus;
            const canReserve =
              bookingStatus === "none" &&
              Boolean(inquiry.customer_profile_id) &&
              (consultationStatus === "new" ||
                consultationStatus === "contacted" ||
                consultationStatus === "closed");
            const canCompleteTrip = bookingStatus === "reserved";
            const isRowPending = api.pendingId === inquiry.id;
            const isDeletePending = api.deletePendingId === inquiry.id;

            return (
              <li key={inquiry.id}>
                <MobileAdminInquiryCard
                  inquiry={inquiry}
                  consultationStatus={consultationStatus}
                  bookingStatus={bookingStatus}
                  canReserve={canReserve}
                  canCompleteTrip={canCompleteTrip}
                  isRowPending={isRowPending}
                  isDeletePending={isDeletePending}
                  onSetContacted={() => api.updateConsultationStatus(inquiry.id, "contacted")}
                  onSetClosed={() => api.updateConsultationStatus(inquiry.id, "closed")}
                  onSetOnHold={() => api.updateConsultationStatus(inquiry.id, "on_hold")}
                  onResumeContacted={() => api.updateConsultationStatus(inquiry.id, "contacted")}
                  onOpenReserve={() => api.openReserveModal(inquiry)}
                  onCompleteTrip={() => api.completeTrip(inquiry.id)}
                  onDelete={() => api.deleteInquiry(inquiry.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 text-sm text-[var(--text-muted)]">
        <span className="text-xs">
          {api.total === 0
            ? "0건"
            : `${(api.safePage - 1) * api.pageSize + 1}–${Math.min(api.safePage * api.pageSize, api.total)} / ${api.total}건`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => api.movePage(api.safePage - 1)}
            disabled={api.safePage <= 1}
            className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-xs font-semibold tabular-nums">
            {api.safePage} / {api.totalPages}
          </span>
          <button
            type="button"
            onClick={() => api.movePage(api.safePage + 1)}
            disabled={api.safePage >= api.totalPages}
            className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>

      {api.reserveModalInquiryId ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-reserve-title"
        >
          <div className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg sm:rounded-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h2 id="mobile-reserve-title" className="text-lg font-semibold text-[var(--text-primary)]">
              예약 확정
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              출발일·귀국일을 입력한 뒤 저장하세요.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">출발일</span>
                <input
                  type="date"
                  value={api.reserveDeparture}
                  onChange={(e) => api.setReserveDeparture(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--text-muted)]">귀국일</span>
                <input
                  type="date"
                  value={api.reserveReturn}
                  onChange={(e) => api.setReserveReturn(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={api.closeReserveModal}
                className="min-h-10 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => api.submitReserveBooking()}
                disabled={api.isSubmittingReserve}
                className="min-h-10 flex-1 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
              >
                {api.isSubmittingReserve ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
