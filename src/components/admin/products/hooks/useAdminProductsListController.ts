"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { Product } from "@/types/product";
import { mapAdminListProductRow } from "@/lib/products/images";
import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";
import {
  fetchAdminProducts,
  deleteAdminProduct,
  patchAdminProduct,
} from "@/components/admin/products/api/adminProducts.client";
import { fetchAdminProductTaxonomy } from "@/components/admin/products/api/adminProductTaxonomy.client";
import {
  ADMIN_PRODUCTS_LIST_PAGE_SIZE_STORAGE_KEY,
  ADMIN_PRODUCTS_PAGE_SIZE_OPTIONS,
  ADMIN_PRODUCTS_MESSAGES,
  DEFAULT_PRODUCTS_PAGE_SIZE,
  normalizeAdminProductsPageSize,
  readStoredAdminProductsPageSize,
  type AdminProductsPageSizeOption,
} from "@/components/admin/products/adminProducts.constants";
import type { AdminProductsTaxonomyOption } from "@/components/admin/products/adminProductsList.types";
import { productHasIssueForFilter, aggregatePageWarningStats } from "@/components/admin/products/adminProductsList.helpers";

export type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";

export type UseAdminProductsListControllerParams = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  onAfterDelete?: (deletedId: string) => void;
};

