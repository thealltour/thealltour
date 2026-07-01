"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { Star } from "lucide-react";
import type { Product } from "@/types/product";
import type { ProductCardStatus } from "@/components/products/ProductCard";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { buildProductCardInfoBadges, CAMPAIGN_BADGE_MAX, resolveProductCardOverlayBadges, shouldOmitCampaignPitchForCard } from "@/lib/productCardProps";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct } from "@/lib/productCampaignPresentation";
import { ProductCampaignBadge } from "@/components/products/ProductCampaignBadge";
import { infoDisplayChipSurfaceClass, pickInfoDisplayChips } from "@/lib/productCardSignals";
import {
  getProductCardSeasonalBandInfo,
  getSeasonalCardMainLineFull,
  SEASONAL_CARD_SUBLINE,
} from "@/lib/products/productCardSeasonalPriceDisplay";
import {
  pickProductCardHighlightTag,
  PRODUCT_CARD_HIGHLIGHT_LABELS,
} from "@/lib/products/productCardHighlightTag";

export type HomeProductCardProps = {
  product: Product;
  /** 미지정 시 `/products/[id]` */
  href?: string;
  className?: string;
  /** 홈 큐레이션 카드 클릭 계측 section */
  analyticsSection?: string;
  /** grid: 기존(모바일 16:9). rail: 레일 전용 4:3 고정 */
  variant?: "grid" | "rail";
};

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";

