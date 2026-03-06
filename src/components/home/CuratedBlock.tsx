import type { Product } from "@/types/product";
import CuratedProductCard from "@/components/home/CuratedProductCard";

export type CuratedBlockProps = {
  title: string;
  description: string;
  products: Product[];
};

export default function CuratedBlock({ title, description, products }: CuratedBlockProps) {
  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-4 rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-3xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h4 className="font-card-title type-h3 text-[var(--foreground)] md:text-[1.375rem]">
            {title}
          </h4>
          <p className="mt-1 type-caption leading-relaxed text-[var(--text-muted)] md:type-small">{description}</p>
        </div>
      </div>

      <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
        {products.map((product) => (
          <CuratedProductCard key={product.id} product={product} sectionTitle={title} />
        ))}
      </div>
    </section>
  );
}
