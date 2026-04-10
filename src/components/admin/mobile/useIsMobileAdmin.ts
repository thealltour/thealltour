"use client";

import { useEffect, useState } from "react";
import { MOBILE_ADMIN_MAX_WIDTH_PX } from "@/components/admin/mobile/mobileAdmin.constants";

export type UseIsMobileAdminResult = {
  /** 뷰포트가 모바일 관리자 기준 이하이면 true (mount 전에는 false) */
  isMobileAdmin: boolean;
  /** 클라이언트에서 미디어쿼리 평가 완료 여부 */
  isReady: boolean;
};

function getMobileAdminMediaQuery(): string {
  return `(max-width: ${MOBILE_ADMIN_MAX_WIDTH_PX}px)`;
}

/**
 * 관리자 UI 분기용. SSR/첫 페인트는 isMobileAdmin=false, isReady=false 로 데스크톱 레이아웃과 맞춤.
 * mount 후 matchMedia로 갱신하여 hydration mismatch를 피함.
 */
export function useIsMobileAdmin(): UseIsMobileAdminResult {
  const [isMobileAdmin, setIsMobileAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(getMobileAdminMediaQuery());

    function apply() {
      setIsMobileAdmin(mq.matches);
      setIsReady(true);
    }

    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return { isMobileAdmin, isReady };
}
