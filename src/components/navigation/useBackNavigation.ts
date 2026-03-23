"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * 브라우저 히스토리가 있으면 뒤로, 없으면 fallback으로 이동.
 * SSR/프리렌더 시 window 미존재 → 안전하게 fallback 처리.
 */
export function useBackNavigation(fallbackHref: string) {
  const router = useRouter();

  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);
}
