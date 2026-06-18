"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buttonVariants } from "@/components/ui/Button";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type { CampaignCardKind } from "@/lib/productCampaignPresentation";
import { resolveCampaignCardKind } from "@/lib/productCampaignPresentation";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import type { SeasonalPriceBands } from "@/types/product";
import {
  getProductCardSeasonalBandInfo,
  getSeasonalCardCompactAmountDigits,
  getSeasonalCardMainLineFull,
  SEASONAL_CARD_SUBLINE,
} from "@/lib/products/productCardSeasonalPriceDisplay";
import {
  PRODUCT_CARD_HIGHLIGHT_LABELS,
  type ProductCardHighlightTag,
} from "@/lib/products/productCardHighlightTag";
import { getProductCtaLabel, type ProductCtaLabelOptions } from "@/lib/products/getProductCtaLabel";

export type ProductCardStatus =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductCardBadge = {
  type: string;
  label: string;
  priority?: number;
  isActive?: boolean;
  /** PR3: taxonomy badge_tone — 있으면 라벨 기반 톤 추론 생략 */
  campaignTone?: "primary" | "highlight" | "neutral";
  /** campaign slug=promotion (시즌/특가) */
  isPromotion?: boolean;
};

export type ProductCardLayout = "grid" | "list" | "related" | "stack";

export type ProductCardProps = {
  title?: string;
  price?: number | string;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: ProductCardStatus;
  /** 기획/추천(campaign) 대표 배지 — 이미지 오버레이 전용, 최대 2개 권장 */
  badges?: ProductCardBadge[];
  /** 테마·카테고리 등 정보성 배지 — 본문 칩 행 전용 (대표 배지와 분리) */
  infoBadges?: ProductCardBadge[];
  thumbnailUrl?: string;
  /** 상세 페이지 URL. 있으면 카드 전체가 이 주소로 이동하는 링크 영역이 됨 */
  hrefDetail?: string;
  onClickDetail?: () => void;
  onClickConsult?: () => void;
  /** 가격 기준 설명 (예: "1인 기준") */
  priceMeta?: string;
  /** 항공 포함 여부 등 메타 문구 */
  metaInfo?: string;
  /** 한 줄 선택 이유 (제목 아래) */
  oneLiner?: string;
  /** 평균 별점 (trust) */
  ratingAvg?: number;
  reviewCount?: number;
  /** 상품 카드 클릭 계측용 (선택). 설정 시 클릭 시 product_card_click 전송 */
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  /** 계측 시 사용할 상품 ID (analyticsSource 설정 시 권장) */
  productId?: string;
  /** grid | list: 가로 split. related: 상세 하단 세로형 */
  layout?: ProductCardLayout;
  /** 태그 최대 노출 개수 (기본 2) */
  maxTags?: number;
  /** 여행 오버뷰: 숙소 (/products 카드용) */
  overviewStay?: string;
  /** 여행 오버뷰: 지역 (/products 카드용) */
  overviewRegion?: string;
  /** 여행 오버뷰: 기간 (/products 카드용) */
  overviewDuration?: string;
  /** Link 래퍼 className (stack·grid 공통) */
  className?: string;
  /** related 레이아웃: 이미지 좌상단 강조 배지 (가이드 브리지 1순위 등) */
  topPickLabel?: string;
  /** related 레이아웃: 가격 아래 경험/구성 한 줄 */
  experienceSummary?: string;
  /** 가이드 브리지: 모바일에서 첫 카드 링·그림자·미세 확대 */
  emphasizeFirstOnMobile?: boolean;
  /** 가이드 브리지: 모바일에서 oneLiner 숨김·경험 요약 2토큰만 */
  guideBridgeNarrowCopy?: boolean;
  /** related + 가이드 브리지: 가격 아래 선택 이유 1줄(✔ 포함 권장). 없으면 미표시 */
  selectionHighlightLine?: string;
  /** 대표 캠페인 1줄 피치 (라벨 매핑). grid에서는 보통 미전달 */
  campaignPitchLine?: string;
  /** 리스트/모바일 등 layout이 grid여도 피치·톤을 맞출 때 */
  campaignPresentationKind?: CampaignCardKind;
  /** PR-B: 구간가. 있으면 단일 `price`보다 우선 표시 */
  seasonal_price_bands?: SeasonalPriceBands | null;
  /** PR-F: 전환 신호 1개 — 있으면 캠페인 오버레이 배지 대신 이것만 표시 */
  highlightTag?: ProductCardHighlightTag;
  /** true면 grid 카드 호버를 primary/30 대신 --shadow-soft-strong·--border-strong 사용 */
  emphasizeLandingHubHover?: boolean;
  /** 고정 출발일 상품 CTA 옵션 (AVAILABLE 시 「빠른 문의」) */
  ctaLabelOptions?: ProductCtaLabelOptions;
};

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** CTR 정책: 별점은 리뷰 1건 이상일 때만 노출(신뢰 신호 일관화) */
function CardRatingBlock({
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
    typeof reviewCount === "number" && Number.isFinite(reviewCount) && reviewCount > 0;
  if (!hasRating || !rcPositive) return null;
  return (
    <p
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[11px] text-[var(--text-muted)] sm:gap-1 sm:text-xs",
        className,
      )}
    >
      <Star
        className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5"
        strokeWidth={0}
        aria-hidden
      />
      <span>{ratingAvg!.toFixed(1)}</span>
      <span>({formatReviewCount(reviewCount!)})</span>
    </p>
  );
}

