"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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

export type ProductListCardProps = ProductCardProps;

/** duration/meta + overview를 한 줄로 합치되, 동일 조각은 한 번만 */
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

/** ratingAvg 유효 + reviewCount > 0 — 형식 ★ 4.8 (127), 제목 우측 상단 배치용 */
function ListRatingBlock({
  ratingAvg,
  reviewCount,
  className,
}: {
  ratingAvg?: number;
  reviewCount?: number;
  className?: string;
}) {
  const hasRating =
    typeof ratingAvg === "number" && Number.isFinite(ratingAvg) && ratingAvg > 0;
  const rcPositive =
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1 tabular-nums text-sm font-medium text-neutral-700",
        className,
      )}
    >
      <span aria-hidden className="translate-y-px text-[0.95em] leading-none">
        ★
      </span>
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductListCard({
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
  overviewStay = "",
  overviewRegion = "",
  overviewDuration = "",
  analyticsSource,
  analyticsSection,
  productId,
  highlightTag,
}: ProductListCardProps) {
  const [consultPressed, setConsultPressed] = useState(false);

  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const seasonalBandInfo = getProductCardSeasonalBandInfo(seasonal_price_bands);

  /** 대표 배지는 부모 `campaignBadgeMax`로 개수 제어(카탈로그는 2 = 랜딩·destinations와 동일) */
  const visibleCampaignBadges = [...badges]
    .filter((b) => b.isActive !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 2);
  const highlightLabel = highlightTag ? PRODUCT_CARD_HIGHLIGHT_LABELS[highlightTag] : null;
  const overlayCampaignBadges = highlightLabel ? [] : visibleCampaignBadges;
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

  const handleDetailButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClickDetail?.();
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
  const overviewLine = [overviewDuration, overviewRegion, overviewStay]
    .map((s) => s?.trim())
    .filter((s) => s && s !== "-")
    .join(" · ");
  const simpleMetaLine =
    metaLine && overviewLine
      ? mergeDistinctMetaParts(metaLine, overviewLine)
      : metaLine || overviewLine;

  /** SEO 메타 타이틀(스페이스 구분) → 상품등록 시 입력한 키워드를 해시태그로 노출 */
  const seoHashtags = tags.map((t) => t.trim()).filter(Boolean);

  const cardContent = (
    <div className="flex w-full flex-col">
    <div className="grid w-full grid-cols-[280px_minmax(0,1fr)_300px]">
      {/* 좌측: 이미지 + 캠페인 배지 오버레이(/destinations·랜딩 ProductCard와 동일 계열) */}
      <div className="relative h-full min-h-[220px] overflow-hidden rounded-l-2xl bg-[var(--surface-muted)]">
        {highlightLabel ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)]">
            <span className="inline-flex max-w-[min(100%,11rem)] truncate rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30">
              {highlightLabel}
            </span>
          </div>
        ) : overlayCampaignBadges.length > 0 ? (
          <div
            className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1"
            aria-label="기획 배지"
          >
            {overlayCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`list-ov-${b.label}-${i}`}
                label={b.label}
                isPrimary={i === 0}
                kind="list"
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
              />
            ))}
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="280px"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[11px] font-medium">이미지 없음</span>
          </div>
        )}
      </div>

      {/* 중앙: 정보 칩 → 제목 */}
      <div className="flex min-w-0 flex-col gap-1.5 p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 gap-y-1">
          {infoDisplayChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none shadow-sm backdrop-blur",
                infoDisplayChipSurfaceClass(chip.variant),
              )}
            >
              {chip.label}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 className="line-clamp-2 min-w-0 flex-1 text-lg font-semibold leading-snug text-[var(--text-primary)]">
            {title || "상품명"}
          </h2>
          <ListRatingBlock
            ratingAvg={ratingAvg}
            reviewCount={reviewCount}
            className="pt-0.5"
          />
        </div>
        {oneLine ? (
          <p className="line-clamp-2 text-sm leading-snug text-[var(--text-muted)]">
            {oneLine}
          </p>
        ) : null}
        {simpleMetaLine ? (
          <p className="line-clamp-1 text-sm text-[var(--text-muted)]">
            {simpleMetaLine}
          </p>
        ) : null}
      </div>

      {/* 우측: 하단 anchor — 가격 먼저, CTA는 보조(시각 비중 완화) */}
      <div className="flex min-h-[220px] flex-col border-l border-[var(--border)] p-5">
        <div className="min-h-0 flex-1" aria-hidden />
        <div className="mt-auto space-y-4">
          <div className="min-w-0">
            {seasonalBandInfo && seasonal_price_bands ? (
              <>
                <p className="font-price-strong text-3xl font-extrabold leading-tight tabular-nums text-[var(--primary)]">
                  {getSeasonalCardMainLineFull(seasonal_price_bands, seasonalBandInfo)}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-subtle)]">{SEASONAL_CARD_SUBLINE}</p>
                {highlightLabel ? (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{highlightLabel}</p>
                ) : null}
              </>
            ) : priceFormatted != null ? (
              <>
                <p className="font-price-strong text-3xl font-extrabold leading-tight tabular-nums text-[var(--primary)]">
                  {priceFormatted}원~
                </p>
                {priceMeta ? (
                  <p className="mt-1 text-xs font-medium text-[var(--text-subtle)]">
                    {priceMeta}
                  </p>
                ) : null}
                {highlightLabel ? (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">{highlightLabel}</p>
                ) : null}
              </>
            ) : (
              <p className="text-base font-semibold text-[var(--text-muted)]">
                상담 후 견적
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
              onClick={handleDetailButtonClick}
            >
              자세히 보기
            </button>
            {onClickConsult ? (
              <button
                type="button"
                disabled={consultPressed}
                className={cn(
                  buttonVariants({ variant: "accent", size: "md" }),
                  "w-full",
                  consultPressed && "pointer-events-none",
                )}
                onClick={handleConsultClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    handleConsultKey(e);
                }}
              >
                {status === "SOLD_OUT" ? "대기 문의" : getProductCtaLabel(status)}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    {seoHashtags.length > 0 ? (
      <div
        className="flex w-full flex-wrap gap-x-2 gap-y-1 border-t border-[var(--border)]/25 px-5 py-2.5"
        aria-label="상품 SEO 키워드"
      >
        {seoHashtags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="text-[0.9rem] font-medium leading-snug text-[var(--text-muted)]"
          >
            #{tag}
          </span>
        ))}
      </div>
    ) : null}
    </div>
  );

  /** 테두리·그림자 최소화: 목록이 관리 패널처럼 보이지 않게(콘텐츠 카드 톤). Card interactive는 border+shadow가 고정이라 div로 래핑. */
  const cardClassName = cn(
    "group w-full cursor-pointer overflow-hidden rounded-2xl border-0 bg-[var(--surface)]",
    "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]",
    "dark:shadow-[0_1px_2px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.12)]",
    CARD_TRANSITION,
    "hover:shadow-[0_2px_10px_rgba(15,23,42,0.055)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.22)]",
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
        <div className={cardClassName}>{cardContent}</div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        cardClassName,
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
      )}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {cardContent}
    </div>
  );
}
