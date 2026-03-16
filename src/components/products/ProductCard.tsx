"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buttonVariants } from "@/components/ui/Button";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

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

export type ProductCardLayout = "grid" | "list" | "related";

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
  /** 상품 카드 클릭 계측용 (선택). 설정 시 클릭 시 product_card_click 전송 */
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  /** 계측 시 사용할 상품 ID (analyticsSource 설정 시 권장) */
  productId?: string;
  /** grid: 홈/검색/추천. list: 상품 목록 1열. related: 상세 하단 추천용 세로 카드(이미지 상단, 기간·가격 강조) */
  layout?: ProductCardLayout;
  /** 태그 최대 노출 개수 (기본 3). 과밀 방지 */
  maxTags?: number;
  /** 여행 오버뷰: 숙소 (/products 카드용) */
  overviewStay?: string;
  /** 여행 오버뷰: 지역 (/products 카드용) */
  overviewRegion?: string;
  /** 여행 오버뷰: 기간 (/products 카드용) */
  overviewDuration?: string;
};

const STATUS_LABELS: Record<ProductCardStatus, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function badgeTypeToTagVariant(
  type: string
): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천") return "accent";
  if (t === "gold" || t === "제철" || t === "마감임박") return "gold";
  return "muted";
}

function badgeVariantToChipStyle(variant: "accent" | "muted" | "gold") {
  if (variant === "accent") {
    return "border-blue-200 bg-blue-600/95 text-white";
  }
  if (variant === "gold") {
    return "border-amber-200 bg-amber-500/95 text-white";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]";
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
  analyticsSource,
  analyticsSection,
  productId,
  layout = "grid",
  maxTags = 3,
  overviewStay,
  overviewRegion,
  overviewDuration,
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
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );
  const activeBadges = sortedBadges.filter((b) => b.isActive !== false);

  const tagVariantFromStatus = (s?: ProductCardStatus): "accent" | "muted" | "gold" => {
    if (!s) return "muted";
    if (s === "AVAILABLE") return "accent";
    if (s === "LIMITED") return "gold";
    return "muted";
  };

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

  const statusChip =
    status != null ? { label: STATUS_LABELS[status], variant: tagVariantFromStatus(status) } : null;
  const categoryChip = categories[0]?.trim() ? { label: categories[0].trim(), variant: "muted" as const } : null;
  const themeChip = region?.trim() ? { label: region.trim(), variant: "muted" as const } : null;
  const badgeChips = activeBadges.slice(0, 1).map((b) => ({
    label: b.label,
    variant: badgeTypeToTagVariant(b.type),
  }));

  /** 우선순위: status → 지역/카테고리 1개 → 뱃지 1개, 최대 3개 */
  const topLeftChipsRaw = [statusChip, categoryChip ?? themeChip, ...badgeChips]
    .filter(
      (x): x is { label: string; variant: "accent" | "muted" | "gold" } => Boolean(x),
    )
    .filter((chip, index, arr) => {
      const key = `${chip.variant}-${chip.label}`;
      return arr.findIndex((c) => `${c.variant}-${c.label}` === key) === index;
    });
  const topLeftChips = topLeftChipsRaw.slice(0, 3);

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const isListLayout = layout === "list";
  const isRelatedLayout = layout === "related";

  /** PR36: 추천 상품 전용 세로 카드 (이미지 상단, 기간·가격 강조, 인기/추천 배지) */
  const durationLabel = overviewDuration?.trim() || duration?.trim() || "";
  const relatedCardContent = (
    <div className="flex h-full flex-col">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--surface-muted)]">
        {activeBadges.length > 0 && (
          <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
            {activeBadges.slice(0, 2).map((b) => (
              <span
                key={b.label}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm",
                  badgeVariantToChipStyle(badgeTypeToTagVariant(b.type)),
                )}
              >
                {b.label}
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
            thumbnailUrl
              ? imageLoaded
                ? "opacity-0"
                : "animate-pulse opacity-80"
              : "opacity-0",
          )}
          aria-hidden
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {durationLabel ? (
          <span className="mb-1.5 inline-flex w-fit rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {durationLabel}
          </span>
        ) : null}
        <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>
        <div className="mt-2">
          {priceFormatted != null ? (
            <>
              <p className="font-price-strong text-base font-bold leading-tight text-[var(--primary)] md:text-lg">
                ₩{priceFormatted}~
              </p>
              {priceMeta ? (
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">{priceMeta}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">상담 후 견적</p>
          )}
        </div>
      </div>
    </div>
  );

  const cardContent = isRelatedLayout ? relatedCardContent : (
    <div className="flex min-h-[140px] w-full items-stretch">
      {/* Left: thumbnail. 카드 높이에 맞춰 stretch (object-cover로 채움) */}
      <div
        className={cn(
          "relative shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]",
          isListLayout
            ? "w-[38%] min-w-[180px] max-w-[280px]"
            : "w-[42%] min-w-[140px] max-w-[220px]",
        )}
      >
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {topLeftChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none shadow-sm backdrop-blur ${badgeVariantToChipStyle(chip.variant)}`}
            >
              {chip.label}
            </span>
          ))}
        </div>

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
            thumbnailUrl
              ? imageLoaded
                ? "opacity-0"
                : "animate-pulse opacity-80"
              : "opacity-0",
          )}
          aria-hidden
        />
      </div>

      {/* 우측 본문: 상단 정보 → 가격 → 하단(태그/자세히 보기/상담) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        {/* 1. 상단: 제목 + 메타 */}
        <div className="min-w-0">
          <div className={cn("relative overflow-hidden", isListLayout ? "min-h-[1.5rem]" : "min-h-[1.5rem]")}>
            <h2
              className={cn(
                "font-card-title pr-8 text-sm font-semibold leading-snug text-[var(--text-primary)] break-words md:text-base",
                "line-clamp-1",
              )}
            >
              {title || "상품명"}
            </h2>
            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
              aria-hidden
            />
          </div>
          {metaLine ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-muted)]">{metaLine}</p>
          ) : null}
        </div>

        {/* 2. 가격 블록 */}
        <div className="mt-2 space-y-0.5">
          {priceFormatted != null ? (
            <>
              <p className="font-price-strong text-xl font-bold leading-tight text-[var(--primary)] md:text-2xl">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="text-[10px] font-medium text-[var(--text-subtle)]">{priceMeta}</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">상담 후 견적</p>
          )}
        </div>

        {/* 3. 하단: 태그 + 자세히 보기 + 상담 버튼 */}
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
          {hrefDetail ? (
            <div className="flex justify-end">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--primary)] opacity-90 group-hover:opacity-100" aria-hidden>
                자세히 보기
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          ) : null}
          {onClickConsult ? (
            <span
              role="button"
              tabIndex={0}
              aria-disabled={consultPressed}
              className={cn(
                buttonVariants({ variant: "primary", size: "sm" }),
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
        className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
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
      className={cn(wrapperClass, "outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2")}
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
