import Link from "next/link";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { cn } from "@/lib/cn";

export type LandingHeroProps = {
  title: string;
  description?: string;
  /** primary CTA. 없으면 버튼 미노출 */
  ctaLabel?: string;
  ctaHref?: string;
  /** secondary CTA (이미지형 모드에서만 사용) */
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  /** 이미지형 허브 히어로용. 전달 시 HeroVisual 기반으로 렌더 */
  imageUrl?: string | null;
  /** 이미지형 모드에서 eyebrow 문구 (선택) */
  eyebrow?: string;
  /** 이미지형 모드에서 main image priority. 기본 true */
  imagePriority?: boolean;
  className?: string;
};

/** 허브 랜딩용 min-height: 상세 랜딩보다 약간 낮게 */
const HUB_HERO_MIN_HEIGHT = "min-h-[240px] sm:min-h-[300px] md:min-h-[340px]";

/**
 * 허브 랜딩 상단 Hero.
 * - imageUrl 없음: SectionHeader 기반 텍스트형 (기존 동작)
 * - imageUrl 있음: HeroVisual 기반 이미지형 허브 히어로
 */
export function LandingHero({
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  imageUrl,
  eyebrow,
  imagePriority = true,
  className,
}: LandingHeroProps) {
  const hasImage = imageUrl?.trim();

  if (hasImage) {
    return (
      <HeroVisual
        imageUrl={imageUrl!.trim()}
        priority={imagePriority}
        className={className}
        contentClassName="max-w-[640px] gap-2"
        minHeightClassName={HUB_HERO_MIN_HEIGHT}
      >
        {eyebrow ? (
          <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{eyebrow}</p>
        ) : null}
        <h1 className="hero-text-shadow-title text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {ctaLabel?.trim() && ctaHref?.trim() ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {ctaLabel}
            </Link>
          ) : null}
          {secondaryCtaLabel?.trim() && secondaryCtaHref?.trim() ? (
            <Link
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              {secondaryCtaLabel}
            </Link>
          ) : null}
        </div>
      </HeroVisual>
    );
  }

  const hasCta = ctaLabel?.trim() && ctaHref?.trim();
  return (
    <section className={cn("space-y-6", className)}>
      <SectionHeader
        title={title}
        description={description}
        align="left"
        action={
          hasCta ? (
            <Link
              href={ctaHref!}
              className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {ctaLabel}
            </Link>
          ) : undefined
        }
      />
    </section>
  );
}
