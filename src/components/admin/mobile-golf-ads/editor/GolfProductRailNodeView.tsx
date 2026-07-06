"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Loader2, Trash2 } from "lucide-react";
import { fetchAdminProducts } from "@/components/admin/products/api/adminProducts.client";
import { MAX_GOLF_RAIL_PRODUCTS, type GolfProductRailAttrs } from "@/lib/adminMobileGolfAds/bodyDoc";
import type { Product } from "@/types/product";

export function GolfProductRailNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const attrs = node.attrs as GolfProductRailAttrs;
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHomeDefault = attrs.source === "home_default";
  const productIds = Array.isArray(attrs.productIds) ? attrs.productIds : [];

  const loadSelectedProducts = useCallback(async () => {
    if (isHomeDefault || productIds.length === 0) {
      setSelectedProducts([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/landings/mobile-golf-ads/preview-products?ids=${encodeURIComponent(productIds.join(","))}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { products?: Product[] };
      setSelectedProducts(data.products ?? []);
    } catch {
      setSelectedProducts([]);
    }
  }, [isHomeDefault, productIds]);

  useEffect(() => {
    void loadSelectedProducts();
  }, [loadSelectedProducts]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchLoading(true);
      void fetchAdminProducts({
        page: 1,
        pageSize: 8,
        q: searchQuery,
        is_active: true,
        sortField: "updated_at",
        sortDirection: "desc",
      })
        .then((res) => setSearchResults(res.items ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const addProduct = (product: Product) => {
    if (productIds.includes(product.id)) return;
    if (productIds.length >= MAX_GOLF_RAIL_PRODUCTS) return;
    updateAttributes({
      source: "custom",
      productIds: [...productIds, product.id],
    });
    setSelectedProducts((prev) => [...prev, product]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeProduct = (id: string) => {
    updateAttributes({
      source: "custom",
      productIds: productIds.filter((pid) => pid !== id),
    });
    setSelectedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <NodeViewWrapper className="my-3">
      <div
        className="rounded-xl border-2 border-dashed border-[var(--primary)]/40 bg-[var(--surface-muted)]/60 p-3"
        contentEditable={false}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--primary)]">골프 상품 진열대</p>
            <p className="mt-0.5 text-[0.6875rem] text-[var(--text-muted)]">
              공개 페이지에 홈과 동일한 상품 카드 레일이 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => deleteNode()}
            className="rounded-md border border-[var(--border)] p-1 text-[var(--text-muted)] hover:text-red-600"
            aria-label="진열대 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={attrs.eyebrow}
            onChange={(e) => updateAttributes({ eyebrow: e.target.value })}
            placeholder="Eyebrow"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs"
          />
          <input
            value={attrs.title}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            placeholder="제목"
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs sm:col-span-2"
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isHomeDefault}
            onChange={(e) =>
              updateAttributes({
                source: e.target.checked ? "home_default" : "custom",
                productIds: e.target.checked ? [] : productIds,
              })
            }
            className="h-4 w-4"
          />
          홈 골프투어 추천 설정과 동일하게 표시
        </label>

        {!isHomeDefault ? (
          <div className="mt-3 space-y-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="상품 검색 후 추가"
              className="w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs"
            />
            {searchLoading ? (
              <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" /> 검색 중…
              </div>
            ) : null}
            {searchResults.length > 0 ? (
              <ul className="max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                {searchResults.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      className="w-full px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-muted)]"
                    >
                      {product.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedProducts.length > 0 ? (
              <ul className="space-y-1">
                {selectedProducts.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    <span className="truncate">{product.title}</span>
                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      className="shrink-0 text-[var(--text-muted)] hover:text-red-600"
                    >
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.6875rem] text-[var(--text-muted)]">
                직접 선택한 상품이 없습니다. 검색하여 추가하세요.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
