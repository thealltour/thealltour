"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import type { Product } from "@/types/product";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type HomeProductCardProps = {
  product: Product;
  /** 미지정 시 `/products/[id]` (ProductCard와 동일 규칙) */
  href?: string;
  className?: string;
  /** 홈 큐레이션 카드 클릭 계측 */
  analyticsSection?: string;
};

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** 본문 서브 메타 1줄 (pill 나열 금지) */
function buildSubMetaLine(product: Product): string {
  const one = product.one_liner?.trim();
  if (one) return one.length > 52 ? `${one.slice(0, 49)}…` : one;
  const meta = product.meta_info?.trim();
  if (meta) return meta.length > 52 ? `${meta.slice(0, 49)}…` : meta;
  const dur = product.duration?.trim();
  if (dur) return dur;
  if (product.status === "AVAILABLE") return "예약 가능";
  if (product.status === "LIMITED") return "잔여 한정";
  return "";
}

/** 이미지 좌상단 배지는 1개만. 우선순위: 마감 계열 → 추천/인기 */
function pickImageBadge(product: Product): string | null {
  if (product.status === "SOLD_OUT") return "마감";
  if (product.status === "LIMITED") return "마감 임박";
  if (product.is_recommend) return "프로모션";
  if (product.is_popular) return "인기";
  return null;
}

/** 가격 아래 보조 혜택 배지 (상단 배지와 중복 문구 피함) */
function pickFooterBadge(product: Product, imageBadge: string | null): string | null {
  if (imageBadge === "프로모션") return null;
  if (product.is_recommend) return "혜택 상품";
  if (product.is_popular && imageBadge !== "인기") return "베스트";
  return null;
}

/**
 * 모바일 홈 큐레이션 전용 — 클룩형 경량 카드. ProductCard와 분리.
 * 홈 `CuratedSectionScrollBlock`에서만 사용.
 */
export function HomeProductCard({ product, href, className, analyticsSection }: HomeProductCardProps) {
  const resolvedHref = (href?.trim() || `/products/${product.id}`).trim();
  const titleText = product.title?.trim() || "상품";

  const rawImage = getPrimaryImageUrl(product);
  const normalized = rawImage?.trim() ? normalizeProductImageUrl(rawImage.trim()) : "";
  const imageSrc = normalized || PLACEHOLDER_IMAGE;

  const ratingAvg = product.trust?.ratingAvg;
  const reviewCount = product.trust?.reviewCount;
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const reviewCountPositive =
    typeof reviewCount === "number" && Number.isFinite(reviewCount) && reviewCount > 0;

  const price = product.price;
  const hasNumericPrice = typeof price === "number" && Number.isFinite(price) && price > 0;
  const priceFormatted = hasNumericPrice ? formatPriceKR(price) : null;
  const priceMetaLine = product.price_meta?.trim() || "1인 기준";

  const categoryLabel =
    product.overview_region?.trim() ||
    product.category?.trim() ||
    product.theme?.trim() ||
    "";

  const subMetaLine = buildSubMetaLine(product);
  const imageBadge = pickImageBadge(product);
  const footerBadge = pickFooterBadge(product, imageBadge);

  const onNavigate = () => {
    trackProductCardClick({
      productId: product.id,
      productTitle: titleText,
      href: resolvedHref,
      source: "home_curated",
      section: analyticsSection ?? null,
    });
  };

  return (
    <Link
      href={resolvedHref}
      onClick={onNavigate}
      aria-label={`${titleText}, 상세 보기`}
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
        CARD_HOVER,
        CARD_TRANSITION,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)] sm:aspect-[4/3]">
        <Image
          src={imageSrc}
          alt={titleText}
          fill
          sizes="(max-width: 640px) 42vw, 360px"
          className="object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
        />
        {imageBadge ? (
          <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-md bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--on-primary)] sm:left-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[11px]">
            {imageBadge}
          </span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 py-2.5 sm:gap-1.5 sm:p-4">
        {categoryLabel ? (
          <p className="line-clamp-1 text-[10px] font-medium text-[var(--text-muted)] sm:text-[11px]">
            {categoryLabel}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-[13px] font-semibold leading-tight text-[var(--foreground)] sm:text-sm sm:leading-snug">
          {titleText}
        </h3>

        {hasRating ? (
          <p className="inline-flex items-center gap-0.5 text-[11px] text-[var(--text-muted)] sm:gap-1 sm:text-xs">
            <Star
              className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5"
              strokeWidth={0}
              aria-hidden
            />
            <span className="tabular-nums">{ratingAvg!.toFixed(1)}</span>
            {reviewCountPositive ? (
              <span className="tabular-nums">({formatReviewCount(reviewCount!)})</span>
            ) : null}
          </p>
        ) : null}

        {subMetaLine ? (
          <p className="line-clamp-1 text-[11px] text-[var(--text-muted)] sm:text-xs">{subMetaLine}</p>
        ) : null}

        <div className="mt-auto pt-0.5 sm:pt-1">
          {priceFormatted ? (
            <>
              <p className="text-base font-bold leading-tight text-[var(--primary)] tabular-nums sm:text-lg">
                ₩{priceFormatted}~
              </p>
              {priceMetaLine ? (
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)] sm:text-[11px]">{priceMetaLine}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-bold leading-tight text-[var(--text-muted)] sm:text-base md:text-lg">
              상담 후 견적
            </p>
          )}

          {footerBadge ? (
            <span className="mt-1.5 inline-block max-w-full truncate rounded-md border border-[var(--primary)]/35 bg-[var(--primary)]/5 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--primary)] sm:mt-2 sm:px-2 sm:text-[11px]">
              {footerBadge}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
