import Link from "next/link";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { LandingConsultCtaButton } from "@/components/landing/LandingConsultCtaButton";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PlannerEntryCard } from "@/components/planner/PlannerEntryCard";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";

export type LandingHeroProps = {
  plannerEntry?: { source: "destinations_hero" | "themes_hero" };
  title: string;
  description?: string;
  /** primary CTA. 없으면 버튼 미노출 */
  ctaLabel?: string;
  ctaHref?: string;
  /** secondary CTA (이미지형·editorial 모드에서 사용) */
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  /** 이미지형 허브 히어로용. editorial 모드에서는 무시 */
  imageUrl?: string | null;
  /** 이미지형·editorial 모드에서 eyebrow 문구 (선택) */
  eyebrow?: string;
  /** 이미지형 모드에서 main image priority. 기본 true */
  imagePriority?: boolean;
  /**
   * - image: HeroVisual 기반 (imageUrl 필요). 기본 동작.
   * - editorial: 사진 없는 clean hub surface (destinations/themes).
   */
  variant?: "image" | "editorial";
  className?: string;
};

/** 허브 랜딩용 min-height: 상세 랜딩보다 약간 낮게 (이미지형만) */
const HUB_HERO_MIN_HEIGHT = "min-h-[160px] sm:min-h-[280px] md:min-h-[340px]";

function HubPlannerCards({
  source,
}: {
  source: "destinations_hero" | "themes_hero";
}) {
  return (
    <>
      <PlannerEntryCard source={source} variant="compact" className="lg:hidden" />
      <PlannerEntryCard source={source} variant="card" className="hidden lg:flex" />
    </>
  );
}

function HubHeroCtas({
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  appearance,
}: {
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  appearance: "on-media" | "editorial";
}) {
  const primaryClass =
    appearance === "editorial"
      ? buttonVariants({ variant: "primary" })
      : "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:px-5 sm:py-2.5";

  const secondaryClass =
    appearance === "editorial"
      ? buttonVariants({ variant: "outline" })
      : "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:px-5 sm:py-2.5";

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2.5",
        appearance === "editorial" ? "mt-4 sm:mt-5 sm:gap-3" : "mt-3 sm:mt-5 sm:gap-3",
      )}
    >
      {ctaLabel?.trim() && ctaHref?.trim() ? (
        <Link href={ctaHref} className={primaryClass}>
          {ctaLabel}
        </Link>
      ) : null}
      {secondaryCtaLabel?.trim() && secondaryCtaHref?.trim() ? (
        secondaryCtaHref === "/quote" ? (
          <LandingConsultCtaButton label={secondaryCtaLabel} className={secondaryClass} />
        ) : (
          <Link href={secondaryCtaHref} className={secondaryClass}>
            {secondaryCtaLabel}
          </Link>
        )
      ) : null}
    </div>
  );
}

/**
 * 허브 랜딩 상단 Hero.
 * - variant=editorial: 사진 없는 clean surface (destinations/themes)
 * - imageUrl 있음: HeroVisual 기반 이미지형 허브 히어로
 * - 그 외: SectionHeader 기반 텍스트형
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
  variant = "image",
  className,
  plannerEntry,
}: LandingHeroProps) {
  const showPlanner = ENABLE_FREE_TRAVEL_PLANNER && Boolean(plannerEntry);
  const isEditorial = variant === "editorial";
  const hasImage = !isEditorial && Boolean(imageUrl?.trim());

  if (isEditorial) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 shadow-[var(--shadow-soft)] sm:p-6 lg:p-8",
          className,
        )}
      >
        <div
          className={cn(
            "grid min-w-0 gap-4 sm:gap-5",
            showPlanner && "lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-center lg:gap-8",
          )}
        >
          <div className="flex min-w-0 max-w-[640px] flex-col gap-1.5 sm:gap-2">
            {eyebrow ? (
              <p className="text-sm font-semibold text-[var(--accent)]">{eyebrow}</p>
            ) : null}
            <h1 className="text-xl font-bold leading-tight text-[var(--foreground)] sm:text-2xl md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
                {description}
              </p>
            ) : null}
            <HubHeroCtas
              ctaLabel={ctaLabel}
              ctaHref={ctaHref}
              secondaryCtaLabel={secondaryCtaLabel}
              secondaryCtaHref={secondaryCtaHref}
              appearance="editorial"
            />
          </div>
          {showPlanner && plannerEntry ? <HubPlannerCards source={plannerEntry.source} /> : null}
        </div>
      </section>
    );
  }

  if (hasImage) {
    return (
      <HeroVisual
        imageUrl={imageUrl!.trim()}
        priority={imagePriority}
        className={className}
        contentClassName={showPlanner ? "w-full" : "max-w-[640px] gap-1.5 sm:gap-2"}
        minHeightClassName={HUB_HERO_MIN_HEIGHT}
      >
        <div
          className={
            showPlanner
              ? "grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-center lg:gap-8"
              : "contents"
          }
        >
          <div className={showPlanner ? "flex min-w-0 max-w-[640px] flex-col gap-1.5 sm:gap-2" : "contents"}>
            {eyebrow ? (
              <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{eyebrow}</p>
            ) : null}
            <h1 className="hero-text-shadow-title text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="hero-text-shadow-body max-w-2xl line-clamp-2 text-sm text-white/90 sm:line-clamp-none sm:text-base">
                {description}
              </p>
            ) : null}
            <HubHeroCtas
              ctaLabel={ctaLabel}
              ctaHref={ctaHref}
              secondaryCtaLabel={secondaryCtaLabel}
              secondaryCtaHref={secondaryCtaHref}
              appearance="on-media"
            />
          </div>
          {showPlanner && plannerEntry ? <HubPlannerCards source={plannerEntry.source} /> : null}
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
