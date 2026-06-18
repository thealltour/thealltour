"use client";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type { ProductCardProps } from "@/components/products/ProductCard";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";
import {
  getProductCardSeasonalBandInfo,
  getSeasonalCardMainLineFull,
  SEASONAL_CARD_SUBLINE,
} from "@/lib/products/productCardSeasonalPriceDisplay";
import { PRODUCT_CARD_HIGHLIGHT_LABELS } from "@/lib/products/productCardHighlightTag";
import { getProductCtaLabel } from "@/lib/products/getProductCtaLabel";

export type ProductListCardMobileProps = ProductCardProps;

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function ListRatingBlockMobile({
  ratingAvg,
  reviewCount,
}: {
  ratingAvg?: number;
  reviewCount?: number;
}) {
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const rcPositive =
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p className="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-[var(--text-muted)]">
      <Star
        className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
        strokeWidth={0}
        aria-hidden
      />
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductListCardMobile({
  title = "",
  price,
  seasonal_price_bands,
  duration = "",
  tags = [],
  status,
  badges = [],
  infoBadges = [],
  thumbnailUrl = "",
  hrefDetail,
  onClickDetail,
  onClickConsult,
  priceMeta = "1인 기준",
  metaInfo = "",
  oneLiner,
  ratingAvg,
  reviewCount,
  analyticsSource,
  analyticsSection,
  productId,
  highlightTag,
  ctaLabelOptions,
}: ProductListCardMobileProps) {
  const [consultPressed, setConsultPressed] = useState(false);

  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const seasonalBandInfo = getProductCardSeasonalBandInfo(seasonal_price_bands);

  const visibleCampaignBadges = [...badges]
    .filter((b) => b.isActive !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 2);
  const highlightLabel = highlightTag ? PRODUCT_CARD_HIGHLIGHT_LABELS[highlightTag] : null;
  const hasPromotionOverlay = visibleCampaignBadges.some((b) => b.isPromotion);
  const overlayCampaignBadges =
    hasPromotionOverlay || !highlightLabel ? visibleCampaignBadges : [];
  const infoDisplayChips = pickInfoDisplayChips(status, infoBadges);

  const handleCardClick = () => {
    onClickDetail?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClickDetail?.();
    }
  };

  const handleConsultClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const oneLine = oneLiner?.trim() ?? "";
  const seoHashtags = tags.map((t) => t.trim()).filter(Boolean);

  const cardContent = (
    <div className="flex w-full flex-col">
    <div className="flex min-h-[148px] w-full">
      {/* 좌측: 이미지 + 캠페인 배지 오버레이(데스크 목록과 동일 소스) */}
      <div className="relative w-[34%] min-w-[112px] max-w-[136px] shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]">
        {overlayCampaignBadges.length > 0 ? (
          <div
            className="pointer-events-none absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-col items-start gap-0.5 sm:left-1.5 sm:top-1.5 sm:flex-row sm:flex-wrap sm:gap-1"
            aria-label="기획 배지"
          >
            {overlayCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`m-ov-${b.label}-${i}`}
                label={b.label}
                isPrimary={true}
                kind="mobile"
                badgeTone={b.campaignTone}
                size="sm"
                surface="overlay"
                isPromotion={b.isPromotion}
                className="max-w-full"
              />
            ))}
          </div>
        ) : highlightLabel ? (
          <div className="pointer-events-none absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)] sm:left-1.5 sm:top-1.5">
            <span className="inline-flex max-w-full truncate rounded-md bg-amber-500/95 px-1.5 py-0.5 text-[9px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30 sm:px-2 sm:py-1 sm:text-[10px]">
              {highlightLabel}
            </span>
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 34vw, 136px"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full min-h-[148px] w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[10px] font-medium">이미지 없음</span>
          </div>
        )}
      </div>

      {/* 우측: 칩·평점 → 제목 → one-liner → 가격 → 상담(보조) */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {infoDisplayChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm backdrop-blur",
                infoDisplayChipSurfaceClass(chip.variant),
              )}
            >
              {chip.label}
            </span>
          ))}
          <ListRatingBlockMobile
            ratingAvg={ratingAvg}
            reviewCount={reviewCount}
          />
        </div>
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>
        {oneLine ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)]">
            {oneLine}
          </p>
        ) : null}
        {!oneLine && metaLine ? (
          <p className="line-clamp-1 text-[11px] text-[var(--text-muted)]">
            {metaLine}
          </p>
        ) : null}
        <div className="mt-1">
          {seasonalBandInfo && seasonal_price_bands ? (
            <>
              <p className="line-clamp-2 text-xl font-bold tabular-nums leading-tight text-[var(--primary)]">
                {getSeasonalCardMainLineFull(seasonal_price_bands, seasonalBandInfo)}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                {SEASONAL_CARD_SUBLINE}
              </p>
              {highlightLabel ? (
                <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{highlightLabel}</p>
              ) : null}
            </>
          ) : priceFormatted != null ? (
            <>
              <p className="text-xl font-bold tabular-nums leading-tight text-[var(--primary)]">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                  {priceMeta}
                </p>
              ) : null}
              {highlightLabel ? (
                <p className="mt-1 line-clamp-1 text-[10px] text-slate-500">{highlightLabel}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">
              상담 후 견적
            </p>
          )}
        </div>
        {onClickConsult ? (
          <button
            type="button"
            disabled={consultPressed}
            className={cn(
              buttonVariants({ variant: "accent", size: "sm" }),
              "mt-1 w-full shrink-0 text-xs font-semibold",
              consultPressed && "pointer-events-none",
            )}
            onClick={handleConsultClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
            }}
          >
            {status === "SOLD_OUT" ? "대기 문의" : getProductCtaLabel(status, ctaLabelOptions)}
          </button>
        ) : null}
      </div>
    </div>
    {seoHashtags.length > 0 ? (
      <div
        className="flex w-full flex-wrap gap-x-1.5 gap-y-1 border-t border-[var(--border)]/25 px-3.5 py-2"
        aria-label="상품 SEO 키워드"
      >
        {seoHashtags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="text-[12px] font-medium leading-snug text-[var(--text-muted)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    ) : null}
    </div>
  );

  const cardClassName = cn(
    "group w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
    CARD_TRANSITION,
    "hover:shadow-md hover:border-[var(--primary)]/30",
    "active:scale-[0.99] active:opacity-95",
  );

  if (hrefDetail) {
    const handleLinkClick = () => {
      if (analyticsSource && hrefDetail) {
        const id = productId ?? (hrefDetail.split("/").pop() || "");
        trackProductCardClick({
          productId: id,
          productTitle: title ?? "",
          href: hrefDetail,
          source: analyticsSource,
          section: analyticsSection ?? undefined,
        });
      }
    };
    return (
      <Link
        href={hrefDetail}
        className="block w-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
        onClick={handleLinkClick}
      >
        <Card variant="interactive" className={cardClassName}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      className={`${cardClassName} outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {cardContent}
    </Card>
  );
}
