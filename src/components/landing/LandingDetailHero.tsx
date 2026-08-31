import type { ReactNode } from "react";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";

export type LandingDetailHeroProps = {
  title: string;
  description?: string;
  imageUrl: string | null;
  className?: string;
  /** 히어로 하단 액션(버튼 등). 선택 */
  actions?: ReactNode;
};

/**
 * 상세 랜딩용 Hero. HeroVisual 기반으로 제목·설명만 구성.
 */
export function LandingDetailHero({
  title,
  description,
  imageUrl,
  className,
  actions,
}: LandingDetailHeroProps) {
  const src = imageUrl || LANDING_HERO_FALLBACK_IMAGE;

  return (
    <HeroVisual
      imageUrl={src}
      priority
      className={className}
      contentClassName="max-w-[640px] gap-1.5 sm:gap-2"
      minHeightClassName="min-h-[150px] sm:min-h-[190px] md:min-h-[220px]"
    >
      <h1 className="heading-display font-card-title hero-text-shadow-title text-xl font-semibold text-white sm:text-3xl md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="hero-text-shadow-body mt-1.5 max-w-2xl line-clamp-3 whitespace-pre-line type-small text-white/95 sm:mt-2 sm:line-clamp-none sm:type-body">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-3 sm:mt-6">{actions}</div> : null}
    </HeroVisual>
  );
}
