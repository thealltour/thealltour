"use client";

import type { StatusFilter, InquirySortOption } from "@/components/admin/hooks/useAdminInquiryTable";

type MobileAdminInquiryFiltersProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortBy: InquirySortOption;
  onSortChange: (value: InquirySortOption) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onResetPage: () => void;
};

export function MobileAdminInquiryFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  isRefreshing,
  onRefresh,
  onResetPage,
}: MobileAdminInquiryFiltersProps) {
  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
        검색 (이름·연락처·내용)
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onResetPage();
          }}
          placeholder="검색어"
          autoComplete="off"
          className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </label>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
          상태
          <select
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value as StatusFilter);
              onResetPage();
            }}
            className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          >
            <option value="all">전체</option>
            <option value="new">신규 문의</option>
            <option value="contacted">상담중</option>
            <option value="closed">상담종료</option>
            <option value="on_hold">보류</option>
            <option value="reserved">예약확정</option>
            <option value="completed">여행완료</option>
            <option value="pending">미처리 (신규·상담중)</option>
            <option value="delayed">지연 (24h+)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
          정렬
          <select
            value={sortBy}
            onChange={(e) => {
              onSortChange(e.target.value as InquirySortOption);
              onResetPage();
            }}
            className="min-h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          >
            <option value="pending_first">미완료 우선</option>
            <option value="recent">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="name">이름순</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        onClick={() => onRefresh()}
        disabled={isRefreshing}
        className="min-h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRefreshing ? "새로고침 중…" : "새로고침"}
      </button>
    </div>
  );
}
