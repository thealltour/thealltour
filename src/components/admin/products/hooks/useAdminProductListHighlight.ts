"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";

const HIGHLIGHT_DURATION_MS = 3000;

export type UseAdminProductListHighlightParams = {
  productIds: string[];
  isLoading: boolean;
  onEnsureFirstPage?: () => void;
};

/**
 * URL ?created= / ?updated= 쿼리로 전달된 상품 id를 목록에서 스크롤·하이라이트한다.
 * 처리 후 쿼리 param은 replaceState로 제거한다.
 */
export function useAdminProductListHighlight({
  productIds,
  isLoading,
  onEnsureFirstPage,
}: UseAdminProductListHighlightParams) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const highlightParamId =
    searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.CREATED)?.trim() ||
    searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.UPDATED)?.trim() ||
    null;

  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const pendingHighlightRef = useRef<string | null>(null);
  const triedPageJumpRef = useRef(false);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (!highlightParamId) {
      pendingHighlightRef.current = null;
      triedPageJumpRef.current = false;
      consumedRef.current = false;
      return;
    }
    pendingHighlightRef.current = highlightParamId;
    triedPageJumpRef.current = false;
    consumedRef.current = false;
  }, [highlightParamId]);

  useEffect(() => {
    const targetId = pendingHighlightRef.current;
    if (!targetId || isLoading || consumedRef.current) return;

    const row = document.getElementById(`admin-product-row-${targetId}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedProductId(targetId);
      consumedRef.current = true;
      pendingHighlightRef.current = null;

      const timer = window.setTimeout(() => setHighlightedProductId(null), HIGHLIGHT_DURATION_MS);

      const params = new URLSearchParams(searchParams.toString());
      params.delete(ADMIN_PRODUCTS_QUERY_KEYS.CREATED);
      params.delete(ADMIN_PRODUCTS_QUERY_KEYS.UPDATED);
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);

      return () => window.clearTimeout(timer);
    }

    if (!triedPageJumpRef.current && !productIds.includes(targetId)) {
      triedPageJumpRef.current = true;
      onEnsureFirstPage?.();
    }
  }, [productIds, isLoading, pathname, searchParams, onEnsureFirstPage]);

  return { highlightedProductId, pendingHighlightId: highlightParamId };
}
