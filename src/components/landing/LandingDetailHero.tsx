import { HeroVisual } from "@/components/landing/HeroVisual";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";

export type LandingDetailHeroProps = {
  title: string;
  description?: string;
  imageUrl: string | null;
  className?: string;
};

/**
 * 상세 랜딩용 Hero. HeroVisual 기반으로 제목·설명만 구성.
 */
export function LandingDetailHero({
  title,
  description,
  imageUrl,
  className,
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
        <p className="hero-text-shadow-body mt-2 max-w-2xl type-small text-white/95 sm:type-body">
          {description}
        </p>
      ) : null}
    </HeroVisual>
  );
}
