"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import type { Product } from "@/types/product";
import { fetchAdminProductTaxonomy } from "@/components/admin/products/api/adminProductTaxonomy.client";
import { fetchAdminProducts, fetchAdminProduct } from "@/components/admin/products/api/adminProducts.client";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { parseHomeGolfTourProductIds } from "@/lib/siteSettings";
import type { SiteSettings } from "@/lib/siteSettings";
import { isGolfProductLineTaxonomy } from "@/lib/products/golfChannel";
import { cn } from "@/lib/cn";

const MAX_HOME_GOLF_PRODUCTS = 20;

const DEFAULT_GOLF_EYEBROW = "GOLF TOURS";
const DEFAULT_GOLF_TITLE = "추천 골프투어";
const DEFAULT_GOLF_DESCRIPTION = "인기 골프·파크골프 여행을 만나보세요.";

type ListedProduct = {
  id: string;
  product: Product | null;
};

/**
 * 메인 골프투어 상품 관리.
 * site_settings.home_golf_tour_product_ids (JSON 배열)에 상품 id 목록 저장.
 */
export default function AdminHomeGolfTourCardsManager() {
  const [golfLineIds, setGolfLineIds] = useState<Set<string>>(new Set());
  const [orderedItems, setOrderedItems] = useState<ListedProduct[]>([]);
  const [sectionEyebrow, setSectionEyebrow] = useState(DEFAULT_GOLF_EYEBROW);
  const [sectionTitle, setSectionTitle] = useState(DEFAULT_GOLF_TITLE);
  const [sectionDescription, setSectionDescription] = useState(DEFAULT_GOLF_DESCRIPTION);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const productSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();

  const orderedIds = orderedItems.map((item) => item.id);
  const selectedSet = new Set(orderedIds);
  const canAdd = orderedIds.length < MAX_HOME_GOLF_PRODUCTS;

  const isGolfProduct = useCallback(
    (product: Product) => {
      const lineId = product.product_line_id?.trim();
      return Boolean(lineId && golfLineIds.has(lineId));
    },
    [golfLineIds],
  );

  const loadProductsByIds = useCallback(async (ids: string[]) => {
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const product = await fetchAdminProduct(id);
          return { id, product };
        } catch {
          return { id, product: null };
        }
      }),
    );
    setOrderedItems(rows);
  }, []);

  const loadData = useCallback(async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      const [lineList, settingsRes] = await Promise.all([
        fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
        fetch("/api/admin/site-settings", { cache: "no-store" }),
      ]);

      const golfLines = (lineList ?? []).filter(
        (line) => line.is_active && isGolfProductLineTaxonomy(line),
      );
      setGolfLineIds(new Set(golfLines.map((line) => line.id)));

      const settingsData = (await settingsRes.json()) as Record<string, string> | { message?: string };
      if (settingsRes.ok && settingsData && !("message" in settingsData)) {
        const raw = settingsData as Record<string, string>;
        const settings = {
          home_golf_tour_product_ids: raw.home_golf_tour_product_ids ?? "[]",
          home_golf_tour_section_eyebrow: raw.home_golf_tour_section_eyebrow ?? "",
          home_golf_tour_section_title: raw.home_golf_tour_section_title ?? "",
          home_golf_tour_section_description: raw.home_golf_tour_section_description ?? "",
        } as Pick<
          SiteSettings,
          | "home_golf_tour_product_ids"
          | "home_golf_tour_section_eyebrow"
          | "home_golf_tour_section_title"
          | "home_golf_tour_section_description"
        >;
        const ids = parseHomeGolfTourProductIds(settings);
        setSectionEyebrow(settings.home_golf_tour_section_eyebrow ?? "");
        setSectionTitle(settings.home_golf_tour_section_title ?? "");
        setSectionDescription(settings.home_golf_tour_section_description ?? "");
        await loadProductsByIds(ids);
      } else {
        setOrderedItems([]);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.");
      setOrderedItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadProductsByIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setProductSearchResults([]);
      return;
    }
    if (productSearchDebounceRef.current) {
      clearTimeout(productSearchDebounceRef.current);
    }
    productSearchDebounceRef.current = setTimeout(() => {
      productSearchDebounceRef.current = null;
      setProductSearchLoading(true);
      fetchAdminProducts({
        page: 1,
        pageSize: 20,
        sortField: "sort_order",
        sortDirection: "asc",
        q: productSearchQuery.trim(),
      })
        .then((data) => {
          const items = Array.isArray(data.items) ? data.items : [];
          setProductSearchResults(items.filter((item) => isGolfProduct(item)));
        })
        .catch(() => setProductSearchResults([]))
        .finally(() => setProductSearchLoading(false));
    }, 300);
    return () => {
      if (productSearchDebounceRef.current) clearTimeout(productSearchDebounceRef.current);
    };
  }, [productSearchQuery, isGolfProduct]);

  const move = (index: number, dir: "up" | "down") => {
    const next = [...orderedItems];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedItems(next);
  };

  const remove = (index: number) => {
    setOrderedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addProduct = (product: Product) => {
    if (!canAdd || selectedSet.has(product.id) || !isGolfProduct(product)) return;
    setOrderedItems((prev) => [...prev, { id: product.id, product }]);
    setProductSearchQuery("");
    setProductSearchResults([]);
  };

  const save = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_golf_tour_product_ids: JSON.stringify(orderedIds),
          home_golf_tour_section_eyebrow: sectionEyebrow.trim(),
          home_golf_tour_section_title: sectionTitle.trim(),
          home_golf_tour_section_description: sectionDescription.trim(),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data?.message ?? "저장에 실패했습니다.");
      }
      showToast("success", "메인 골프투어 상품이 저장되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      setErrorMessage(msg);
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>골프투어 상품 목록을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          메인 홈 골프투어 상품 (최대 {MAX_HOME_GOLF_PRODUCTS}개)
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          메인 페이지 「추천 골프투어」 섹션에 노출할 골프·파크골프 상품을 검색해 추가하고 순서를 조정할 수 있습니다.
          메인 추천상품과 동일한 상품 카드 UI로 표시되며, 지역·테마 카드보다 위에 노출됩니다.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">메인 홈 골프투어 섹션 문구</h3>
        <p className="text-xs text-[var(--text-muted)]">
          메인 페이지 골프투어 섹션 상단에 보이는 텍스트입니다. 비우면 해당 항목은 메인에서 표시되지 않습니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-1">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">상단 라벨 (예: GOLF TOURS)</span>
            <input
              type="text"
              value={sectionEyebrow}
              onChange={(e) => setSectionEyebrow(e.target.value)}
              placeholder={DEFAULT_GOLF_EYEBROW}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              aria-label="골프투어 섹션 상단 라벨"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">제목</span>
            <input
              type="text"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder={DEFAULT_GOLF_TITLE}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              aria-label="골프투어 섹션 제목"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">부제목</span>
            <input
              type="text"
              value={sectionDescription}
              onChange={(e) => setSectionDescription(e.target.value)}
              placeholder={DEFAULT_GOLF_DESCRIPTION}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              aria-label="골프투어 섹션 부제목"
            />
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">골프 상품 추가</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          골프·파크골프 상품군에 속한 상품만 검색·추가할 수 있습니다. ({orderedIds.length}/{MAX_HOME_GOLF_PRODUCTS})
        </p>
        <div className="mt-3">
          <input
            type="text"
            value={productSearchQuery}
            onChange={(e) => setProductSearchQuery(e.target.value)}
            placeholder="골프·파크골프 상품명으로 검색"
            disabled={!canAdd}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
            aria-label="골프 상품 검색"
          />
        </div>
        {productSearchQuery.trim() ? (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
            {productSearchLoading ? (
              <p className="text-xs text-[var(--text-muted)]">검색 중...</p>
            ) : productSearchResults.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">골프 상품 검색 결과가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {productSearchResults.map((item) => {
                  const alreadyAdded = selectedSet.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">
                        {item.title ?? item.id}
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
                        onClick={() => addProduct(item)}
                        disabled={isSaving || alreadyAdded || !canAdd}
                        className="shrink-0 rounded border border-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80 disabled:opacity-50"
                      >
                        {alreadyAdded ? "추가됨" : "추가"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">메인에 노출할 골프투어 상품</h3>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {orderedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">아직 선택된 상품이 없습니다.</p>
              <p className="text-xs text-[var(--text-muted)]">위에서 골프 상품을 검색해 추가하세요.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {orderedItems.map((item, index) => {
                const product = item.product;
                const imageUrl = product?.image_url?.trim() || "";
                const title = product?.title?.trim() || "(상품 정보 없음)";
                return (
                  <li key={item.id} className="flex items-center gap-4 p-4">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(index, "up")}
                        disabled={index === 0}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
                        aria-label="위로"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, "down")}
                        disabled={index === orderedItems.length - 1}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
                        aria-label="아래로"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                    <span className="w-8 shrink-0 text-sm font-medium text-[var(--text-muted)]">
                      {index + 1}
                    </span>
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="96px"
                          unoptimized={imageUrl.startsWith("data:")}
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[10px] text-[var(--text-muted)]">
                          이미지 없음
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{title}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {product?.category ?? ""}
                        {product?.price != null
                          ? ` · ${new Intl.NumberFormat("ko-KR").format(product.price)}원`
                          : ""}
                        {product?.is_active === false ? " · 비활성(홈 미노출)" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      aria-label="메인 노출에서 제거"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
            "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 disabled:opacity-50",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            "저장"
          )}
        </button>
        <p className="text-sm text-[var(--text-muted)]">
          저장 후 메인 페이지에 반영됩니다. 비활성 상품은 홈에서 노출되지 않습니다.
        </p>
      </div>
    </div>
  );
}
