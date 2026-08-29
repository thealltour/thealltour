"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Card } from "@/components/ui/Card";
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
import {
  limitProductCardListTags,
  PRODUCT_CARD_LIST_TAG_MAX,
} from "@/lib/products/parseMetaTitleAsHashtags";
import { CAMPAIGN_BADGE_PROMOTION_PALETTE } from "@/lib/productCampaignPresentation";

export type ProductListCardMobileProps = ProductCardProps;

function mergeDistinctMetaParts(a: string, b: string): string {
  const parts = [...a.split(" · "), ...b.split(" · ")]
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join(" · ");
}

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

const detailFocusClass =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

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
  ratingAvg,
  reviewCount,
  overviewStay = "",
  overviewRegion = "",
  overviewDuration = "",
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

  const handleConsult = () => {
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert(
        "마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.",
      );
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleDetailAnalytics = () => {
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

  const handleDetailFallbackKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onClickDetail?.();
    }
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const overviewLine = [overviewDuration, overviewStay]
    .map((s) => s?.trim())
    .filter((s) => s && s !== "-")
    .join(" · ");
  const shortMetaLine =
    metaLine && overviewLine
      ? mergeDistinctMetaParts(metaLine, overviewLine)
      : metaLine || overviewLine;
  const regionLine = overviewRegion?.trim() || "";
  const displayTags = limitProductCardListTags(tags, PRODUCT_CARD_LIST_TAG_MAX.mobile);
  const consultLabel =
    status === "SOLD_OUT" ? "대기 문의" : getProductCtaLabel(status, ctaLabelOptions);

  const detailBody = (
    <div className="flex w-full">
      <div className="relative w-[30%] min-w-[100px] max-w-[118px] shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]">
        {overlayCampaignBadges.length > 0 ? (
          <div
            className="pointer-events-none absolute left-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-col items-start gap-0.5"
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
          <div className="pointer-events-none absolute left-1 top-1 z-10 max-w-[calc(100%-0.5rem)]">
            <span
              className={cn(
                "inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-tight shadow-sm ring-1",
                CAMPAIGN_BADGE_PROMOTION_PALETTE,
              )}
            >
              {highlightLabel}
            </span>
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 30vw, 118px"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full min-h-[120px] w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[10px] font-medium">이미지 없음</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        {infoDisplayChips.length > 0 ? (
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
          </div>
        ) : null}

        {regionLine ? (
          <p className="line-clamp-1 text-[11px] font-medium text-[var(--text-muted)]">
            {regionLine}
          </p>
        ) : null}

        <h2 className="line-clamp-2 text-[15px] font-semibold leading-[1.35] text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>

        {shortMetaLine ? (
          <p className="line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)]">
            {shortMetaLine}
          </p>
        ) : null}

        <ListRatingBlockMobile ratingAvg={ratingAvg} reviewCount={reviewCount} />

        <div className="mt-auto pt-1">
          {seasonalBandInfo && seasonal_price_bands ? (
            <>
              <p className="line-clamp-2 text-lg font-bold tabular-nums leading-tight text-[var(--primary)]">
                {getSeasonalCardMainLineFull(seasonal_price_bands, seasonalBandInfo)}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                {SEASONAL_CARD_SUBLINE}
              </p>
            </>
          ) : priceFormatted != null ? (
            <>
              <p className="text-lg font-bold tabular-nums leading-tight text-[var(--primary)]">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                  {priceMeta}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">상담 후 견적</p>
          )}
        </div>
      </div>
    </div>
  );

  const footer =
    displayTags.length > 0 || onClickConsult ? (
      <div
        className="flex items-center justify-between gap-2 border-t border-[var(--border)]/25 px-3 py-2"
        aria-label="상품 키워드 및 문의"
      >
        {displayTags.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap gap-x-1.5 gap-y-0.5">
            {displayTags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="text-[11px] font-medium leading-snug text-[var(--text-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden />
        )}
        {onClickConsult ? (
          <button
            type="button"
            disabled={consultPressed}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-0.5 px-2 text-xs font-semibold text-[var(--text-muted)]",
              "underline-offset-2 hover:text-[var(--foreground)] hover:underline",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
              consultPressed && "pointer-events-none opacity-60",
            )}
            onClick={handleConsult}
          >
            {consultLabel}
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </button>
        ) : null}
      </div>
    ) : null;

  const cardClassName = cn(
    "group flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
    CARD_TRANSITION,
    "hover:shadow-md hover:border-[var(--primary)]/30",
    "active:scale-[0.99] active:opacity-95",
  );

  const detailRegion = hrefDetail ? (
    <Link
      href={hrefDetail}
      className={cn("block w-full min-w-0 flex-1 cursor-pointer", detailFocusClass)}
      onClick={handleDetailAnalytics}
    >
      {detailBody}
    </Link>
  ) : (
    <div
      className={cn("block w-full min-w-0 flex-1 cursor-pointer", detailFocusClass)}
      role="link"
      tabIndex={0}
      onClick={onClickDetail}
      onKeyDown={handleDetailFallbackKey}
    >
      {detailBody}
    </div>
  );

  return (
    <Card variant="interactive" className={cardClassName}>
      {detailRegion}
      {footer}
    </Card>
  );
}
