import Link from "next/link";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { cn } from "@/lib/cn";

export type LandingHeroProps = {
  title: string;
  description?: string;
  ctaLabel: string;
  ctaHref: string;
  className?: string;
};

/**
 * 허브 랜딩 상단 Hero. 제목·설명·CTA 하나.
 */
export function LandingHero({
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: LandingHeroProps) {
  return (
    <section className={cn("space-y-6", className)}>
      <SectionHeader
        title={title}
        description={description}
        align="left"
        action={
          <Link
            href={ctaHref}
            className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {ctaLabel}
          </Link>
        }
      />
    </section>
  );
}
