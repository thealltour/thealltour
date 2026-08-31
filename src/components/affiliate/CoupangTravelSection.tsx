import { cn } from "@/lib/cn";
import { CoupangDynamicBanner } from "@/components/affiliate/CoupangDynamicBanner";
import {
  COUPANG_PARTNERS_DISCLOSURE,
  COUPANG_SECTION_MAX_WIDTH_CLASS,
  COUPANG_TRAVEL_BANNER_IDS,
} from "@/lib/affiliate/coupangBannerConfig";

export type CoupangTravelSectionProps = {
  className?: string;
  /** /products·region — 구분선 스트립 + copy 축소 */
  compact?: boolean;
  /** 홈 등 SectionHeader를 부모가 렌더할 때 배너+고지만 출력 */
  hideHeader?: boolean;
  headingId?: string;
};

function CoupangBannerGrid() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {COUPANG_TRAVEL_BANNER_IDS.map((bannerId) => (
          <div
            key={bannerId}
            className="overflow-hidden rounded-lg bg-white ring-1 ring-[var(--border)]"
          >
            <CoupangDynamicBanner bannerId={bannerId} />
          </div>
        ))}
      </div>
      <p className="type-caption leading-snug text-[var(--text-muted)]">
        {COUPANG_PARTNERS_DISCLOSURE}
      </p>
    </>
  );
}

function CompactHeader({ headingId }: { headingId: string }) {
  return (
    <div className="space-y-1">
      <p className="type-caption font-medium tracking-wide text-[var(--text-muted)]">
        제휴 · 쿠팡 파트너스
      </p>
      <h2
        id={headingId}
        className="type-small font-semibold text-[var(--foreground)] sm:type-body"
      >
        더 많은 여행상품 둘러보기
      </h2>
      <p className="sr-only">쿠팡에서 판매 중인 여행상품을 확인해보세요.</p>
    </div>
  );
}

const columnClassName = cn("mx-auto w-full space-y-2.5 sm:space-y-3", COUPANG_SECTION_MAX_WIDTH_CLASS);

/**
 * 쿠팡 파트너스 여행상품 제휴 섹션 — heading + banner + 고지.
 * 모바일 2행 / 데스크탑 2열 배너 그리드.
 */
export function CoupangTravelSection({
  className,
  compact = false,
  hideHeader = false,
  headingId = "coupang-travel-heading",
}: CoupangTravelSectionProps) {
  if (hideHeader) {
    return (
      <div className={cn("space-y-2 sm:space-y-2.5", className)}>
        <CoupangBannerGrid />
      </div>
    );
  }

  const column = (
    <div className={columnClassName}>
      <CompactHeader headingId={headingId} />
      <CoupangBannerGrid />
    </div>
  );

  if (compact) {
    return (
      <section
        className={cn("border-t border-[var(--border)] pt-4 sm:pt-5", className)}
        aria-labelledby={headingId}
      >
        {column}
      </section>
    );
  }

  return (
    <section className={cn(className)} aria-labelledby={headingId}>
      <div className={columnClassName}>
        <div className="space-y-1">
          <p className="type-caption font-medium tracking-wide text-[var(--text-muted)]">
            제휴 · 쿠팡 파트너스
          </p>
          <h2
            id={headingId}
            className="type-body font-semibold text-[var(--foreground)] sm:type-h3"
          >
            더 많은 여행상품 둘러보기
          </h2>
          <p className="type-caption text-[var(--text-secondary)] sm:type-small">
            쿠팡에서 판매 중인 여행상품을 확인해보세요.
          </p>
        </div>
        <CoupangBannerGrid />
      </div>
    </section>
  );
}
