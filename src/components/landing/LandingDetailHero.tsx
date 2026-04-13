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
      contentClassName="max-w-[640px]"
    >
      <h1 className="heading-display font-card-title hero-text-shadow-title text-2xl font-semibold text-white sm:text-3xl md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="hero-text-shadow-body mt-2 max-w-2xl whitespace-pre-line type-small text-white/95 sm:type-body">
          {description}
        </p>
      ) : null}
      {actions ? <div className="mt-5 sm:mt-6">{actions}</div> : null}
    </HeroVisual>
  );
}
