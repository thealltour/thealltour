"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import type { AdminProductsListViewProps } from "./adminProducts.types";
import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import AdminProductsQuickFilters from "@/components/admin/products/AdminProductsQuickFilters";
import AdminProductsQuickActions from "@/components/admin/products/AdminProductsQuickActions";
import AdminProductsRowWarnings from "@/components/admin/products/AdminProductsRowWarnings";
import {
  getAdminProductWarnings,
  hasProductPrimaryImage,
  hasProductItinerary,
  formatAdminProductTaxonomyCompactLine,
  buildAdminProductListRowTooltip,
} from "@/components/admin/products/adminProductsList.helpers";

export type { AdminProductsListViewProps } from "./adminProducts.types";

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function sortStateLabel(field: ProductSortKey, direction: "asc" | "desc"): string {
  const desc = direction === "desc";
  const map: Record<ProductSortKey, { asc: string; desc: string }> = {
    updated_at: { desc: "최근 반영순", asc: "오래된 반영순" },
    created_at: { desc: "최근 생성순", asc: "오래된 생성순" },
    title: { asc: "제목 가나다순", desc: "제목 역순" },
    category: { asc: "카테고리순", desc: "카테고리 역순" },
    price: { asc: "가격 낮은순", desc: "가격 높은순" },
    sort_order: { asc: "노출순서순", desc: "노출순서 역순" },
  };
  return desc ? map[field].desc : map[field].asc;
}

function statusBadgeClass(status: string): string {
  if (status === "SOLD_OUT") return "bg-[var(--danger-bg)] text-[var(--danger)]";
  if (status === "LIMITED") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
  if (status === "CONSULT_REQUIRED") return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
  return "bg-[var(--primary-soft)] text-[var(--primary)]";
}

