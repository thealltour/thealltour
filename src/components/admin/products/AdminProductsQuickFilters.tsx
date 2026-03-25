"use client";

import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";
import type { AdminProductsTaxonomyOption } from "./adminProductsList.types";

type AdminProductsQuickFiltersProps = {
  keyword: string;
  onKeywordChange: (v: string) => void;
  isSearchPending: boolean;
  filterActive: "all" | "active" | "inactive";
  onFilterActiveChange: (v: "all" | "active" | "inactive") => void;
  filterStatus: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  onFilterStatusChange: (v: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED") => void;
  sortField: ProductSortKey;
  sortDirection: "asc" | "desc";
  onSortChange: (field: ProductSortKey, direction?: "asc" | "desc") => void;
  destinationId: string;
  onDestinationIdChange: (id: string) => void;
  productLineId: string;
  onProductLineIdChange: (id: string) => void;
  themeQuery: string;
  onThemeQueryChange: (v: string) => void;
  filterIssuesOnly: boolean;
  onFilterIssuesOnlyChange: (v: boolean) => void;
  destinationOptions: AdminProductsTaxonomyOption[];
  productLineOptions: AdminProductsTaxonomyOption[];
  themeNameOptions: string[];
};

export default function AdminProductsQuickFilters({
  keyword,
  onKeywordChange,
  isSearchPending,
  filterActive,
  onFilterActiveChange,
  filterStatus,
  onFilterStatusChange,
  sortField,
  sortDirection,
  onSortChange,
  destinationId,
  onDestinationIdChange,
  productLineId,
  onProductLineIdChange,
  themeQuery,
  onThemeQueryChange,
  filterIssuesOnly,
  onFilterIssuesOnlyChange,
  destinationOptions,
  productLineOptions,
  themeNameOptions,
}: AdminProductsQuickFiltersProps) {
  const selectCls =
    "rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2 text-xs text-[var(--text-primary)] min-w-0";

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="상품명, 지역·상품라인·테마·설명·원본 URL 등으로 검색"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 pr-10 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
            aria-busy={isSearchPending}
          />
          {isSearchPending ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
              검색 중…
            </span>
          ) : null}
        </div>
        <select
          value={`${sortField}:${sortDirection}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split(":");
            onSortChange(f as ProductSortKey, d as "asc" | "desc");
          }}
          className={`${selectCls} sm:max-w-[220px]`}
          title="목록 정렬"
        >
          <option value="updated_at:desc">최근 반영순 (등록·수정일 기준)</option>
          <option value="updated_at:asc">오래된 반영순</option>
          <option value="created_at:desc">최근 생성순</option>
          <option value="created_at:asc">오래된 생성순</option>
          <option value="title:asc">제목 가나다순</option>
          <option value="title:desc">제목 가나다 역순</option>
          <option value="sort_order:asc">노출순서순</option>
          <option value="price:asc">가격 낮은순</option>
          <option value="price:desc">가격 높은순</option>
          <option value="category:asc">카테고리순</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterActive}
          onChange={(e) => onFilterActiveChange(e.target.value as typeof filterActive)}
          className={selectCls}
        >
          <option value="all">노출: 전체</option>
          <option value="active">노출만</option>
          <option value="inactive">비노출만</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            onFilterStatusChange(
              e.target.value as typeof filterStatus,
            )
          }
          className={selectCls}
        >
          <option value="all">예약상태: 전체</option>
          <option value="AVAILABLE">예약 가능</option>
          <option value="LIMITED">잔여 한정</option>
          <option value="SOLD_OUT">마감</option>
          <option value="CONSULT_REQUIRED">상담 후 안내</option>
        </select>
        <select
          value={destinationId}
          onChange={(e) => onDestinationIdChange(e.target.value)}
          className={`${selectCls} min-w-[140px] max-w-[200px]`}
        >
          <option value="">지역: 전체</option>
          {destinationOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={productLineId}
          onChange={(e) => onProductLineIdChange(e.target.value)}
          className={`${selectCls} min-w-[140px] max-w-[200px]`}
        >
          <option value="">상품군: 전체</option>
          {productLineOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          value={themeQuery}
          onChange={(e) => onThemeQueryChange(e.target.value)}
          className={`${selectCls} min-w-[120px] max-w-[200px]`}
        >
          <option value="">테마(문자열): 전체</option>
          {themeNameOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2 text-xs text-[var(--text-secondary)]"
          title="이미 불러온 현재 페이지 목록만 대상으로, 치명·주의 경고가 있는 행만 보여 줍니다."
        >
          <input
            type="checkbox"
            checked={filterIssuesOnly}
            onChange={(e) => onFilterIssuesOnlyChange(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--primary)]"
          />
          이 페이지 · 문제 상품만
        </label>
      </div>
      <p className="text-[10px] leading-snug text-[var(--text-muted)]">
        테마 필터: DB <code className="rounded bg-[var(--surface-muted)] px-1">theme</code> 부분일치. 문제만 보기는{" "}
        <strong>현재 페이지</strong>에만 적용됩니다.
      </p>
    </div>
  );
}
