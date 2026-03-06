"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import ProductCardV2 from "@/components/products/ProductCardV2";
import type { ProductCardV2Badge } from "@/components/products/ProductCardV2";

function parseMetaTitleAsHashtags(metaTitle?: string): string[] {
  if (!metaTitle?.trim()) return [];
  return metaTitle
    .trim()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function productToV2Props(product: Product): React.ComponentProps<typeof ProductCardV2> {
  const tags = parseMetaTitleAsHashtags(product.meta_title);
  const badges: ProductCardV2Badge[] = [];
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category],
    tags,
    status: "AVAILABLE",
    badges: badges.length > 0 ? badges : undefined,
    thumbnailUrl: product.image_url,
    priceMeta: "1인 기준",
    metaInfo: "",
  };
}

type DevProductCardV2GridProps = {
  products: Product[];
};

export default function DevProductCardV2Grid({ products }: DevProductCardV2GridProps) {
  const router = useRouter();

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">ProductCardV2 데모 (기존 목록 변경 없음)</h2>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {products.slice(0, 6).map((product) => (
          <ProductCardV2
            key={product.id}
            {...productToV2Props(product)}
            onClickDetail={() => router.push(`/products/${product.id}`)}
            onClickConsult={() => router.push(`/quote?productId=${encodeURIComponent(product.id)}`)}
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
