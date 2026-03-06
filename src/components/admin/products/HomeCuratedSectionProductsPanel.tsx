"use client";

import type { Product } from "@/types/product";
import type { HomeCuratedSectionWithCount, SectionProductMappingRow } from "@/types/homeCurated";

export type HomeCuratedSectionProductsPanelProps = {
  selectedSection: HomeCuratedSectionWithCount | null;
  sectionProducts: SectionProductMappingRow[];
  productSearchKeyword: string;
  productSearchResults: Product[];
  isLoadingProducts: boolean;
  isSearchingProducts: boolean;
  isSaving: boolean;
  onChangeSearchKeyword: (value: string) => void;
  onAddProduct: (productId: string) => void;
  onRemoveProduct: (mappingId: string) => void;
  onMoveProductUp: (mappingId: string) => void;
  onMoveProductDown: (mappingId: string) => void;
};

export default function HomeCuratedSectionProductsPanel({
  selectedSection,
  sectionProducts,
  productSearchKeyword,
  productSearchResults,
  isLoadingProducts,
  isSearchingProducts,
  isSaving,
  onChangeSearchKeyword,
  onAddProduct,
  onRemoveProduct,
  onMoveProductUp,
  onMoveProductDown,
}: HomeCuratedSectionProductsPanelProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold text-[var(--text-primary)]">섹션별 상품 구성</p>
      {selectedSection ? (
        <>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            비활성 상품은 홈에서 노출되지 않습니다.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-[var(--text-muted)]">상품 검색</label>
              <input
                type="text"
                value={productSearchKeyword}
                onChange={(e) => onChangeSearchKeyword(e.target.value)}
                placeholder="상품명·카테고리·테마로 검색"
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
            {productSearchKeyword.trim() ? (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                {isSearchingProducts ? (
                  <p className="text-xs text-[var(--text-muted)]">검색 중...</p>
                ) : productSearchResults.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="space-y-1">
                    {productSearchResults.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                          {item.title ?? String(item.id)}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">
                          {item.category ?? ""}
                          {item.price != null
                            ? ` · ${new Intl.NumberFormat("ko-KR").format(item.price)}원`
                            : ""}
                          {item.is_active === false ? " · 비활성" : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddProduct(item.id)}
                          disabled={isSaving}
                          className="shrink-0 rounded border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80 disabled:opacity-50"
                        >
                          추가
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div>
              <p className="text-xs font-medium text-[var(--text-primary)]">
                현재 섹션 등록 상품 ({sectionProducts.length}개)
              </p>
              {isLoadingProducts ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">불러오는 중...</p>
              ) : sectionProducts.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">등록된 상품이 없습니다. 위에서 검색 후 추가하세요.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {sectionProducts.map((row, idx) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
                    >
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded bg-[var(--border)]">
                        {row.product?.image_url ? (
                          <img
                            src={row.product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-[var(--text-muted)]">이미지 없음</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {row.product?.title ?? "(상품 정보 없음)"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {row.product?.category ?? ""}
                          {row.product?.price != null
                            ? ` · ${new Intl.NumberFormat("ko-KR").format(row.product.price)}원`
                            : ""}
                          {row.product?.is_active === false ? " · 비활성(홈 미노출)" : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">순서 {row.sort_order}</span>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => onMoveProductUp(row.id)}
                          disabled={isSaving || idx === 0}
                          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--surface)] disabled:opacity-50"
                        >
                          위로
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveProductDown(row.id)}
                          disabled={
                            isSaving || idx === sectionProducts.length - 1
                          }
                          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--surface)] disabled:opacity-50"
                        >
                          아래로
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveProduct(row.id)}
                          disabled={isSaving}
                          className="rounded border border-[var(--danger)]/50 px-1.5 py-0.5 text-[10px] text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                        >
                          제거
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          왼쪽에서 섹션을 선택한 뒤 상품을 검색·추가할 수 있습니다.
        </p>
      )}
    </div>
  );
}
