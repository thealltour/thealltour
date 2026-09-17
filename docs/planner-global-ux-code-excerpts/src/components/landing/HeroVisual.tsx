"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { GUIDE_HERO_FALLBACK_IMAGE } from "@/lib/guides/imageUrl";

export type HeroVisualProps = {
  /** 히어로 배경/메인 이미지 URL (backdrop과 main에 동일 사용) */
  imageUrl: string;
  /** decorative 이미지용. 기본 빈 문자열 */
  imageAlt?: string;
  /** main image에만 priority 부여. backdrop에는 미적용 */
  priority?: boolean;
  /** section wrapper에 적용 */
  className?: string;
  /** content 컨테이너에 적용 (max-width, gap 등 사용처별 제어) */
  contentClassName?: string;
  /** min-height 클래스. 미전달 시 기본 상세 랜딩 높이 사용 */
  minHeightClassName?: string;
  children: React.ReactNode;
};

const HERO_MIN_HEIGHT = "min-h-[260px] sm:min-h-[320px] md:min-h-[380px]";

/**
 * 이미지 기반 hero 공통 시각 레이어.
 * backdrop blur + main image + dual overlay + content area.
 * LandingDetailHero 등 이미지 히어로에서 재사용.
 */
export function HeroVisual({
  imageUrl,
  imageAlt = "",
  priority = false,
  className,
  contentClassName,
  minHeightClassName,
  children,
}: HeroVisualProps) {
  const minH = minHeightClassName ?? HERO_MIN_HEIGHT;
  const normalizedInitialUrl = useMemo(() => imageUrl?.trim() || GUIDE_HERO_FALLBACK_IMAGE, [imageUrl]);
  const [resolvedImageUrl, setResolvedImageUrl] = useState(normalizedInitialUrl);

  useEffect(() => {
    // prop이 바뀌면 이전 fallback 상태를 유지하지 않도록 동기화
    setResolvedImageUrl(normalizedInitialUrl);
  }, [normalizedInitialUrl]);

  const handleImageError = () => {
    if (resolvedImageUrl === GUIDE_HERO_FALLBACK_IMAGE) return;
    setResolvedImageUrl(GUIDE_HERO_FALLBACK_IMAGE);
  };

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-[var(--surface-muted)]",
        minH,
        className,
      )}
    >
      {/* Backdrop: decorative, priority 없음 */}
      <div className="absolute inset-0 z-0">
        <Image
          src={resolvedImageUrl}
          alt={imageAlt}
          fill
          sizes="100vw"
          className="scale-[1.12] object-cover object-center blur-[28px] brightness-[0.68] opacity-55"
          onError={handleImageError}
        />
      </div>

      {/* Main image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={resolvedImageUrl}
          alt={imageAlt}
          fill
          priority={priority}
          sizes="100vw"
          className="scale-[1.04] object-cover object-center saturate-[1.06] contrast-[1.03]"
          onError={handleImageError}
        />
      </div>

      {/* Bottom overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/82 via-black/38 to-transparent"
        aria-hidden
      />

      {/* Side overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/55 via-black/26 to-transparent"
        aria-hidden
      />

      {/* Content */}
      <div
        className={cn(
          "relative z-10 flex flex-col justify-end p-6 sm:p-8 md:p-10",
          minH,
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
