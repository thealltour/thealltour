"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import ProductCard from "@/components/products/ProductCard";
import { productToProductCardProps } from "@/lib/productCardProps";

type DevProductCardV2GridProps = {
  products: Product[];
};

export default function DevProductCardV2Grid({ products }: DevProductCardV2GridProps) {
  const router = useRouter();

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">ProductCard 데모 (기존 목록 변경 없음)</h2>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {products.slice(0, 6).map((product) => (
          <ProductCard
            key={product.id}
            {...productToProductCardProps(product, {
              layout: "grid",
              analyticsSource: "home_curated",
              analyticsSection: "dev",
              onClickDetail: () => router.push(`/products/${product.id}`),
              onClickConsult: () => router.push(`/quote?productId=${encodeURIComponent(product.id)}`),
            })}
          />
        ))}
      </div>
      {products.length === 0 && (
        <p className="rounded-2xl bg-slate-100 p-6 text-sm text-slate-600">
          등록된 상품이 없습니다. 상품 등록 후 V2 카드를 확인할 수 있습니다.
        </p>
      )}
    </section>
  );
}
