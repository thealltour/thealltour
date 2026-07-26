"use client";

import { useEffect, useRef } from "react";
import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
  trackKakaoSyncSectionView,
} from "@/lib/analytics/trackKakaoSyncFunnel";

export type KakaoSyncSectionViewTrackerProps = {
  /** 어느 섹션인지 (예: "kakao_sync_benefit", "kakao_sync_products", "kakao_sync_faq") */
  sectionName: string;
};

/**
 * 1px sentinel — 50% 노출 시 landing_section_view를 1회만 발사.
 * 실 DB 조회 없이 스크롤 도달 여부만 기록 (퍼널 드롭오프 파악용).
 */
export function KakaoSyncSectionViewTracker({ sectionName }: KakaoSyncSectionViewTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (sent.current) return;
        if (entries.some((entry) => entry.isIntersecting)) {
          sent.current = true;
          trackKakaoSyncSectionView({
            landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
            sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
            templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
            sectionName,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sectionName]);

  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
