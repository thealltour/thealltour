import Image from "next/image";
import { cn } from "@/lib/cn";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";

export type LandingDetailHeroProps = {
  title: string;
  description?: string;
  imageUrl: string | null;
  className?: string;
};

/**
 * 상세 랜딩용 Hero. 이미지 배경 + 제목·설명. 맥락이 있는 페이지 느낌.
 */
export function LandingDetailHero({
  title,
  description,
  imageUrl,
  className,
}: LandingDetailHeroProps) {
  const src = imageUrl || LANDING_HERO_FALLBACK_IMAGE;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-b-2xl bg-[var(--surface-muted)]",
        "min-h-[240px] sm:min-h-[280px] md:min-h-[320px]",
        className,
      )}
    >
      <div className="absolute inset-0">
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/90 via-[var(--overlay)]/40 to-transparent"
          aria-hidden
        />
      </div>
      <div className="relative flex min-h-[240px] flex-col justify-end p-6 sm:min-h-[280px] sm:p-8 sm:pb-10 md:min-h-[320px] md:p-10 md:pb-12">
        <h1 className="heading-display font-card-title text-2xl font-semibold text-white drop-shadow-sm sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl type-small text-white/95 drop-shadow-sm sm:type-body">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
