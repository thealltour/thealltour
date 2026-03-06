"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { getProductBadges } from "@/lib/productCategory";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";

export type CuratedProductCardProps = {
  product: Product;
  /** 상위 섹션 제목 (홈 추천 계측용) */
  sectionTitle?: string | null;
};

export default function CuratedProductCard({ product, sectionTitle }: CuratedProductCardProps) {
  const badges = getProductBadges(product);
  const href = `/products/${product.id}`;

  return (
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition-colors duration-150 hover:shadow-[var(--shadow-soft-strong)] hover:ring-[var(--border-strong)]"
      onClick={() =>
        trackProductCardClick({
          productId: product.id,
          productTitle: product.title ?? "",
          href,
          source: "home_curated",
          section: sectionTitle ?? undefined,
        })
      }
    >
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
        <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="relative flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5 section-label">
          {product.category ? (
            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 type-caption text-[var(--text-muted)] ring-1 ring-[var(--border)]">
              {product.category}
            </span>
          ) : null}
          {badges.map((badge) => (
            <span
              key={`${product.id}-${badge}`}
              className="rounded-full bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--foreground)] ring-1 ring-[var(--border)]"
            >
              {badge}
            </span>
          ))}
        </div>
        <h5 className="font-card-title mt-1 line-clamp-2 type-small font-semibold md:type-body text-[var(--foreground)]">
          {product.title ?? "상품명"}
        </h5>
        {product.theme ? (
          <p className="type-caption text-[var(--text-muted)]">
            {product.theme}
          </p>
        ) : null}
        <p className="line-clamp-3 type-caption leading-relaxed text-[var(--text-muted)] md:type-small">
          {product.description ?? ""}
        </p>
        {typeof product.price === "number" ? (
          <p className="font-price-strong mt-1 type-caption font-semibold text-[var(--primary)] md:type-small">
            예상가 {new Intl.NumberFormat("ko-KR").format(product.price)}원~
          </p>
        ) : null}
      </div>
    </Link>
  );
}
