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
import { displayChipSurfaceClass, pickDisplayChips } from "@/lib/productCardSignals";

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
  badges?: ProductCardBadge[];
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
}: ProductCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [consultPressed, setConsultPressed] = useState(false);
  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const sortedBadges = [...badges].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  const activeBadges = sortedBadges.filter((b) => b.isActive !== false);
  const displayChips = pickDisplayChips(status, activeBadges);

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

  const durationLabel = overviewDuration?.trim() || duration?.trim() || "";

  const priceBlock = (
    <div className="space-y-0.5">
      {priceFormatted != null ? (
        <>
          <p
            className={cn(
              "font-price-strong font-bold leading-tight text-[var(--primary)] tabular-nums",
              "text-xl md:text-2xl",
              isRelatedLayout && "text-base md:text-lg",
            )}
          >
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

  const chipRow = (compact?: boolean) => (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {displayChips.map((chip) => (
        <span
          key={`${chip.variant}-${chip.label}`}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold leading-none shadow-sm backdrop-blur",
            compact ? "px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px]" : "px-2 py-1 text-[11px]",
            displayChipSurfaceClass(chip.variant),
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
        {displayChips.length > 0 && (
          <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {displayChips.map((chip) => (
              <span
                key={`${chip.variant}-${chip.label}`}
                className={cn(
                  "inline-flex max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm",
                  displayChipSurfaceClass(chip.variant),
                )}
              >
                {chip.label}
              </span>
            ))}
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
      <div className="flex min-h-0 flex-1 flex-col p-3">
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
              {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
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
    "hover:shadow-md hover:border-[var(--primary)]/30",
    isListLayout && "max-w-[1344px]",
    isRelatedLayout && "flex-col",
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
