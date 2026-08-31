import { cn } from "@/lib/cn";
import { CoupangDynamicBanner } from "@/components/affiliate/CoupangDynamicBanner";
import { COUPANG_PARTNERS_DISCLOSURE } from "@/lib/affiliate/coupangBannerConfig";

export type CoupangTravelSectionProps = {
  className?: string;
  /** /products 등 좁은 gap */
  compact?: boolean;
  headingId?: string;
};

/**
 * 쿠팡 파트너스 여행상품 제휴 섹션 — heading + banner + 고지.
 * 자체 상품과 명확히 구분되는 affiliate UI.
 */
export function CoupangTravelSection({
  className,
  compact = false,
  headingId = "coupang-travel-heading",
}: CoupangTravelSectionProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/40",
        compact ? "space-y-2 px-3 py-3 sm:px-4 sm:py-4" : "space-y-3 px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5",
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className={cn("space-y-1", compact ? "px-0.5" : "")}>
        <p className="type-caption font-medium uppercase tracking-wide text-[var(--text-muted)]">
          제휴 · 쿠팡 파트너스
        </p>
        <h2
          id={headingId}
          className={cn(
            "font-semibold text-[var(--foreground)]",
            compact ? "type-small sm:type-body" : "type-body sm:type-h3",
          )}
        >
          더 많은 여행상품 둘러보기
        </h2>
        <p className="type-caption text-[var(--text-secondary)] sm:type-small">
          쿠팡에서 판매 중인 여행상품을 확인해보세요.
        </p>
      </div>

      <CoupangDynamicBanner />

      <p className="type-caption leading-relaxed text-[var(--text-muted)]">
        {COUPANG_PARTNERS_DISCLOSURE}
      </p>
    </section>
  );
}
