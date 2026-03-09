"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import type { AdminProductsListViewProps } from "./adminProducts.types";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type { AdminProductsListViewProps } from "./adminProducts.types";

export default function AdminProductsListView({
  products,
  totalCount,
  currentPage,
  pageSize,
  totalPages,
  sortField,
  sortDirection,
  keyword,
  isLoading,
  errorMessage,
  selectedIds,
  pendingMoveId,
  pendingToggleId,
  filterActive,
  filterStatus,
  onKeywordChange,
  onSortChange,
  onPageChange,
  onToggleSelectAll,
  onToggleSelectOne,
  onClearSelection,
  onBulkDelete,
  onEditProduct,
  onDeleteProduct,
  onQuickToggleActive,
  onMoveSortOrder,
  onFilterActiveChange,
  onFilterStatusChange,
  newProductHref,
  onRetryLoad,
  taxonomyNameMap = {},
}: AdminProductsListViewProps) {
  const isEmpty = products.length === 0;
  const isSearchEmpty = keyword.trim() !== "" && isEmpty;

  function resolveTaxonomyName(id: string | null | undefined): string | null {
    if (!id || typeof id !== "string") return null;
    const name = taxonomyNameMap[id];
    return name && name.trim() ? name.trim() : null;
  }

  function formatDestinationProductLineCell(product: Product) {
    const destId = product.destination_id ?? null;
    const lineId = product.product_line_id ?? null;
    const destName = resolveTaxonomyName(destId);
    const lineName = resolveTaxonomyName(lineId);
    const hasDest = !!destId;
    const hasLine = !!lineId;
    if (!hasDest && !hasLine) return { label: "-", title: "" };
    const destLabel = destName ?? (destId ? `지역 ${String(destId).slice(0, 8)}…` : "");
    const lineLabel = lineName ?? (lineId ? `상품군 ${String(lineId).slice(0, 8)}…` : "");
    const parts: string[] = [];
    if (destLabel) parts.push(`지역 ${destLabel}`);
    if (lineLabel) parts.push(`상품군 ${lineLabel}`);
    const label = parts.join(" · ");
    const titleLines: string[] = [];
    if (hasDest) titleLines.push(`지역: ${destName ?? destId}`, `destination_id: ${destId}`);
    if (hasLine) titleLines.push(`상품군: ${lineName ?? lineId}`, `product_line_id: ${lineId}`);
    return { label, title: titleLines.join("\n") };
  }

  function formatDate(iso?: string) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return "-";
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    AVAILABLE: "예약 가능",
    LIMITED: "잔여 한정",
    SOLD_OUT: "마감",
    CONSULT_REQUIRED: "상담 후 안내",
  };

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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="상품명·설명·카테고리·테마·원본주소 검색"
          className="min-w-[200px] flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]"
        />
        <select
          value={filterActive}
          onChange={(e) => onFilterActiveChange(e.target.value as "all" | "active" | "inactive")}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">노출: 전체</option>
          <option value="active">노출만</option>
          <option value="inactive">비노출만</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            onFilterStatusChange(
              e.target.value as "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED",
            )
          }
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">상태: 전체</option>
          <option value="AVAILABLE">예약 가능</option>
          <option value="LIMITED">잔여 한정</option>
          <option value="SOLD_OUT">마감</option>
          <option value="CONSULT_REQUIRED">상담 후 안내</option>
        </select>
        <select
          value={`${sortField}:${sortDirection}`}
          onChange={(e) => {
            const [f, d] = (e.target.value as string).split(":");
            onSortChange(f as Parameters<typeof onSortChange>[0], d as "asc" | "desc");
          }}
          className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="created_at:desc">최근 생성순</option>
          <option value="created_at:asc">오래된 생성순</option>
          <option value="updated_at:desc">최근 수정순</option>
          <option value="title:asc">제목 가나다순</option>
          <option value="title:desc">제목 가나다 역순</option>
          <option value="sort_order:asc">노출순서순</option>
          <option value="price:asc">가격 낮은순</option>
          <option value="price:desc">가격 높은순</option>
        </select>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <p>
            선택된 상품 <span className="font-semibold">{selectedIds.length}</span>개
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead className="bg-[var(--primary-soft)] text-[var(--primary)]">
              <tr>
                <th className="w-[42px] px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    onChange={onToggleSelectAll}
                    checked={
                      products.length > 0 &&
                      products.every((product) => selectedIds.includes(product.id))
                    }
                  />
                </th>
                <th className="w-[56px] px-2 py-3 text-center font-semibold whitespace-nowrap">대표</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">원본주소</th>
                <th className="px-4 py-3 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => onSortChange("title")}
                    className="inline-flex items-center gap-1"
                  >
                    <span>상품명</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sortField === "title" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onSortChange("category")}
                    className="inline-flex items-center gap-1"
                  >
                    <span>카테고리</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sortField === "category" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">지역·상품군</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">테마/배지</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onSortChange("price")}
                    className="inline-flex items-center gap-1"
                  >
                    <span>가격</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sortField === "price" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
                <th className="w-[170px] px-4 py-3 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() => onSortChange("sort_order")}
                    className="inline-flex items-center gap-1"
                  >
                    <span>노출순서</span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {sortField === "sort_order" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
                <th className="w-[110px] px-4 py-3 text-left font-semibold whitespace-nowrap">활성화</th>
                <th className="w-[100px] px-4 py-3 text-left font-semibold whitespace-nowrap">예약상태</th>
                <th className="w-[120px] px-4 py-3 text-left font-semibold whitespace-nowrap">생성일</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody>
              {isEmpty ? (
                <tr className="border-t border-[var(--divider)]">
                  <td colSpan={13} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        {isSearchEmpty ? "🔍" : "📦"}
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {isSearchEmpty ? "검색 결과가 없습니다." : "등록된 상품이 없습니다."}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {isSearchEmpty
                          ? "다른 검색어로 시도해 보세요."
                          : '상단의 "새 상품 등록" 또는 "상품 등록" 탭에서 첫 번째 상품을 추가해 보세요.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="group border-t border-[var(--divider)] hover:bg-[var(--surface-muted)]">
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--primary)]"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => onToggleSelectOne(product.id)}
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      {product.image_url?.trim() ? (
                        <div className="relative mx-auto h-10 w-10 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-muted)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={normalizeProductImageUrl(product.image_url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {product.product_source_url ? (
                        <a
                          href={product.product_source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                        >
                          원본 보기
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="max-w-[270px] px-4 py-3 font-medium text-[var(--primary)] truncate" title={product.title}>
                      {product.title}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{product.category}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-[var(--text-secondary)]">
                      {(() => {
                        const { label, title } = formatDestinationProductLineCell(product);
                        return title ? (
                          <span title={title}>{label}</span>
                        ) : (
                          <span>{label}</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{product.theme ?? "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {typeof product.price === "number"
                        ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex min-w-8 justify-center rounded bg-[var(--surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)] ring-1 ring-[var(--border)]">
                          {typeof product.sort_order === "number" ? product.sort_order : "-"}
                        </span>
                        <button
                          type="button"
                          disabled={pendingMoveId === product.id}
                          onClick={() => onMoveSortOrder(product, "up")}
                          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                          title="위로 이동"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={pendingMoveId === product.id}
                          onClick={() => onMoveSortOrder(product, "down")}
                          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                          title="아래로 이동"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {product.is_active === false ? (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                          비노출
                        </span>
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs text-[var(--success)]">
                          노출
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {product.status && STATUS_LABELS[product.status] ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.status === "SOLD_OUT"
                              ? "bg-[var(--danger-bg)] text-[var(--danger)]"
                              : product.status === "LIMITED"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                : product.status === "CONSULT_REQUIRED"
                                  ? "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                                  : "bg-[var(--primary-soft)] text-[var(--primary)]"
                          }`}
                        >
                          {STATUS_LABELS[product.status]}
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-[var(--text-secondary)]" title={product.created_at}>
                      {formatDate(product.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <Link
                          href={`/products/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:opacity-90"
                        >
                          미리보기
                        </Link>
                        <button
                          type="button"
                          disabled={pendingToggleId === product.id}
                          onClick={() => onQuickToggleActive(product)}
                          className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                            product.is_active === false
                              ? "border border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)] hover:opacity-90"
                              : "border border-[var(--danger)]/30 bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90"
                          }`}
                        >
                          {product.is_active === false ? "활성화" : "비활성화"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditProduct(product)}
                          className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-muted)]"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProduct(product.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
        <p>
          총 {totalCount}건 중 {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(
            currentPage * pageSize,
            totalCount,
          )}
          건 표시
        </p>
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
  );
}