function flattenTaxonomyOptions(
  items: { id: string; name: string; parent_id?: string | null }[],
): AdminProductsTaxonomyOption[] {
  const out: AdminProductsTaxonomyOption[] = [];
  for (const t of items) {
    if (t.id && t.name?.trim()) out.push({ id: t.id, name: t.name.trim() });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function uniqueSortedStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((s) => s.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ko"),
  );
}

export function useAdminProductsListController({
  showToast,
  confirm,
  onAfterDelete,
}: UseAdminProductsListControllerParams) {
  const [pageSize, setPageSizeState] = useState<AdminProductsPageSizeOption>(DEFAULT_PRODUCTS_PAGE_SIZE);
  const pageSizeRef = useRef<AdminProductsPageSizeOption>(DEFAULT_PRODUCTS_PAGE_SIZE);
  pageSizeRef.current = pageSize;

  useLayoutEffect(() => {
    const stored = readStoredAdminProductsPageSize();
    pageSizeRef.current = stored;
    setPageSizeState(stored);
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  /** `page`가 `loadProducts` 의존성에 들어가면 페이지 전환 시 콜백이 바뀌고, debounce/필터 effect가 `setPage(1)`을 다시 쏴서 다음 페이지로 못 가는 버그가 난다. */
  const pageRef = useRef(page);
  pageRef.current = page;
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);
  const [sortField, setSortField] = useState<ProductSortKey>("updated_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED"
  >("all");
  const [filterDestinationId, setFilterDestinationId] = useState("");
  const [filterProductLineId, setFilterProductLineId] = useState("");
  const [filterThemeQuery, setFilterThemeQuery] = useState("");
  const [filterIssuesOnly, setFilterIssuesOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingMoveId, setPendingMoveId] = useState<string | null>(null);
  const [taxonomyNameMap, setTaxonomyNameMap] = useState<Record<string, string>>({});
  const [destinationOptions, setDestinationOptions] = useState<AdminProductsTaxonomyOption[]>([]);
  const [productLineOptions, setProductLineOptions] = useState<AdminProductsTaxonomyOption[]>([]);
  const [themeNameOptions, setThemeNameOptions] = useState<string[]>([]);
  const loadRequestIdRef = useRef(0);

  const isSearchPending = keyword.trim() !== debouncedKeyword.trim();

  const displayProducts = useMemo(() => {
    if (!filterIssuesOnly) return products;
    return products.filter(productHasIssueForFilter);
  }, [products, filterIssuesOnly]);

  const pageActiveCount = useMemo(
    () => products.filter((p) => p.is_active !== false).length,
    [products],
  );

  const pageWarningStats = useMemo(() => aggregatePageWarningStats(products), [products]);

  const loadProducts = useCallback(
    async (args?: {
      page?: number;
      sortField?: ProductSortKey;
      sortDirection?: "asc" | "desc";
      keywordOverride?: string;
      filterActiveOverride?: "all" | "active" | "inactive";
      filterStatusOverride?: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
      destinationIdOverride?: string;
      productLineIdOverride?: string;
      themeQOverride?: string;
    }) => {
      const effectivePage = args?.page ?? pageRef.current;
      const effectiveSortField = args?.sortField ?? sortField;
      const effectiveSortDirection = args?.sortDirection ?? sortDirection;
      const effectiveKeyword = args?.keywordOverride ?? debouncedKeyword;
      const effectiveActive = args?.filterActiveOverride ?? filterActive;
      const effectiveStatus = args?.filterStatusOverride ?? filterStatus;
      const effectiveDest =
        (args?.destinationIdOverride !== undefined ? args.destinationIdOverride : filterDestinationId).trim() ||
        undefined;
      const effectiveLine =
        (args?.productLineIdOverride !== undefined ? args.productLineIdOverride : filterProductLineId).trim() ||
        undefined;
      const effectiveThemeQ =
        (args?.themeQOverride !== undefined ? args.themeQOverride : filterThemeQuery).trim() || undefined;

      const requestId = ++loadRequestIdRef.current;
      try {
        setErrorMessage("");
        setIsLoading(true);
        const result = await fetchAdminProducts({
          page: effectivePage,
          pageSize: pageSizeRef.current,
          sortField: effectiveSortField,
          sortDirection: effectiveSortDirection,
          q: effectiveKeyword.trim() !== "" ? effectiveKeyword.trim() : undefined,
          is_active:
            effectiveActive === "all" ? undefined : effectiveActive === "active" ? true : false,
          status: effectiveStatus === "all" ? undefined : effectiveStatus,
          destination_id: effectiveDest,
          product_line_id: effectiveLine,
          theme_q: effectiveThemeQ,
        });
        if (requestId !== loadRequestIdRef.current) return;
        setProducts(result.items.map((item) => mapAdminListProductRow(item) as Product));
        setTotalCount(result.total);
      } catch (err) {
        if (requestId !== loadRequestIdRef.current) return;
        setErrorMessage(err instanceof Error ? err.message : ADMIN_PRODUCTS_MESSAGES.LIST_FETCH_ERROR);
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      sortField,
      sortDirection,
      debouncedKeyword,
      filterActive,
      filterStatus,
      filterDestinationId,
      filterProductLineId,
      filterThemeQuery,
    ],
  );

  const setPageSize = useCallback(
    (next: number) => {
      const n = normalizeAdminProductsPageSize(next);
      if (n === pageSizeRef.current) return;
      pageSizeRef.current = n;
      setPageSizeState(n);
      try {
        window.sessionStorage.setItem(ADMIN_PRODUCTS_LIST_PAGE_SIZE_STORAGE_KEY, String(n));
      } catch {
        /* ignore */
      }
      setPage(1);
      pageRef.current = 1;
      void loadProducts({ page: 1 });
    },
    [loadProducts],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [destinations, productLines, themes] = await Promise.all([
          fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
          fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
          fetchAdminProductTaxonomy({ taxonomy_type: "theme" }),
        ]);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const t of destinations) {
          if (t.id && t.name) map[t.id] = t.name;
        }
        for (const t of productLines) {
          if (t.id && t.name) map[t.id] = t.name;
        }
        for (const t of themes) {
          if (t.id && t.name) map[t.id] = t.name;
        }
        setTaxonomyNameMap(map);
        setDestinationOptions(flattenTaxonomyOptions(destinations));
        setProductLineOptions(flattenTaxonomyOptions(productLines));
        setThemeNameOptions(uniqueSortedStrings(themes.map((t) => t.name).filter(Boolean) as string[]));
      } catch {
        if (!cancelled) {
          setTaxonomyNameMap({});
          setDestinationOptions([]);
          setProductLineOptions([]);
          setThemeNameOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
    void loadProducts({ page: 1, keywordOverride: debouncedKeyword });
  }, [debouncedKeyword, loadProducts]);

  const isFilterMounted = useRef(false);
  useEffect(() => {
    if (!isFilterMounted.current) {
      isFilterMounted.current = true;
      return;
    }
    setPage(1);
    void loadProducts({ page: 1, filterActiveOverride: filterActive, filterStatusOverride: filterStatus });
  }, [filterActive, filterStatus, loadProducts]);

  const auxFilterMounted = useRef(false);
  useEffect(() => {
    if (!auxFilterMounted.current) {
      auxFilterMounted.current = true;
      return;
    }
    setPage(1);
    void loadProducts({ page: 1 });
  }, [filterDestinationId, filterProductLineId, filterThemeQuery, loadProducts]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  function movePage(nextPage: number) {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setPage(clamped);
    void loadProducts({ page: clamped });
  }

  function toggleSelectAllForPage() {
    if (displayProducts.length === 0) return;
    const pageIds = displayProducts.map((product) => product.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }

  async function handleBulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: "선택 상품 삭제",
      description: `선택된 ${selectedIds.length}개 상품을 삭제합니다. 계속 진행할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setErrorMessage("");
    try {
      const ids = [...selectedIds];
      setSelectedIds([]);
      await Promise.allSettled(
        ids.map(async (id) => {
          try {
            await deleteAdminProduct(id);
          } catch (err) {
            showToast("error", err instanceof Error ? err.message : "일부 상품 삭제에 실패했습니다.");
          }
        }),
      );
      setPage(1);
      await loadProducts({ page: 1 });
      showToast("success", "선택한 상품을 삭제했습니다.");
    } catch {
      showToast("error", "선택 상품 삭제 중 오류가 발생했습니다.");
    }
  }

  function handleSortChange(field: ProductSortKey, direction?: "asc" | "desc") {
    const nextDirection: "asc" | "desc" =
      direction ??
      (sortField === field
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : field === "title" || field === "category"
          ? "asc"
          : "desc");
    setSortField(field);
    setSortDirection(nextDirection);
    setPage(1);
    void loadProducts({ page: 1, sortField: field, sortDirection: nextDirection });
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "상품 삭제",
      description: "이 상품을 삭제하면 되돌릴 수 없습니다. 계속 진행할까요?",
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;

    setErrorMessage("");
    setPendingDeleteId(id);
    try {
      await deleteAdminProduct(id);
      showToast("success", "상품이 삭제되었습니다.");
      onAfterDelete?.(id);
      await loadProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "상품 삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function quickToggleActive(product: Product) {
    const prev = product.is_active ?? true;
    const next = !prev;
    setPendingToggleId(product.id);
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, is_active: next } : item)),
    );
    try {
      await patchAdminProduct(product.id, { is_active: next });
      showToast("success", "상품 활성화 상태를 변경했습니다.");
    } catch (err) {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, is_active: prev } : item)),
      );
      showToast("error", err instanceof Error ? err.message : "활성화 상태 변경에 실패했습니다.");
    } finally {
      setPendingToggleId(null);
    }
  }

  async function moveSortOrder(product: Product, direction: "up" | "down") {
    const sameBucket = products;
    const currentIndex = sameBucket.findIndex((item) => item.id === product.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sameBucket.length) return;

    const target = sameBucket[targetIndex];
    const currentOrder = typeof product.sort_order === "number" ? product.sort_order : currentIndex + 1;
    const targetOrder = typeof target.sort_order === "number" ? target.sort_order : targetIndex + 1;

    setPendingMoveId(product.id);
    try {
      await patchAdminProduct(product.id, { sort_order: targetOrder });
      await patchAdminProduct(target.id, { sort_order: currentOrder });
      showToast("success", "노출순서를 변경했습니다.");
      await loadProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "노출순서 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingMoveId(null);
    }
  }

  return {
    products,
    displayProducts,
    pageActiveCount,
    pageWarningStats,
    taxonomyNameMap,
    totalCount,
    currentPage: safePage,
    pageSize,
    totalPages,
    sortField,
    sortDirection,
    keyword,
    isLoading,
    errorMessage,
    selectedIds,
    pendingToggleId,
    pendingDeleteId,
    pendingMoveId,
    filterActive,
    filterStatus,
    filterDestinationId,
    filterProductLineId,
    filterThemeQuery,
    filterIssuesOnly,
    destinationOptions,
    productLineOptions,
    themeNameOptions,
    isSearchPending,
    setKeyword,
    setFilterActive,
    setFilterStatus,
    setFilterDestinationId,
    setFilterProductLineId,
    setFilterThemeQuery,
    setFilterIssuesOnly,
    loadProducts,
    setPageSize,
    pageSizeOptions: ADMIN_PRODUCTS_PAGE_SIZE_OPTIONS,
    movePage,
    toggleSelectAllForPage,
    toggleSelectOne,
    setSelectedIds,
    handleBulkDeleteSelected,
    handleSortChange,
    handleDelete,
    quickToggleActive,
    moveSortOrder,
  };
}
