"use client";

import { useEffect, useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { getAirlineLogoCandidates } from "@/lib/airlines/getAirlineLogoCandidates";

type AirlineLogoProps = {
  airlineText: string;
  size?: number;
};

const isDev = process.env.NODE_ENV === "development";

/**
 * 항공사 로고 표시
 * - normalizeAirline로 code 추출 → AIRLINE_LOGO_BY_CODE[code] (1순위, 로컬 자산)
 * - 로컬 매핑 없으면 code 기반 외부 로고 URL 후보들로 자동 시도
 * - 모든 후보 실패 시 Plane 아이콘 + 텍스트 fallback
 */
export function AirlineLogo({ airlineText, size = 24 }: AirlineLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);

  const code = normalizeAirline(airlineText);
  const localLogoPath = code ? AIRLINE_LOGO_BY_CODE[code] : null;

  const candidates = useMemo(() => {
    if (!code) return [];
    const urls: string[] = [];
    if (localLogoPath) {
      urls.push(localLogoPath);
    }
    urls.push(...getAirlineLogoCandidates(code));
    return urls;
  }, [code, localLogoPath]);

  const activeLogoUrl = candidates[logoIndex] ?? null;

  const displayText = airlineText?.trim() || "—";
  const hasValidText = displayText && displayText !== "—";
  const altLabel = code || displayText;

  useEffect(() => {
    // 입력이 바뀌면 로고 시도 상태 초기화
    setImgError(false);
    setLogoIndex(0);
  }, [airlineText, code]);

  useEffect(() => {
    if (!isDev || !hasValidText) return;
    if (!code) {
      console.log("[AirlineLogo] code not resolved", { airlineText });
      return;
    }
    if (!localLogoPath) {
      console.log("[AirlineLogo] local logo missing, using external candidates", {
        airlineText,
        code,
        candidates,
      });
    }
  }, [airlineText, candidates, code, hasValidText, localLogoPath]);

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

  if (activeLogoUrl && !imgError) {
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        style={{ width: size, height: size, minWidth: size }}
      >
        <img
          src={activeLogoUrl}
          alt={`${altLabel} logo`}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1"
          onError={() => {
            if (logoIndex < candidates.length - 1) {
              setLogoIndex(logoIndex + 1);
            } else {
              setImgError(true);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={displayText}
    >
      <Plane className="text-slate-500" style={{ width: size * 0.5, height: size * 0.5 }} />
      <span
        className="truncate text-[10px] font-medium leading-none text-slate-600"
        style={{ maxWidth: size }}
      >
        {displayText.length > 6 ? `${displayText.slice(0, 6)}…` : displayText}
      </span>
    </div>
  );
}
