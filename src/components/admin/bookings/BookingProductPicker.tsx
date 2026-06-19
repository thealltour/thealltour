"use client";

import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { fetchAdminProducts } from "@/components/admin/products/api/adminProducts.client";
import type { Product } from "@/types/product";

export type SelectedBookingProduct = {
  product_id: string | null;
  product_title: string;
  catalog_price?: number | null;
  quoted_total?: number | null;
  source?: string;
  is_active?: boolean | null;
};

export type RecommendedProductItem = {
  product_id: string | null;
  product_title: string;
  source: "inquiry" | "booking" | "catalog_match";
  source_id: string | null;
  source_label: string;
  quoted_total: number | null;
  catalog_price: number | null;
  is_active: boolean | null;
  reason: string;
};

export type CustomerContextHints = {
  payment_total_amount: number | null;
  departure_date: string | null;
};

type Props = {
  value: SelectedBookingProduct | null;
  onChange: (product: SelectedBookingProduct | null) => void;
  customerProfileId?: string | null;
  memberId?: string | null;
  /** 문의 위저드 등: API 없이 초기 추천 seed */
  seedRecommendations?: RecommendedProductItem[];
  seedHints?: CustomerContextHints;
  disabled?: boolean;
};

export function BookingProductPicker({
  value,
  onChange,
  customerProfileId,
  memberId,
  seedRecommendations,
  seedHints,
  disabled,
}: Props) {
  const [recommendations, setRecommendations] = useState<RecommendedProductItem[]>(seedRecommendations ?? []);
  const [hints, setHints] = useState<CustomerContextHints | null>(seedHints ?? null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const debouncedCatalogQuery = useDebounce(catalogQuery, 300);
  const [catalogResults, setCatalogResults] = useState<Product[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);

  useEffect(() => {
    if (seedRecommendations) {
      setRecommendations(seedRecommendations);
      setHints(seedHints ?? null);
      return;
    }

    const profileId = customerProfileId?.trim();
    if (!profileId || value) {
      if (!profileId) {
        setRecommendations([]);
        setHints(null);
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoadingContext(true);
      try {
        const params = new URLSearchParams({ customer_profile_id: profileId });
        if (memberId) params.set("member_id", memberId);
        const res = await fetch(`/api/admin/bookings/customer-context?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setRecommendations(data.recommended_products ?? []);
        setHints(data.hints ?? null);
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerProfileId, memberId, seedRecommendations, seedHints, value]);

  useEffect(() => {
    const q = debouncedCatalogQuery.trim();
    if (!q || value) {
      setCatalogResults([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      setSearchingCatalog(true);
      try {
        const result = await fetchAdminProducts({
          page: 1,
          pageSize: 10,
          sortField: "created_at",
          sortDirection: "desc",
          q,
          is_active: true,
        });
        if (!cancelled) setCatalogResults(result.items);
      } catch {
        if (!cancelled) setCatalogResults([]);
      } finally {
        if (!cancelled) setSearchingCatalog(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedCatalogQuery, value]);

  const selectRecommendation = useCallback(
    (item: RecommendedProductItem) => {
      onChange({
        product_id: item.product_id,
        product_title: item.product_title,
        catalog_price: item.catalog_price,
        quoted_total: item.quoted_total,
        source: item.reason,
        is_active: item.is_active,
      });
      setCatalogQuery("");
      setCatalogResults([]);
    },
    [onChange],
  );

  const selectCatalogProduct = useCallback(
    (item: Product) => {
      onChange({
        product_id: String(item.id),
        product_title: String(item.title ?? item.id),
        catalog_price: typeof item.price === "number" ? item.price : null,
        source: "카탈로그 검색",
        is_active: item.is_active !== false,
      });
      setCatalogQuery("");
      setCatalogResults([]);
    },
    [onChange],
  );

  const clearSelection = () => {
    onChange(null);
    setCatalogQuery("");
    setCatalogResults([]);
  };

  const formatPrice = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? `${n.toLocaleString()}원` : null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">상품 선택</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          고객 이력 기반 추천 또는 카탈로그에서 검색해 선택합니다.
        </p>
      </div>

      {value ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
          <p className="font-medium text-[var(--text-primary)]">{value.product_title}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {value.product_id ? `ID: ${value.product_id}` : "카탈로그 미연결"}
            {formatPrice(value.catalog_price ?? value.quoted_total)
              ? ` · ${formatPrice(value.catalog_price ?? value.quoted_total)}`
              : ""}
            {value.is_active === false ? " · 비활성 상품" : ""}
          </p>
          {value.source ? <p className="mt-1 text-xs text-[var(--text-subtle)]">{value.source}</p> : null}
          {!disabled ? (
            <button type="button" onClick={clearSelection} className="mt-2 text-xs text-[var(--primary)] hover:underline">
              다른 상품 선택
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {loadingContext ? (
            <p className="text-xs text-[var(--text-muted)]">추천 상품 불러오는 중…</p>
          ) : recommendations.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)]">추천 상품</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
                {recommendations.map((item) => (
                  <li key={`${item.source}-${item.source_id ?? item.product_title}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => selectRecommendation(item)}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">{item.product_title}</span>
                        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                          {item.reason}
                        </span>
                        {item.is_active === false ? (
                          <span className="text-[10px] text-[var(--danger)]">비활성</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{item.source_label}</p>
                      {formatPrice(item.quoted_total ?? item.catalog_price) ? (
                        <p className="text-xs text-[var(--text-secondary)]">
                          {item.quoted_total ? "견적" : "판매가"}: {formatPrice(item.quoted_total ?? item.catalog_price)}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : customerProfileId || seedRecommendations?.length ? (
            <p className="text-xs text-[var(--text-muted)]">추천할 상품 이력이 없습니다. 아래에서 검색해 주세요.</p>
          ) : null}

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)]">카탈로그 검색</label>
            <input
              type="text"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="상품명·카테고리·테마로 검색"
              disabled={disabled}
              className="input-base mt-1 w-full bg-[var(--surface)]"
            />
          </div>

          {catalogQuery.trim() ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
              {searchingCatalog ? (
                <p className="px-2 py-2 text-xs text-[var(--text-muted)]">검색 중…</p>
              ) : catalogResults.length === 0 ? (
                <p className="px-2 py-2 text-xs text-[var(--text-muted)]">검색 결과가 없습니다.</p>
              ) : (
                <ul className="space-y-1">
                  {catalogResults.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => selectCatalogProduct(item)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-muted)] disabled:opacity-50"
                      >
                        <span className="min-w-0 truncate font-medium">{item.title ?? item.id}</span>
                        <span className="shrink-0 text-xs text-[var(--text-muted)]">
                          {item.category ?? ""}
                          {item.price != null ? ` · ${item.price.toLocaleString()}원` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      )}

      {!value && hints && (hints.payment_total_amount != null || hints.departure_date) ? (
        <p className="text-xs text-[var(--text-subtle)]">
          {hints.departure_date ? `희망 출발일 힌트: ${hints.departure_date}` : ""}
          {hints.payment_total_amount != null
            ? `${hints.departure_date ? " · " : ""}견적 금액 힌트: ${hints.payment_total_amount.toLocaleString()}원`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

export type { CustomerContextHints as BookingProductContextHints };
