"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buttonVariants } from "@/components/ui/Button";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";

const TRANSITION = "transition-all duration-[220ms] ease-out";

export type ProductCardV2Status =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductCardV2Badge = {
  type: string;
  label: string;
  priority?: number;
  isActive?: boolean;
};

export type ProductCardV2Props = {
  title?: string;
  price?: number | string;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: ProductCardV2Status;
  badges?: ProductCardV2Badge[];
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
};

const STATUS_LABELS: Record<ProductCardV2Status, string> = {
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

export default function ProductCardV2({
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
}: ProductCardV2Props) {
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

  const tagVariantFromStatus = (s?: ProductCardV2Status): "accent" | "muted" | "gold" => {
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

  const topLeftChips = [statusChip, categoryChip, themeChip, ...badgeChips]
    .filter(
      (x): x is { label: string; variant: "accent" | "muted" | "gold" } => Boolean(x),
    )
    .filter((chip, index, arr) => {
      const key = `${chip.variant}-${chip.label}`;
      return arr.findIndex((c) => `${c.variant}-${c.label}` === key) === index;
    });

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");

  const cardContent = (
    <div className="flex min-h-[140px] w-full">
      {/* Image (Left) - 카드 높이 전체를 채우도록 변경 */}
      <div className="relative w-[44%] max-w-[220px] shrink-0 overflow-hidden bg-[var(--surface-muted)]">
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
            sizes="(max-width: 768px) 44vw, 220px"
            className={`h-full w-full object-cover ${TRANSITION} group-hover:scale-[1.02]`}
            loading="lazy"
            onLoadingComplete={() => setImageLoaded(true)}
          />
        ) : null}
        <div
          className={`absolute inset-0 bg-[var(--border)] ${TRANSITION} ${
            thumbnailUrl
              ? imageLoaded
                ? "opacity-0"
                : "animate-pulse opacity-100"
              : "animate-pulse"
          }`}
          aria-hidden
        />
      </div>

      {/* Content (Right) */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        {/* Title: 한 줄 + 오른쪽 그라데이션 페이드 */}
        <div className="relative min-h-[1.25rem] overflow-hidden">
          <h2 className="font-card-title line-clamp-1 pr-8 text-sm font-semibold leading-snug text-[var(--text-primary)] md:text-base">
            {title || "상품명"}
          </h2>
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
            aria-hidden
          />
        </div>

        {metaLine ? (
          <p className="line-clamp-1 text-xs text-[var(--text-muted)]">{metaLine}</p>
        ) : null}

        <div className="mt-0.5 space-y-0.5">
          {priceFormatted != null ? (
            <p className="font-price-strong text-lg font-bold text-[var(--primary)] md:text-xl">
              {priceFormatted}원~
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">상담 후 견적</p>
          )}
          {priceMeta ? <p className="text-[11px] text-[var(--text-subtle)]">{priceMeta}</p> : null}
        </div>

        {/* Hashtag: 한 줄 + 오른쪽 그라데이션 페이드 */}
        {tags.length > 0 ? (
          <div className="relative mt-auto flex overflow-hidden">
            <div className="flex shrink-0 flex-nowrap gap-1.5 pr-8">
              {tags.map((tag) => (
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
        ) : (
          <div className="mt-auto" />
        )}

        {/* Compact consult chip (optional) */}
        {onClickConsult ? (
          <div className="pt-1">
            <span
              role="button"
              tabIndex={0}
              aria-disabled={consultPressed}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} inline-flex !h-7 !px-2.5 !text-xs ${
                consultPressed ? "pointer-events-none opacity-60" : ""
              }`}
              onClick={handleConsult}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
              }}
            >
              {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const wrapperClass = `group flex h-full overflow-hidden rounded-2xl ${TRANSITION} hover:shadow-xl`;

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
      <Link href={hrefDetail} className="block h-full" onClick={handleCardClick}>
        <Card variant="elevated" className={wrapperClass}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="elevated"
      className={wrapperClass}
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