export default function AdminProductsListView({
  products,
  pageSourceCount,
  pageActiveCount,
  pageWarningStats,
  totalCount,
  currentPage,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  totalPages,
  sortField,
  sortDirection,
  keyword,
  isSearchPending = false,
  isLoading,
  errorMessage,
  selectedIds,
  pendingMoveId,
  pendingToggleId,
  pendingDeleteId,
  filterActive,
  filterStatus,
  filterDestinationId,
  filterProductLineId,
  filterThemeQuery,
  filterIssuesOnly,
  destinationOptions,
  productLineOptions,
  themeNameOptions,
  onKeywordChange,
  onSortChange,
  onPageChange,
  onToggleSelectAll,
  onToggleSelectOne,
  onClearSelection,
  onBulkDelete,
  onEditProduct,
  onOpenSmartstoreHtml,
  onOpenFlyer,
  onDeleteProduct,
  onQuickToggleActive,
  onMoveSortOrder,
  onFilterActiveChange,
  onFilterStatusChange,
  onFilterDestinationIdChange,
  onFilterProductLineIdChange,
  onFilterThemeQueryChange,
  onFilterIssuesOnlyChange,
  newProductHref,
  onRetryLoad,
  taxonomyNameMap = {},
}: AdminProductsListViewProps) {
  const isDisplayEmpty = products.length === 0;
  const hadSourceRows = pageSourceCount > 0;
  const issuesOnlyEmpty = filterIssuesOnly && hadSourceRows && isDisplayEmpty;

  const hasServerFilters =
    keyword.trim().length > 0 ||
    filterActive !== "all" ||
    filterStatus !== "all" ||
    filterDestinationId.trim().length > 0 ||
    filterProductLineId.trim().length > 0 ||
    filterThemeQuery.trim().length > 0;

  const { issueProductCount, criticalTotal, warningTotal } = pageWarningStats;
  const tableColSpan = 9;

  function renderProductRow(product: Product) {
    const title = product.title?.trim() || "(제목 없음)";
    const warnings = getAdminProductWarnings(product);
    const { text: taxCompact, titleAttr: taxTitle } = formatAdminProductTaxonomyCompactLine(
      product,
      taxonomyNameMap,
    );
    const rowTip = buildAdminProductListRowTooltip(product, taxonomyNameMap);
    const imgOk = hasProductPrimaryImage(product);
    const itOk = hasProductItinerary(product);

    return (
      <tr
        key={product.id}
        className="border-t border-[var(--divider)] leading-tight hover:bg-[var(--surface-muted)]"
      >
        <td className="w-8 px-1 py-2 align-middle text-center">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--primary)]"
            checked={selectedIds.includes(product.id)}
            onChange={() => onToggleSelectOne(product.id)}
            aria-label={`${title} 선택`}
          />
        </td>
        <td className="w-[1.85rem] min-w-[1.85rem] px-0 py-2 text-center align-middle">
          <AdminProductsRowWarnings warnings={warnings} />
        </td>
        <td className="min-w-[3.25rem] px-2 py-2 align-middle text-center">
          {product.image_url?.trim() ? (
            <div className="mx-auto h-12 w-12 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizeProductImageUrl(product.image_url)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
        </td>
        <td className="min-w-[220px] max-w-[min(46vw,480px)] px-2 py-2 align-middle">
          <div className="flex min-w-0 flex-col gap-0.5" title={rowTip}>
            <span className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-snug text-[var(--primary)]">
              {title}
            </span>
            <p
              className="truncate text-[11px] font-normal leading-snug tracking-tight text-[var(--text-muted)]"
              title={taxTitle}
            >
              {taxCompact}
            </p>
          </div>
        </td>
        <td className="min-w-[120px] max-w-[160px] px-2 py-2 align-middle">
          <div className="inline-flex flex-nowrap items-center gap-1 rounded-md border border-[var(--border)]/70 bg-[var(--surface-muted)]/40 px-1.5 py-1">
            {product.is_active === false ? (
              <span className="inline-flex shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
                비노출
              </span>
            ) : (
              <span className="inline-flex shrink-0 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                노출
              </span>
            )}
            {product.status && STATUS_LABELS[product.status] ? (
              <span
                className={`inline-flex min-w-0 max-w-[5.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(product.status)}`}
                title={STATUS_LABELS[product.status]}
              >
                {STATUS_LABELS[product.status]}
              </span>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">—</span>
            )}
          </div>
        </td>
        <td className="min-w-[5.5rem] whitespace-nowrap px-2 py-2 align-middle text-sm font-medium text-[var(--text-primary)]">
          {typeof product.price === "number"
            ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
            : "—"}
        </td>
        <td className="min-w-[5.5rem] whitespace-nowrap px-1 py-2 align-middle">
          <div className="flex items-center justify-center gap-0.5">
            <span className="inline-flex min-w-[1.35rem] justify-center rounded bg-[var(--surface-muted)] px-1 py-0.5 text-xs font-semibold ring-1 ring-[var(--border)]">
              {typeof product.sort_order === "number" ? product.sort_order : "—"}
            </span>
            <button
              type="button"
              disabled={pendingMoveId === product.id}
              onClick={() => onMoveSortOrder(product, "up")}
              className="rounded border border-[var(--border)] px-1 py-0.5 text-xs leading-none hover:bg-[var(--surface-muted)] disabled:opacity-50"
              title="위로"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={pendingMoveId === product.id}
              onClick={() => onMoveSortOrder(product, "down")}
              className="rounded border border-[var(--border)] px-1 py-0.5 text-xs leading-none hover:bg-[var(--surface-muted)] disabled:opacity-50"
              title="아래로"
            >
              ▼
            </button>
          </div>
        </td>
        <td
          className="min-w-[2.75rem] whitespace-nowrap px-1 py-2 text-center align-middle text-sm leading-none"
          title={`이미지: ${imgOk ? "있음" : "없음"} · 일정: ${itOk ? "있음" : "없음"}`}
        >
          <span className={imgOk ? "opacity-30 grayscale-[0.2]" : "font-semibold text-[var(--danger)]"} aria-hidden>
            {imgOk ? "🖼" : "❌"}
          </span>
          <span className="inline-block w-px select-none opacity-20" aria-hidden>
            {" "}
          </span>
          <span
            className={itOk ? "opacity-30 grayscale-[0.2]" : "font-semibold text-amber-800/90 dark:text-amber-400/90"}
            aria-hidden
          >
            {itOk ? "📅" : "❌"}
          </span>
        </td>
        <td className="w-[182px] min-w-[182px] px-1 py-2 align-middle">
          <AdminProductsQuickActions
            product={product}
            pendingToggleId={pendingToggleId}
            pendingDeleteId={pendingDeleteId}
            onEdit={onEditProduct}
            onSmartstoreHtml={onOpenSmartstoreHtml}
            onFlyer={onOpenFlyer}
            onDelete={onDeleteProduct}
            onToggleActive={onQuickToggleActive}
            dense
          />
        </td>
      </tr>
    );
  }

  function renderMobileRow(product: Product) {
    const title = product.title?.trim() || "(제목 없음)";
    const warnings = getAdminProductWarnings(product);
    const { text: taxCompact, titleAttr: taxTitle } = formatAdminProductTaxonomyCompactLine(
      product,
      taxonomyNameMap,
    );
    const rowTip = buildAdminProductListRowTooltip(product, taxonomyNameMap);
    const imgOk = hasProductPrimaryImage(product);
    const itOk = hasProductItinerary(product);

    return (
      <div
        key={product.id}
        className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-2 pr-1"
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 shrink-0 accent-[var(--primary)]"
          checked={selectedIds.includes(product.id)}
          onChange={() => onToggleSelectOne(product.id)}
          aria-label={`${title} 선택`}
        />
        <div className="shrink-0 self-center">
          <AdminProductsRowWarnings warnings={warnings} />
        </div>
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-muted)]">
          {product.image_url?.trim() ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={normalizeProductImageUrl(product.image_url)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 shrink" title={rowTip}>
          <p className="line-clamp-1 text-[15px] font-semibold leading-snug text-[var(--primary)]">{title}</p>
          <p
            className="truncate text-[11px] font-normal leading-snug tracking-tight text-[var(--text-muted)]"
            title={taxTitle}
          >
            {taxCompact}
          </p>
        </div>
        <div className="inline-flex shrink-0 flex-nowrap items-center gap-1 rounded-md border border-[var(--border)]/70 bg-[var(--surface-muted)]/40 px-1.5 py-1">
          {product.is_active === false ? (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              끔
            </span>
          ) : (
            <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs text-[var(--success)]">
              켬
            </span>
          )}
          {product.status && STATUS_LABELS[product.status] ? (
            <span
              className={`max-w-[4.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(product.status)}`}
            >
              {STATUS_LABELS[product.status]}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-medium text-[var(--text-primary)]">
          {typeof product.price === "number"
            ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
            : "—"}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="rounded bg-[var(--surface-muted)] px-1 py-0.5 text-xs ring-1 ring-[var(--border)]">
            {typeof product.sort_order === "number" ? product.sort_order : "—"}
          </span>
          <button
            type="button"
            disabled={pendingMoveId === product.id}
            onClick={() => onMoveSortOrder(product, "up")}
            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs disabled:opacity-50"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={pendingMoveId === product.id}
            onClick={() => onMoveSortOrder(product, "down")}
            className="rounded border border-[var(--border)] px-1 py-0.5 text-xs disabled:opacity-50"
          >
            ▼
          </button>
        </div>
        <span
          className="flex shrink-0 items-center gap-px text-sm leading-none"
          title={`이미지: ${imgOk ? "있음" : "없음"} · 일정: ${itOk ? "있음" : "없음"}`}
        >
          <span className={imgOk ? "opacity-30 grayscale-[0.2]" : "font-semibold text-[var(--danger)]"} aria-hidden>
            {imgOk ? "🖼" : "❌"}
          </span>
          <span className={itOk ? "opacity-30 grayscale-[0.2]" : "font-semibold text-amber-800/90 dark:text-amber-400/90"} aria-hidden>
            {itOk ? "📅" : "❌"}
          </span>
        </span>
        <AdminProductsQuickActions
          product={product}
          pendingToggleId={pendingToggleId}
          pendingDeleteId={pendingDeleteId}
          onEdit={onEditProduct}
          onSmartstoreHtml={onOpenSmartstoreHtml}
          onFlyer={onOpenFlyer}
          onDelete={onDeleteProduct}
          onToggleActive={onQuickToggleActive}
          compact
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-[var(--primary)]">상품 목록</h3>
        {newProductHref ? (
          <Link
            href={newProductHref}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
          >
            새 상품 등록
          </Link>
        ) : null}
      </div>

      <AdminProductsQuickFilters
        keyword={keyword}
        onKeywordChange={onKeywordChange}
        isSearchPending={isSearchPending}
        filterActive={filterActive}
        onFilterActiveChange={onFilterActiveChange}
        filterStatus={filterStatus}
        onFilterStatusChange={onFilterStatusChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={onSortChange}
        destinationId={filterDestinationId}
        onDestinationIdChange={onFilterDestinationIdChange}
        productLineId={filterProductLineId}
        onProductLineIdChange={onFilterProductLineIdChange}
        themeQuery={filterThemeQuery}
        onThemeQueryChange={onFilterThemeQueryChange}
        filterIssuesOnly={filterIssuesOnly}
        onFilterIssuesOnlyChange={onFilterIssuesOnlyChange}
        destinationOptions={destinationOptions}
        productLineOptions={productLineOptions}
        themeNameOptions={themeNameOptions}
      />

      <div className="rounded-md border border-[var(--border)]/80 bg-[var(--surface-muted)]/40 px-3 py-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-[var(--text-primary)]">
            문제 상품 {issueProductCount}건{" "}
            <span className="font-semibold text-red-700 dark:text-red-400/95">
              (치명 {criticalTotal}
            </span>
            <span className="font-medium text-amber-800/90 dark:text-amber-200/90">
              {" "}
              / 주의 {warningTotal})
            </span>
          </span>
          <span className="text-[10px] text-[var(--text-muted)]/90">이 페이지 기준</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-muted)]">
          전체 {totalCount} · 페이지 {pageSourceCount}
          {filterIssuesOnly && hadSourceRows ? <> · 표시 {products.length}</> : null} · 노출 {pageActiveCount}
          <span className="hidden sm:inline">
            {" "}
            · 정렬 {sortStateLabel(sortField, sortDirection)}
          </span>
        </p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <p>
            선택된 상품 <span className="font-semibold text-[var(--text-primary)]">{selectedIds.length}</span>개
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBulkDelete}
              className="rounded border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--danger)] hover:opacity-90"
            >
              선택 삭제
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              선택 해제
            </button>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          <p>{errorMessage}</p>
          {onRetryLoad ? (
            <button
              type="button"
              onClick={() => onRetryLoad()}
              className="mt-2 rounded border border-[var(--danger)]/50 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-muted)]"
            >
              다시 불러오기
            </button>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          상품 목록을 불러오는 중입니다...
        </div>
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-base">
              <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
                <tr>
                  <th className="w-8 px-1 py-2.5 text-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                      onChange={onToggleSelectAll}
                      checked={
                        products.length > 0 && products.every((product) => selectedIds.includes(product.id))
                      }
                      aria-label="이 페이지 표시 행 전체 선택"
                    />
                  </th>
                  <th className="w-[1.85rem] min-w-[1.85rem] px-0 py-2.5 text-center text-base font-semibold" title="경고">
                    !
                  </th>
                  <th className="min-w-[4.5rem] whitespace-nowrap px-2 py-2.5 text-center text-base font-semibold">
                    썸네일
                  </th>
                  <th className="min-w-[220px] px-2 py-2.5 text-center text-base font-semibold">
                    <button
                      type="button"
                      onClick={() => onSortChange("title")}
                      className="mx-auto flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      상품
                      <span className="text-sm text-[var(--text-muted)]">
                        {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-[120px] max-w-[160px] whitespace-nowrap px-2 py-2.5 text-center text-base font-semibold">
                    상태
                  </th>
                  <th className="min-w-[5.5rem] px-2 py-2.5 text-center text-base font-semibold">
                    <button
                      type="button"
                      onClick={() => onSortChange("price")}
                      className="mx-auto flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      가격
                      <span className="text-sm text-[var(--text-muted)]">
                        {sortField === "price" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-[5.5rem] px-1 py-2.5 text-center text-base font-semibold">
                    <button
                      type="button"
                      onClick={() => onSortChange("sort_order")}
                      className="mx-auto flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      순서
                      <span className="text-sm text-[var(--text-muted)]">
                        {sortField === "sort_order" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="min-w-[2.75rem] whitespace-nowrap px-1 py-2.5 text-center text-base font-semibold" title="이미지·일정">
                    자산
                  </th>
                  <th className="w-[182px] min-w-[182px] px-1 py-2.5 text-center text-base font-semibold">작업</th>
                </tr>
              </thead>
              <tbody>
                {issuesOnlyEmpty ? (
                  <tr className="border-t border-[var(--divider)]">
                    <td colSpan={tableColSpan} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        이 페이지에는 치명·주의 문제가 있는 상품이 없습니다.
                      </p>
                      <p className="mt-1 text-xs">다른 페이지를 보거나 필터를 끄면 전체 목록이 다시 표시됩니다.</p>
                    </td>
                  </tr>
                ) : isDisplayEmpty ? (
                  <tr className="border-t border-[var(--divider)]">
                    <td colSpan={tableColSpan} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                          {keyword.trim() || hasServerFilters ? "🔍" : "📦"}
                        </div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {totalCount === 0
                            ? hasServerFilters
                              ? "조건에 맞는 상품이 없습니다."
                              : "등록된 상품이 없습니다."
                            : "이 페이지에 표시할 상품이 없습니다."}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {keyword.trim() || hasServerFilters
                            ? "검색어·필터를 바꿔 보세요."
                            : '상단의 "새 상품 등록"에서 첫 상품을 추가할 수 있습니다.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  products.map(renderProductRow)
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 lg:hidden">
            {issuesOnlyEmpty ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  이 페이지에는 치명·주의 문제가 있는 상품이 없습니다.
                </p>
                <p className="mt-1 text-xs">필터를 끄거나 다른 페이지를 확인해 보세요.</p>
              </div>
            ) : isDisplayEmpty ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  {totalCount === 0
                    ? hasServerFilters
                      ? "조건에 맞는 상품이 없습니다."
                      : "등록된 상품이 없습니다."
                    : "이 페이지에 표시할 상품이 없습니다."}
                </p>
              </div>
            ) : (
              products.map(renderMobileRow)
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          총 {totalCount}건 중{" "}
          {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)}건
          범위 표시
          {isSearchPending ? (
            <span className="ml-2 text-xs text-[var(--text-muted)]">(검색 반영 중…)</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange ? (
            <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="shrink-0 whitespace-nowrap">페이지당</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                disabled={isLoading}
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] disabled:opacity-50"
                aria-label="페이지당 상품 개수"
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}개
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              이전
            </button>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
