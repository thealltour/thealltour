"use client";

import type { Product } from "@/types/product";
import type { AdminProductsListViewProps } from "./adminProducts.types";

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
}: AdminProductsListViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[var(--primary)]">상품 목록</h3>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="상품 검색"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
        </div>
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

      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">상품 목록을 불러오는 중입니다...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-sm">
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
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr className="border-t border-[var(--divider)]">
                  <td colSpan={9} className="px-4 py-10 text-center text-[var(--text-muted)]">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]">
                        📦
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">등록된 상품이 없습니다.</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        상단의 &quot;상품 등록&quot; 탭에서 첫 번째 상품을 추가해 보세요.
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
                    <td className="max-w-[270px] px-4 py-3 font-medium text-[var(--primary)]">
                      {product.title}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{product.category}</td>
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
                      <div className="flex items-center gap-2 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
