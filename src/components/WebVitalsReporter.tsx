"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * Phase 0: Web Vitals 실측용 컴포넌트
 * - 개발: console에 LCP, INP, CLS 등 출력
 * - 프로덕션: sendBeacon으로 API 전송 가능 (선택)
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      const label = metric.rating === "good" ? "✅" : metric.rating === "needs-improvement" ? "⚠️" : "❌";
      console.log(`[Web Vitals] ${label} ${metric.name}:`, metric.value, metric.rating);
    }

    // 프로덕션: /api/analytics/web-vitals 구현 후 활성화
    // if (process.env.NODE_ENV === "production" && typeof window !== "undefined") {
    //   navigator.sendBeacon?.("/api/analytics/web-vitals", JSON.stringify(payload));
    // }
  });

  return null;
}
