import CuratedBlock from "@/components/home/CuratedBlock";
import { cn } from "@/lib/cn";
import type { Product } from "@/types/product";

/** Hero 직후 추천 상품 허브. 앵커는 히어로 primary CTA와 공유 */
export const LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID = "landing-recommended-products";

type LandingRecommendedProductsSectionProps = {
  label: string;
  products: Product[];
  fallbackHref?: string;
  fallbackLabel?: string;
};

export default function LandingRecommendedProductsSection({
  label,
  products,
  fallbackHref,
  fallbackLabel,
}: LandingRecommendedProductsSectionProps) {
  if (products.length === 0) return null;
  const isGolf = label.includes("골프");
  return (
    <section
      id={LANDING_RECOMMENDED_PRODUCTS_ANCHOR_ID}
      className={cn(
        "scroll-mt-28",
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:rounded-3xl sm:p-5 sm:shadow-[var(--shadow-soft-strong)] md:p-6 lg:p-7",
      )}
    >
      <CuratedBlock
        title={isGolf ? label : `${label} 추천 상품`}
        description={
          isGolf
            ? `${label.replace(/ 골프투어$/, "")} 골프 상품을 먼저 살펴보세요.`
            : `${label} 여행 상품을 먼저 살펴보세요.`
        }
        products={products}
        surface="none"
        hubLandingLayout
        landingHubProductHoverEmphasis
      />
      {fallbackHref && fallbackLabel ? (
        <div className="mt-4 text-right text-sm">
          <a href={fallbackHref} className="font-semibold text-[var(--primary)] underline">
            {fallbackLabel}
          </a>
        </div>
      ) : null}
    </section>
  );
}
