"use client";

import { useEffect, useState, useRef } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { Product } from "@/types/product";
import { normalizeImageList } from "@/lib/products/images";
import type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";
import {
  fetchAdminProducts,
  deleteAdminProduct,
  patchAdminProduct,
} from "@/components/admin/products/api/adminProducts.client";
import {
  fetchAdminProductTaxonomy,
} from "@/components/admin/products/api/adminProductTaxonomy.client";
import { DEFAULT_PRODUCTS_PAGE_SIZE, ADMIN_PRODUCTS_MESSAGES } from "@/components/admin/products/adminProducts.constants";

export type { ProductSortKey } from "@/components/admin/products/api/adminProducts.types";

export type UseAdminProductsListControllerParams = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  pageSize?: number;
  /** 상품 삭제 성공 후 호출 (현재 편집 중이던 상품이 삭제된 경우 상위에서 편집 상태 초기화용) */
  onAfterDelete?: (deletedId: string) => void;
};

export function useAdminProductsListController({
  showToast,
  confirm,
  pageSize: pageSizeParam = DEFAULT_PRODUCTS_PAGE_SIZE,
  onAfterDelete,
}: UseAdminProductsListControllerParams) {
  const pageSize = pageSizeParam;
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);
  const [sortField, setSortField] = useState<ProductSortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingMoveId, setPendingMoveId] = useState<string | null>(null);
  const [taxonomyNameMap, setTaxonomyNameMap] = useState<Record<string, string>>({});
  const loadRequestIdRef = useRef(0);

  async function loadProducts(args?: {
    page?: number;
    sortField?: ProductSortKey;
    sortDirection?: "asc" | "desc";
    keywordOverride?: string;
    filterActiveOverride?: "all" | "active" | "inactive";
    filterStatusOverride?: "all" | "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  }) {
    const effectivePage = args?.page ?? page;
    const effectiveSortField = args?.sortField ?? sortField;
    const effectiveSortDirection = args?.sortDirection ?? sortDirection;
    const effectiveKeyword = args?.keywordOverride ?? debouncedKeyword;
    const effectiveActive = args?.filterActiveOverride ?? filterActive;
    const effectiveStatus = args?.filterStatusOverride ?? filterStatus;

    const requestId = ++loadRequestIdRef.current;
    try {
      setErrorMessage("");
      setIsLoading(true);
      const result = await fetchAdminProducts({
        page: effectivePage,
        pageSize: pageSize,
        sortField: effectiveSortField,
        sortDirection: effectiveSortDirection,
        q: effectiveKeyword.trim() !== "" ? effectiveKeyword.trim() : undefined,
        is_active:
          effectiveActive === "all"
            ? undefined
            : effectiveActive === "active"
              ? true
              : false,
        status:
          effectiveStatus === "all" ? undefined : effectiveStatus,
      });
      if (requestId !== loadRequestIdRef.current) return;
      setProducts(
        result.items.map((item) => {
          const images = normalizeImageList(item.images_json);
          return {
            ...item,
            images_json: images,
            image_url: images[0] ?? item.image_url ?? "",
          };
        }),
      );
      setTotalCount(result.total);
    } catch (err) {
      if (requestId !== loadRequestIdRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : ADMIN_PRODUCTS_MESSAGES.LIST_FETCH_ERROR);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    loadProducts({ page: 1 });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [destinations, productLines] = await Promise.all([
          fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
          fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
        ]);
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const t of destinations) {
          if (t.id && t.name) map[t.id] = t.name;
        }
        for (const t of productLines) {
          if (t.id && t.name) map[t.id] = t.name;
        }
        setTaxonomyNameMap(map);
      } catch {
        if (!cancelled) setTaxonomyNameMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
    loadProducts({ page: 1, keywordOverride: debouncedKeyword });
  }, [debouncedKeyword]);

  const isFilterMounted = useRef(false);
  useEffect(() => {
    if (!isFilterMounted.current) {
      isFilterMounted.current = true;
      return;
    }
    setPage(1);
    loadProducts({
      page: 1,
      filterActiveOverride: filterActive,
      filterStatusOverride: filterStatus,
    });
  }, [filterActive, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  function movePage(nextPage: number) {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setPage(clamped);
    loadProducts({ page: clamped });
  }

  function toggleSelectAllForPage() {
    if (products.length === 0) return;
    const pageIds = products.map((product) => product.id);
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
      await loadProducts({ page: 1 });
      setPage(1);
      showToast("success", "선택한 상품을 삭제했습니다.");
    } catch {
      showToast("error", "선택 상품 삭제 중 오류가 발생했습니다.");
    }
  }

  function handleSortChange(field: ProductSortKey, direction?: "asc" | "desc") {
    const nextDirection: "asc" | "desc" =
      direction ?? (sortField === field
        ? sortDirection === "asc"
          ? "desc"
          : "asc"
        : field === "title" || field === "category"
          ? "asc"
          : "desc");
    setSortField(field);
    setSortDirection(nextDirection);
    setPage(1);
    loadProducts({ page: 1, sortField: field, sortDirection: nextDirection });
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
    try {
      await deleteAdminProduct(id);
      showToast("success", "상품이 삭제되었습니다.");
      onAfterDelete?.(id);
      await loadProducts();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "상품 삭제 중 오류가 발생했습니다.");
    }
  }

  async function quickToggleActive(product: Product) {
    setPendingToggleId(product.id);
    setErrorMessage("");
    try {
      await patchAdminProduct(product.id, {
        is_active: !(product.is_active ?? true),
      });
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, is_active: !(item.is_active ?? true) } : item,
        ),
      );
      showToast("success", "상품 활성화 상태를 변경했습니다.");
    } catch (err) {
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
    pendingMoveId,
    filterActive,
    filterStatus,
    setKeyword,
    setFilterActive,
    setFilterStatus,
    loadProducts,
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
