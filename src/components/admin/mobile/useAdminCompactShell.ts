"use client";

import { useEffect, useState } from "react";
import { TABLET_ADMIN_MAX_WIDTH_PX } from "@/components/admin/mobile/mobileAdmin.constants";
import { isAdminPwaStandalone } from "@/lib/adminPwaClient";

export type UseAdminCompactShellResult = {
  /** 컴팩트(모바일·태블릿) 셸 사용 */
  useCompactShell: boolean;
  /** 가로 모드 */
  isLandscape: boolean;
  /** 클라이언트 미디어쿼리 평가 완료 */
  isReady: boolean;
};

/**
 * PWA standalone 또는 폭 ≤1280 이면 컴팩트 셸.
 * 방향은 orientation 미디어쿼리로 감지.
 */
export function useAdminCompactShell(): UseAdminCompactShellResult {
  const [useCompactShell, setUseCompactShell] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const widthMq = window.matchMedia(`(max-width: ${TABLET_ADMIN_MAX_WIDTH_PX}px)`);
    const landscapeMq = window.matchMedia("(orientation: landscape)");

    function apply() {
      const standalone = isAdminPwaStandalone();
      setUseCompactShell(standalone || widthMq.matches);
      setIsLandscape(landscapeMq.matches);
      setIsReady(true);
    }

    apply();
    widthMq.addEventListener("change", apply);
    landscapeMq.addEventListener("change", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      widthMq.removeEventListener("change", apply);
      landscapeMq.removeEventListener("change", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return { useCompactShell, isLandscape, isReady };
}
