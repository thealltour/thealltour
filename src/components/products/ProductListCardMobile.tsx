"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { buttonVariants } from "@/components/ui/Button";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import type {
  ProductCardProps,
  ProductCardStatus,
} from "@/components/products/ProductCard";

export type ProductListCardMobileProps = ProductCardProps;

const STATUS_LABELS: Record<ProductCardStatus, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function badgeTypeToTagVariant(
  type: string,
): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천")
    return "accent";
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

const MOBILE_MAX_BADGES = 3;
const MOBILE_MAX_TAGS = 2;

export default function ProductListCardMobile({
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
}: ProductListCardMobileProps) {
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

  const tagVariantFromStatus = (
    s?: ProductCardStatus,
  ): "accent" | "muted" | "gold" => {
    if (!s) return "muted";
    if (s === "AVAILABLE") return "accent";
    if (s === "LIMITED") return "gold";
    return "muted";
  };

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

  const statusChip =
    status != null
      ? { label: STATUS_LABELS[status], variant: tagVariantFromStatus(status) }
      : null;
  const categoryChip = categories[0]?.trim()
    ? { label: categories[0].trim(), variant: "muted" as const }
    : null;
  const themeChip = region?.trim()
    ? { label: region.trim(), variant: "muted" as const }
    : null;
  const badgeChips = activeBadges.slice(0, 1).map((b) => ({
    label: b.label,
    variant: badgeTypeToTagVariant(b.type),
  }));

  const topLeftChipsRaw = [statusChip, categoryChip ?? themeChip, ...badgeChips]
    .filter(
      (x): x is { label: string; variant: "accent" | "muted" | "gold" } =>
        Boolean(x),
    )
    .filter((chip, index, arr) => {
      const key = `${chip.variant}-${chip.label}`;
      return arr.findIndex((c) => `${c.variant}-${c.label}` === key) === index;
    });
  const topLeftChips = topLeftChipsRaw.slice(0, MOBILE_MAX_BADGES);

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const displayTags = tags.slice(0, MOBILE_MAX_TAGS);

  const cardContent = (
    <div className="flex min-h-[148px] w-full">
      {/* 좌측: 이미지 + 배지 */}
      <div className="relative w-[34%] min-w-[112px] max-w-[136px] shrink-0 self-stretch overflow-hidden bg-[var(--surface-muted)]">
        <div className="absolute left-1.5 top-1.5 z-10 flex flex-wrap gap-0.5">
          {topLeftChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm backdrop-blur ${badgeVariantToChipStyle(chip.variant)}`}
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

      {/* 우측: 제목 / 메타 / 가격 / 태그 / CTA */}
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>
        {metaLine ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-muted)]">
            {metaLine}
          </p>
        ) : null}
        <div className="mt-2">
          {priceFormatted != null ? (
            <>
              <p className="text-xl font-bold leading-tight text-[var(--primary)]">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="mt-0.5 text-[10px] font-medium text-[var(--text-subtle)]">
                  {priceMeta}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">
              상담 후 견적
            </p>
          )}
        </div>
        {displayTags.length > 0 ? (
          <div className="mt-2 flex flex-nowrap gap-1 overflow-hidden">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        {onClickConsult ? (
          <button
            type="button"
            disabled={consultPressed}
            className={cn(
              buttonVariants({ variant: "primary", size: "sm" }),
              "mt-2 w-full",
              consultPressed && "pointer-events-none",
            )}
            onClick={handleConsultClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
            }}
          >
            {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
          </button>
        ) : null}
      </div>
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
