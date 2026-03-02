"use client";

import { Plane } from "lucide-react";

type AirlineLogoProps = {
  airlineText: string;
  size?: number;
};

/**
 * 항공사 로고 표시 (라이선스 미보유 상태)
 * - 실제 로고 이미지는 사용하지 않고 Plane 아이콘만 노출
 * - 추후 라이선스 확보 시 img 렌더링 로직을 다시 추가
 */
export function AirlineLogo({ airlineText, size = 24 }: AirlineLogoProps) {
  const displayText = airlineText?.trim() || "—";
  const hasValidText = displayText && displayText !== "—";

  if (!hasValidText) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
        style={{ width: size, height: size, minWidth: size }}
      >
        <Plane className="text-slate-500" style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={displayText}
    >
      <Plane className="text-slate-500" style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}
