"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plane } from "lucide-react";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { buildAirlinePlaceholderDataUri } from "@/lib/airlines/airlinePlaceholderDataUri";
import { resolveAirlineLogoUrls } from "@/lib/airlines/resolveAirlineLogoUrls";

type AirlineLogoProps = {
  airlineText: string;
  size?: number;
};

function LogoSkeleton({ size }: { size: number }) {
  return (
    <div
      className="shrink-0 animate-pulse rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden
    />
  );
}

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

function CodeBadgeFallback({ code, size, title }: { code: string; size: number; title?: string }) {
  const dataUri = buildAirlinePlaceholderDataUri(code);
  if (!dataUri) return <PlaneFallback size={size} title={title} />;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUri} alt="" className="h-full w-full object-contain" />
    </div>
  );
}

function isImageReady(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

/**
 * 항공편명·항공사 문자열에서 IATA 코드를 추출해 로고를 순차 시도.
 * 로드 실패 시 깨진 이미지 대신 다음 후보 또는 코드 배지 fallback.
 */
export function AirlineLogo({ airlineText, size = 24 }: AirlineLogoProps) {
  const candidates = useMemo(
    () => resolveAirlineLogoUrls(airlineText).filter((url) => !url.startsWith("data:")),
    [airlineText],
  );
  const code = useMemo(() => normalizeAirline(airlineText), [airlineText]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCandidateIndex(0);
    setImgLoaded(false);
  }, [airlineText, candidates]);

  const displayText = airlineText?.trim() || "—";
  const src = candidates[candidateIndex];
  const exhausted = !src || candidateIndex >= candidates.length;

  useLayoutEffect(() => {
    if (exhausted) return;
    if (isImageReady(imgRef.current)) {
      setImgLoaded(true);
    }
  }, [src, candidateIndex, exhausted]);

  if (exhausted) {
    if (code) return <CodeBadgeFallback code={code} size={size} title={displayText !== "—" ? displayText : undefined} />;
    return <PlaneFallback size={size} title={displayText !== "—" ? displayText : undefined} />;
  }

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
      style={{ width: size, height: size, minWidth: size }}
      title={displayText}
    >
      {!imgLoaded ? <LogoSkeleton size={size} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        key={src}
        src={src}
        alt=""
        className={`h-full w-full object-contain p-0.5 ${imgLoaded ? "block" : "hidden"}`}
        onLoad={() => setImgLoaded(true)}
        onError={() => {
          setImgLoaded(false);
          setCandidateIndex((i) => i + 1);
        }}
      />
    </div>
  );
}