function formatReviewCount(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

/** one_liner 없을 때만 보조 한 줄 (ProductCard meta와 유사 역할) */
function buildSubMetaLine(product: Product): string {
  const meta = product.meta_info?.trim();
  if (meta) return meta.length > 52 ? `${meta.slice(0, 49)}…` : meta;
  const dur = product.duration?.trim();
  if (dur) return dur;
  if (product.status === "AVAILABLE") return "예약 가능";
  if (product.status === "LIMITED") return "잔여 한정";
  return "";
}

/**
 * 홈 큐레이션 전용 고밀도 카드.
 * 시선 순서: 배지 → 평점(sm+) → 지역 → 제목 → one_liner(sm+) → 가격.
 * 모바일 2열: 이미지·지역·제목·가격 우선, 칩 1개·평점·원라이너는 sm 이상에서 복원.
 */
export function HomeProductCard({
  product,
  href,
  className,
  analyticsSection,
  variant = "grid",
}: HomeProductCardProps) {
  const resolvedHref = (href?.trim() || `/products/${product.id}`).trim();
  const titleText = product.title?.trim() || "상품";

  const rawImage = getPrimaryImageUrl(product);
  const normalized = rawImage?.trim() ? normalizeProductImageUrl(rawImage.trim()) : "";
  const imageSrc = normalized || PLACEHOLDER_IMAGE;

  const highlightTag = useMemo(() => pickProductCardHighlightTag(product), [product]);
  const highlightLabel = highlightTag ? PRODUCT_CARD_HIGHLIGHT_LABELS[highlightTag] : null;

  const visibleCampaignBadges = useMemo(
    () =>
      buildCampaignRepresentativeBadges(product, { max: CAMPAIGN_BADGE_MAX.home }).filter(
        (b) => b.isActive !== false,
      ),
    [product],
  );
  const overlayCampaignBadges = useMemo(
    () => resolveProductCardOverlayBadges(visibleCampaignBadges, highlightTag),
    [visibleCampaignBadges, highlightTag],
  );
  const infoDisplayChips = useMemo(() => {
    const st = (product.status ?? "AVAILABLE") as ProductCardStatus;
    return pickInfoDisplayChips(st, buildProductCardInfoBadges(product));
  }, [product]);
  const campaignPitch = useMemo(
    () =>
      shouldOmitCampaignPitchForCard(highlightTag, visibleCampaignBadges, false)
        ? undefined
        : buildCampaignPitchLineFromProduct(product, "home"),
    [product, highlightTag, visibleCampaignBadges],
  );

  const ratingAvg = product.trust?.ratingAvg;
  const reviewCount = product.trust?.reviewCount;
  const showRating =
    typeof ratingAvg === "number" &&
    Number.isFinite(ratingAvg) &&
    ratingAvg > 0 &&
    typeof reviewCount === "number" &&
    Number.isFinite(reviewCount) &&
    reviewCount > 0;

  const price = product.price;
  const hasNumericPrice = typeof price === "number" && Number.isFinite(price) && price > 0;
  const priceFormatted = hasNumericPrice ? formatPriceKR(price) : null;
  const priceMetaLine = product.price_meta?.trim() || "1인 기준";
  const seasonalBandInfo = getProductCardSeasonalBandInfo(product.seasonal_price_bands);

  const regionLabel =
    product.overview_region?.trim() ||
    product.category?.trim() ||
    product.theme?.trim() ||
    "";

  const oneLine = product.one_liner?.trim() ?? "";
  const subMeta = !oneLine ? buildSubMetaLine(product) : "";

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
        "group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-2xl",
        variant === "rail" ? "h-full w-full flex-1" : "h-full",
        CARD_HOVER,
        CARD_TRANSITION,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        className,
      )}
    >
      {/* 모바일 2열: 이미지 높이 축소(16:9), sm+ 기존 4:3 / rail: 항상 4:3 */}
      <div
        className={cn(
          "relative w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]",
          variant === "rail" ? "aspect-[4/3]" : "aspect-video sm:aspect-[4/3]",
        )}
      >
        {overlayCampaignBadges.length > 0 ? (
          <div className="absolute left-1.5 top-1.5 z-10 flex max-w-[calc(100%-0.75rem)] flex-wrap items-start gap-1 sm:left-2 sm:top-2">
            {overlayCampaignBadges.map((b, i) => (
              <ProductCampaignBadge
                key={`camp-${b.label}-${i}`}
                label={b.label}
                isPrimary={true}
                kind="home"
                badgeTone={b.campaignTone}
                size="md"
                surface="overlay"
                isPromotion={b.isPromotion}
              />
            ))}
          </div>
        ) : highlightLabel ? (
          <div className="absolute left-1.5 top-1.5 z-10 max-w-[calc(100%-0.75rem)] sm:left-2 sm:top-2">
            <span className="inline-flex max-w-[min(100%,11rem)] truncate rounded-md bg-amber-500/95 px-2 py-1 text-[9px] font-bold leading-tight text-white shadow-sm ring-1 ring-amber-600/30 sm:text-[10px]">
              {highlightLabel}
            </span>
          </div>
        ) : null}
        <Image
          src={imageSrc}
          alt={titleText}
          fill
          sizes="(max-width: 640px) 46vw, 360px"
          className="object-cover transition duration-200 ease-out group-hover:scale-[1.02]"
        />
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-col gap-1 px-2.5 py-2 sm:gap-1.5 sm:px-4 sm:py-4",
          variant === "rail" ? "min-h-0 flex-1" : "flex-1",
        )}
      >
        <div className="flex items-start justify-between gap-1.5 sm:gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {infoDisplayChips.map((chip, i) => (
              <span
                key={`${chip.variant}-${chip.label}`}
                className={cn(
                  "inline-flex max-w-full truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm sm:px-2 sm:py-1 sm:text-[11px]",
                  i >= 1 && "hidden sm:inline-flex",
                  infoDisplayChipSurfaceClass(chip.variant),
                )}
              >
                {chip.label}
              </span>
            ))}
          </div>
          {showRating ? (
            <p className="hidden shrink-0 items-center gap-0.5 tabular-nums text-xs text-[var(--text-muted)] sm:inline-flex sm:gap-1 sm:text-sm">
              <Star
                className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400 sm:h-3.5 sm:w-3.5"
                strokeWidth={0}
                aria-hidden
              />
              <span>{ratingAvg!.toFixed(1)}</span>
              <span>({formatReviewCount(reviewCount!)})</span>
            </p>
          ) : null}
        </div>

        {regionLabel ? (
          <p className="line-clamp-1 text-xs font-medium text-[var(--text-muted)] sm:text-sm">
            {regionLabel}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--foreground)] sm:text-base sm:leading-snug">
          {titleText}
        </h3>

        {campaignPitch ? (
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-[var(--primary)] sm:line-clamp-1 sm:text-sm">
            {campaignPitch}
          </p>
        ) : null}

        {oneLine ? (
          <p className="hidden line-clamp-1 text-xs leading-snug text-[var(--text-muted)] sm:block sm:text-sm">
            {oneLine}
          </p>
        ) : subMeta ? (
          <p className="hidden line-clamp-1 text-xs text-[var(--text-muted)] sm:block sm:text-sm">{subMeta}</p>
        ) : null}

        <div className="mt-auto border-t border-[var(--border)]/60 pt-1.5 sm:border-0 sm:pt-1">
          {seasonalBandInfo && product.seasonal_price_bands ? (
            <>
              <p className="line-clamp-2 text-sm font-bold leading-tight text-[var(--primary)] tabular-nums sm:text-base sm:leading-snug md:text-lg">
                {getSeasonalCardMainLineFull(product.seasonal_price_bands, seasonalBandInfo)}
              </p>
              <p className="mt-0.5 text-xs leading-tight text-[var(--text-muted)] sm:text-sm">
                {SEASONAL_CARD_SUBLINE}
              </p>
            </>
          ) : priceFormatted ? (
            <>
              <p className="text-base font-bold leading-tight text-[var(--primary)] tabular-nums sm:text-lg">
                ₩{priceFormatted}~
              </p>
              {priceMetaLine ? (
                <p className="mt-0.5 text-xs leading-tight text-[var(--text-muted)] sm:text-sm">
                  {priceMetaLine}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-base font-bold leading-tight text-[var(--text-muted)] sm:text-lg">
              상담 후 견적
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
