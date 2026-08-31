import type { ProductCardSource } from "@/lib/products/productListItem";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/layout/SectionHeader";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import {
  getFeaturedHighlightLine,
  buildProductExperienceSummary,
  productToProductCardProps,
} from "@/lib/productCardProps";
import { CARD_BASE, CARD_PADDING_RELAXED } from "@/lib/cardTokens";
import type { ProductCardClickSource } from "@/lib/analytics/trackProductClick";

export type CuratedBlockSurface = "none" | "muted" | "card";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: ProductCardSource[];
  /** 섹션 래퍼 강조. none: 헤더+그리드만, muted/card: 배경/박스 적용 */
  surface?: CuratedBlockSurface;
  /**
   * true: /destinations·/themes 허브 추천 상품 — md 미만 가로 스냅 레일, md+ 그리드.
   */
  hubLandingLayout?: boolean;
  /**
   * true: **[slug] 랜딩** 상단 대표 상품 — 브리지 수준(선택 유도 문구·related 카드·첫 카드 강조·✔ 한 줄·타이트 레일).
   * `/recommended`·허브 인덱스 등에서는 false.
   */
  featuredLanding?: boolean;
  /**
   * true: `/recommended` 랜딩 등 — 그리드 카드 호버를 토큰 기반으로 더 또렷하게.
   */
  landingHubProductHoverEmphasis?: boolean;
  /**
   * 상품 카드 클릭 계측 source. 미지정 시 기존 home_curated 유지(홈 CuratedBlock).
   * Region/Theme Hub·Landing에서는 landing을 전달한다.
   */
  analyticsSource?: ProductCardClickSource;
  /** analyticsSource=landing 일 때 region | theme 구분 */
  analyticsLandingType?: "region" | "theme" | null;
  taxonomySlug?: string | null;
};

const SURFACE_CLASS: Record<CuratedBlockSurface, string> = {
  none: "",
  muted: "rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)] p-5 sm:p-6",
  card: cn(CARD_BASE, CARD_PADDING_RELAXED),
};

export default function CuratedBlock({
  title,
  description,
  products,
  surface = "none",
  hubLandingLayout = false,
  featuredLanding = false,
  landingHubProductHoverEmphasis = false,
  analyticsSource,
  analyticsLandingType = null,
  taxonomySlug = null,
}: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  const useHubRail = hubLandingLayout || featuredLanding;
  const useTightMobileGap = featuredLanding;
  const resolvedSource: ProductCardClickSource =
    analyticsSource ?? (featuredLanding ? "landing" : "home_curated");

  return (
    <section className={cn("space-y-3 sm:space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader title={title} description={description} />

      {featuredLanding ? (
        <p className="mt-1 text-sm text-[var(--text-muted)] sm:mt-0.5">
          가장 많이 선택되는 일정부터 확인해보세요.
        </p>
      ) : null}

      <ProductCardGridSection
        hubLandingLayout={useHubRail}
        guideBridgeMobileTightGap={useTightMobileGap}
      >
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(
              product,
              featuredLanding
                ? {
                    layout: "related",
                    analyticsSource: resolvedSource,
                    analyticsSection: title,
                    analyticsLandingType: analyticsLandingType ?? undefined,
                    taxonomySlug: taxonomySlug ?? undefined,
                    guideBridgeNarrowCopy: true,
                    experienceSummary: buildProductExperienceSummary(product),
                    selectionHighlightLine: getFeaturedHighlightLine(product),
                    emphasizeFirstOnMobile: index === 0,
                    topPickLabel: index === 0 ? "가장 많이 선택된" : undefined,
                  }
                : {
                    layout: "grid",
                    analyticsSource: resolvedSource,
                    analyticsSection: title,
                    analyticsLandingType: analyticsLandingType ?? undefined,
                    taxonomySlug: taxonomySlug ?? undefined,
                    ...(landingHubProductHoverEmphasis ? { emphasizeLandingHubHover: true } : {}),
                  },
            )}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
