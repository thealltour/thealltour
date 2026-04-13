import CuratedBlock from "@/components/home/CuratedBlock";
import { cn } from "@/lib/cn";
import type { Product } from "@/types/product";

/** Hero 직후 추천 상품 허브. 앵커는 히어로 primary CTA와 공유 */
export const LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID = "landing-recommended-products";

type LandingRecommendedProductsSectionProps = {
  label: string;
  products: Product[];
};

export default function LandingRecommendedProductsSection({
  label,
  products,
}: LandingRecommendedProductsSectionProps) {
  if (products.length === 0) return null;
  return (
    <section
      id={LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID}
      className={cn(
        "scroll-mt-28",
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:rounded-3xl sm:p-5 sm:shadow-[var(--shadow-soft-strong)] md:p-6 lg:p-7",
      )}
    >
      <CuratedBlock
        title={`${label} 추천 상품`}
        description={`${label} 여행 상품을 먼저 살펴보세요.`}
        products={products}
        surface="none"
        hubLandingLayout
        landingHubProductHoverEmphasis
      />
    </section>
  );
}
