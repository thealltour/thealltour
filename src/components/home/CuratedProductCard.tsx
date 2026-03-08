"use client";

import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types/product";
import { getProductBadges } from "@/lib/productCategory";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import {
  CARD_BASE,
  CARD_HOVER,
  CARD_TRANSITION,
  CARD_PADDING,
  CARD_IMAGE_WRAPPER,
} from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

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
      className={cn(
        "group relative flex h-full flex-col overflow-hidden",
        CARD_BASE,
        CARD_HOVER,
        CARD_TRANSITION,
      )}
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
      <div className={cn(CARD_IMAGE_WRAPPER, "h-32 sm:h-36")}>
        <Image
          src={product.image_url ?? ""}
          alt={`${product.title ?? "상품"} 대표 이미지`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)] via-[var(--overlay)]/20 to-transparent" />
        <div className="absolute inset-0 overlay-radial-blue-subtle opacity-80 transition-opacity group-hover:opacity-100" />
      </div>
      <div className={cn("relative flex flex-1 flex-col", CARD_PADDING)}>
        {/* 태그: 카테고리·배지 */}
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
        {/* 제목 */}
        <h5 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {product.title ?? "상품명"}
        </h5>
        {/* 테마/한줄: 1줄 */}
        {product.theme ? (
          <p className="mt-0.5 line-clamp-1 type-caption text-[var(--text-muted)]">
            {product.theme}
          </p>
        ) : null}
        {/* 설명: 1줄로 밀도 확보 */}
        <p className="mt-0.5 line-clamp-1 type-caption text-[var(--text-muted)]">
          {product.description ?? ""}
        </p>
        {/* 가격: 하단 고정 */}
        {typeof product.price === "number" ? (
          <p className="font-price-strong mt-1.5 type-caption font-semibold text-[var(--primary)]">
            예상가 {new Intl.NumberFormat("ko-KR").format(product.price)}원~
          </p>
        ) : null}
      </div>
    </Link>
  );
}
