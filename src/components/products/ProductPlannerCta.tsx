"use client";

import Link from "next/link";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { cn } from "@/lib/cn";

type ProductPlannerCtaProps = {
  productId: string;
  className?: string;
  /** test override; defaults to ENABLE_FREE_TRAVEL_PLANNER */
  enabled?: boolean;
};

/**
 * Secondary CTA after itinerary preview — does not replace booking/consult sticky CTAs.
 */
export function ProductPlannerCta({
  productId,
  className,
  enabled = ENABLE_FREE_TRAVEL_PLANNER,
}: ProductPlannerCtaProps) {
  if (!enabled) return null;

  const href = `/planner?sourceProductId=${encodeURIComponent(productId)}`;

  return (
    <aside
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <p className="type-body font-semibold text-[var(--foreground)]">원하는 일정과 조금 다른가요?</p>
      <p className="mt-1 type-small leading-relaxed text-[var(--text-muted)]">
        내 일정과 취향에 맞는 자유여행을 직접 만들어보세요.
      </p>
      <Link
        href={href}
        className={cn(
          "mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)]",
          "border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 type-btn text-[var(--primary)]",
          "transition hover:bg-[var(--primary-soft)]",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        )}
      >
        자유여행 플랜 만들기
      </Link>
    </aside>
  );
}
