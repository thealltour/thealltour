import type { Product } from "@/types/product";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/layout/SectionHeader";
import CuratedProductCard from "@/components/home/CuratedProductCard";
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
    <section className={cn("space-y-4", SURFACE_CLASS[surface])}>
      <SectionHeader
        title={title}
        description={description}
        className="[&_.section-title]:!text-[1.375rem] [&_.section-title]:!font-card-title [&_.section-title]:!font-semibold"
      />

      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        "gap-3 sm:gap-4",
      )}>
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} sectionTitle={title} />
        ))}
      </div>
    </section>
  );
}
