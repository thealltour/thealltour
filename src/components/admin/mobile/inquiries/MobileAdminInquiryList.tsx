"use client";

import {
  useAdminInquiryTable,
  type StatusFilter,
  type InquirySortOption,
} from "@/components/admin/hooks/useAdminInquiryTable";
import type { ConsultationStatus, BookingStatus } from "@/types/inquiry";
import { MobileAdminInquiryCard } from "@/components/admin/mobile/inquiries/MobileAdminInquiryCard";
import { MobileAdminInquiryFilters } from "@/components/admin/mobile/inquiries/MobileAdminInquiryFilters";
import { ReserveBookingWizardModal } from "@/components/admin/inquiries/ReserveBookingWizardModal";

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
        <ReserveBookingWizardModal
          inquiry={api.inquiries.find((i) => i.id === api.reserveModalInquiryId) ?? null}
          api={api}
          variant="mobile"
        />
      ) : null}
    </div>
  );
}
