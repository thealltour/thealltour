"use client";

import { useEffect, useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

type AirlineLogoProps = {
  airlineText: string;
  size?: number;
};

function PlaneFallback({ size, title }: { size: number; title?: string }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={title}
    >
      <Plane className="text-slate-500" style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
    </div>
  );
}

/**
 * 항공편명·항공사 문자열에서 IATA 코드를 추출해 로고를 순차 시도.
 * 모두 실패하면 Plane 아이콘 fallback.
 */
export function AirlineLogo({ airlineText, size = 24 }: AirlineLogoProps) {
  const candidates = useMemo(() => resolveAirlineLogoUrls(airlineText), [airlineText]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [airlineText, candidates]);

  const displayText = airlineText?.trim() || "—";
  const src = candidates[candidateIndex];

  if (!src || candidateIndex >= candidates.length) {
    return <PlaneFallback size={size} title={displayText !== "—" ? displayText : undefined} />;
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={displayText}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain p-0.5"
        onError={() => setCandidateIndex((i) => i + 1)}
      />
    </div>
  );
}