export default function ProductCard({
  title = "",
  price,
  duration = "",
  region = "",
  categories = [],
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
  oneLiner = "",
  ratingAvg,
  reviewCount,
  analyticsSource,
  analyticsSection,
  productId,
  layout = "grid",
  maxTags = 2,
  overviewStay,
  overviewRegion,
  overviewDuration,
  className,
  topPickLabel = "",
  experienceSummary = "",
  emphasizeFirstOnMobile = false,
  guideBridgeNarrowCopy = false,
  selectionHighlightLine = "",
  campaignPitchLine = "",
  campaignPresentationKind,
  seasonal_price_bands,
  highlightTag,
  emphasizeLandingHubHover = false,
  ctaLabelOptions,
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [consultPressed, setConsultPressed] = useState(false);
  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const infoDisplayChips = pickInfoDisplayChips(status, infoBadges);

  const campaignKind: CampaignCardKind = resolveCampaignCardKind({
    layout,
    analyticsSection: analyticsSection ?? null,
    presentationKind: campaignPresentationKind,
  });

  const visibleCampaignBadges = (() => {
    const sorted = [...badges]
      .filter((b) => b.isActive !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (layout === "list") return sorted.slice(0, 1);
    return sorted.slice(0, 2);
  })();

  const campaignPitch = campaignPitchLine?.trim() ?? "";

  const handleConsult = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const oneLine = oneLiner?.trim() ?? "";

  const isListLayout = layout === "list";
  const isRelatedLayout = layout === "related";
  const isStackLayout = layout === "stack";

  const highlightLabel = highlightTag ? PRODUCT_CARD_HIGHLIGHT_LABELS[highlightTag] : null;
  const hasPromotionOverlay = visibleCampaignBadges.some((b) => b.isPromotion);
  const overlayCampaignBadges =
    hasPromotionOverlay || !highlightLabel ? visibleCampaignBadges : [];
  const showHighlightPriceLine =
    Boolean(highlightLabel) && (isListLayout || isRelatedLayout);
  const useCompactSeasonalPrice = isRelatedLayout || isStackLayout;
  const seasonalBandInfo = getProductCardSeasonalBandInfo(seasonal_price_bands);

  const durationLabel = overviewDuration?.trim() || duration?.trim() || "";
  const topPick = topPickLabel?.trim() ?? "";
  const expLine = experienceSummary?.trim() ?? "";
  const expParts = expLine.split(/\s*·\s*/).filter(Boolean);
  const expLineMobileTwo =
    guideBridgeNarrowCopy && expParts.length > 0 ? expParts.slice(0, 2).join(" · ") : expLine;

  const selectionLine = selectionHighlightLine?.trim() ?? "";

  const priceMainClass = cn(
    "font-price-strong font-bold leading-tight text-[var(--primary)] tabular-nums",
    "text-xl md:text-2xl",
    isRelatedLayout &&
      (guideBridgeNarrowCopy ? "text-lg sm:text-xl md:text-2xl" : "text-base md:text-lg"),
  );

  const priceBlock = (() => {
    if (seasonalBandInfo && seasonal_price_bands) {
      if (useCompactSeasonalPrice) {
        const digits = getSeasonalCardCompactAmountDigits(seasonalBandInfo);
        return (
          <div className="space-y-0.5">
            <p className={priceMainClass}>{`최저 ₩${digits}~`}</p>
          </div>
        );
      }
      const mainLine = getSeasonalCardMainLineFull(seasonal_price_bands, seasonalBandInfo);
      return (
        <div className="space-y-0.5">
          <p className={priceMainClass}>{mainLine}</p>
          <p className="text-[10px] font-medium text-[var(--text-subtle)] sm:text-[11px]">
            {SEASONAL_CARD_SUBLINE}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {priceFormatted != null ? (
          <>
            <p className={priceMainClass}>
              {isRelatedLayout ? `₩${priceFormatted}~` : `${priceFormatted}원~`}
            </p>
            {priceMeta ? (
              <p className="text-[10px] font-medium text-[var(--text-subtle)] sm:text-[11px]">{priceMeta}</p>
            ) : null}
          </>
        ) : (
          <p className="font-semibold text-sm text-[var(--text-muted)]">상담 후 견적</p>
        )}
      </div>
    );
  })();

  const chipRow = (compact?: boolean) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {infoDisplayChips.map((chip) => (
        <span
          key={`${chip.variant}-${chip.label}`}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold leading-none shadow-sm backdrop-blur",
            compact ? "px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]" : "px-2 py-1 text-[11px]",
            infoDisplayChipSurfaceClass(chip.variant),
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );

  const titleBlock = (clamp: 1 | 2, size: "sm" | "md") => (
    <h2
      className={cn(
        "font-card-title font-semibold leading-snug text-[var(--text-primary)] break-words",
        clamp === 2 ? "line-clamp-2" : "line-clamp-1",
        size === "sm" ? "text-sm md:text-base" : "text-[13px] sm:text-sm sm:leading-snug",
      )}
    >
      {title || "상품명"}
    </h2>
  );

  /** 연관 상품 세로 카드 */
  const relatedCardContent = (
    <div className="flex h-full flex-col">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]">
        {(overlayCampaignBadges.length > 0 || highlightLabel || topPick) && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1">
            {overlayCampaignBadges.length > 0 ? (
              overlayCampaignBadges.map((b, i) => (
                <ProductCampaignBadge
                  key={`${b.label}-${i}`}
                  label={b.label}
                  isPrimary={true}
                  kind={campaignKind}
                  badgeTone={b.campaignTone}
                  size="md"
                  surface="overlay"
                  isPromotion={b.isPromotion}
                />
              ))
            ) : highlightLabel ? (
              <span
                className="inline-flex max-w-[min(100%,11rem)] shrink-0 truncate rounded-md bg-amber-500/95 px-2 py-1 text-[9px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30"
                title={highlightLabel}
              >
                {highlightLabel}
              </span>
            ) : (
              <>
                {topPick ? (
                  <span
                    className="inline-flex max-w-[min(100%,10rem)] shrink-0 truncate rounded bg-[var(--primary)]/92 px-1.5 py-[3px] text-[9px] font-semibold leading-tight text-[var(--on-primary)] shadow-sm ring-1 ring-black/5"
                    title={topPick}
                  >
                    {topPick}
                  </span>
                ) : null}
              </>
            )}
          </div>
        )}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes="(max-width: 768px) 78vw, 320px"
            className={cn("object-cover", CARD_TRANSITION, "group-hover:scale-[1.03]")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]" aria-hidden>
            <span className="text-xs font-medium">이미지 없음</span>
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 bg-[var(--surface-muted)]",
            CARD_TRANSITION,
            thumbnailUrl ? (imageLoaded ? "opacity-0" : "animate-pulse opacity-80") : "opacity-0",
          )}
          aria-hidden
        />
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col p-3",
          emphasizeFirstOnMobile && "max-sm:px-3.5 max-sm:pb-3.5 max-sm:pt-3",
        )}
      >
        {infoDisplayChips.length > 0 ? (
          <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1">
            {infoDisplayChips.map((chip) => (
              <span
                key={`info-${chip.variant}-${chip.label}`}
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm backdrop-blur sm:px-2 sm:py-1 sm:text-[11px]",
                  infoDisplayChipSurfaceClass(chip.variant),
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
        {guideBridgeNarrowCopy ? (
          <>
            {titleBlock(2, "sm")}
            {oneLine ? (
              <p className="mt-0.5 hidden text-[10px] leading-snug text-[var(--text-muted)] sm:block sm:line-clamp-1">
                {oneLine}
              </p>
            ) : null}
            <div className="mt-1.5">{priceBlock}</div>
            {showHighlightPriceLine ? (
              <p className="mt-1 line-clamp-1 text-[10px] text-slate-500 sm:text-[11px]">{highlightLabel}</p>
            ) : null}
            {campaignPitch ? (
              <p
                className="mt-1 line-clamp-2 text-[10px] font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1 sm:text-[11px]"
                title={campaignPitch}
              >
                {campaignPitch}
              </p>
            ) : null}
            {selectionLine ? (
              <p
                className={cn(
                  "truncate text-[10px] font-medium leading-snug text-[var(--foreground)]/78 sm:text-[11px]",
                  campaignPitch ? "mt-0.5" : "mt-1",
                )}
                title={selectionLine}
              >
                {selectionLine}
              </p>
            ) : null}
            <div className="mt-1 flex min-h-0 items-center justify-between gap-2">
              {durationLabel ? (
                <span className="max-w-[58%] truncate text-[9px] font-normal tracking-wide text-[var(--text-subtle)]/90 sm:max-w-[65%] sm:text-[10px]">
                  {durationLabel}
                </span>
              ) : (
                <span />
              )}
              <CardRatingBlock
                ratingAvg={ratingAvg}
                reviewCount={reviewCount}
                className="text-[10px] text-[var(--text-subtle)] sm:text-[11px]"
              />
            </div>
            {expLine ? (
              <>
                <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[var(--text-subtle)]/75 sm:hidden">
                  {expLineMobileTwo}
                </p>
                <p className="mt-0.5 hidden line-clamp-1 text-[10px] leading-snug text-[var(--text-subtle)]/75 sm:block">
                  {expLine}
                </p>
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="mb-1 flex items-start justify-between gap-2">
              {durationLabel ? (
                <span className="inline-flex w-fit max-w-[65%] truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {durationLabel}
                </span>
              ) : (
                <span />
              )}
              <CardRatingBlock ratingAvg={ratingAvg} reviewCount={reviewCount} />
            </div>
            {titleBlock(2, "sm")}
            {oneLine ? (
              <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-[var(--text-muted)]">{oneLine}</p>
            ) : null}
            <div className="mt-2">{priceBlock}</div>
            {showHighlightPriceLine ? (
              <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{highlightLabel}</p>
            ) : null}
            {campaignPitch ? (
              <p
                className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1"
                title={campaignPitch}
              >
                {campaignPitch}
              </p>
            ) : null}
            {expLine ? (
              <p
                className={cn(
                  "line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)] sm:line-clamp-1 sm:text-[11px]",
                  campaignPitch ? "mt-0.5" : "mt-1",
                )}
              >
                {expLine}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  const gridListCardContent = (
    <div className="flex min-h-[140px] w-full items-stretch">
      <div
        className={cn(
          "relative shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]",
          isListLayout
            ? "w-[38%] min-w-[180px] max-w-[280px]"
            : "w-[42%] min-w-[140px] max-w-[220px]",
        )}
      >
        {overlayCampaignBadges.length > 0 ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-start gap-1">
            {overlayCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`grid-camp-${b.label}-${i}`}
                label={b.label}
                isPrimary={true}
                kind={isListLayout ? "list" : "grid"}
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
                isPromotion={b.isPromotion}
              />
            ))}
          </div>
        ) : highlightLabel && !isListLayout ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)]">
            <span className="inline-flex max-w-[min(100%,11rem)] truncate rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30 sm:text-[11px]">
              {highlightLabel}
            </span>
          </div>
        ) : null}
        {isListLayout && highlightLabel ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)]">
            <span className="inline-flex max-w-[min(100%,11rem)] truncate rounded-md bg-amber-500/95 px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30">
              {highlightLabel}
            </span>
          </div>
        ) : null}
        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes={isListLayout ? "(max-width: 768px) 38vw, 280px" : "(max-width: 768px) 42vw, 220px"}
            className={cn("h-full w-full object-cover", CARD_TRANSITION, "group-hover:scale-[1.03]")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-[var(--text-muted)]"
            aria-hidden
          >
            <span className="text-[11px] font-medium">이미지 없음</span>
          </div>
        )}
        <div
          className={cn(
            "absolute inset-0 bg-[var(--surface-muted)]",
            CARD_TRANSITION,
            thumbnailUrl ? (imageLoaded ? "opacity-0" : "animate-pulse opacity-80") : "opacity-0",
          )}
          aria-hidden
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        {isListLayout && overlayCampaignBadges.length > 0 ? (
          <div
            className="mb-1.5 flex min-w-0 flex-wrap items-center gap-1.5"
            aria-label="기획 배지"
          >
            {overlayCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`list-inline-${b.label}-${i}`}
                label={b.label}
                isPrimary={true}
                kind="list"
                badgeTone={b.campaignTone}
                size="sm"
                surface="inline"
                isPromotion={b.isPromotion}
              />
            ))}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-2">
          {chipRow(false)}
          <CardRatingBlock ratingAvg={ratingAvg} reviewCount={reviewCount} className="pt-0.5" />
        </div>

        <div className="mt-1.5 min-w-0">{titleBlock(2, "sm")}</div>

        {oneLine ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)] md:text-xs">
            {oneLine}
          </p>
        ) : null}

        {metaLine ? (
          <p
            className={cn(
              "line-clamp-1 text-[11px] text-[var(--text-muted)]",
              oneLine ? "mt-0.5" : "mt-1",
            )}
          >
            {metaLine}
          </p>
        ) : null}

        <div className="mt-2">{priceBlock}</div>
        {showHighlightPriceLine ? (
          <p className="mt-1 line-clamp-1 text-xs text-slate-500">{highlightLabel}</p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-3">
          {tags.length > 0 ? (
            <div className="relative flex overflow-hidden">
              <div className="flex shrink-0 flex-nowrap gap-1.5 pr-8">
                {tags.slice(0, maxTags).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div
                className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
                aria-hidden
              />
            </div>
          ) : null}
          {onClickConsult ? (
            <span
              role="button"
              tabIndex={0}
              aria-disabled={consultPressed}
              className={cn(
                buttonVariants({ variant: "accent", size: "sm" }),
                "inline-flex w-fit !h-7 !px-2.5 !text-xs",
                consultPressed && "pointer-events-none opacity-60",
              )}
              onClick={handleConsult}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
              }}
            >
              {status === "SOLD_OUT" ? "대기 문의" : getProductCtaLabel(status, ctaLabelOptions)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  const cardContent: ReactNode = isRelatedLayout ? relatedCardContent : gridListCardContent;

  const wrapperClass = cn(
    "group flex h-full w-full overflow-hidden",
    CARD_TRANSITION,
    emphasizeLandingHubHover
      ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-strong)] hover:border-[var(--border-strong)]"
      : "hover:shadow-md hover:border-[var(--primary)]/30",
    isListLayout && "max-w-[1344px]",
    isRelatedLayout && "flex-col",
    emphasizeFirstOnMobile &&
      isRelatedLayout &&
      "max-sm:shadow-md max-sm:ring-1 max-sm:ring-[var(--primary)]/20",
  );

  if (hrefDetail) {
    const handleCardClick = () => {
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
        className={cn(
          "block h-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
          className,
        )}
        onClick={handleCardClick}
      >
        <Card variant="interactive" className={wrapperClass}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      className={cn(
        wrapperClass,
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
        className,
      )}
      role="button"
      tabIndex={0}
      onClick={onClickDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickDetail?.();
        }
      }}
    >
      {cardContent}
    </Card>
  );
}
