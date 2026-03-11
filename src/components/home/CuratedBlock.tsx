import type { Product } from "@/types/product";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/layout/SectionHeader";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { CARD_BASE, CARD_PADDING_RELAXED } from "@/lib/cardTokens";

export type CuratedBlockSurface = "none" | "muted" | "card";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: Product[];
  /** 섹션 래퍼 강조. none: 헤더+그리드만, muted/card: 배경/박스 적용 */
  surface?: CuratedBlockSurface;
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
}: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className={cn("space-y-3 sm:space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader
        title={title}
        description={description}
      />

      <ProductCardGridSection>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "home_curated",
              analyticsSection: title,
            })}
          />
        ))}
      </ProductCardGridSection>
    </section>
  );
}
