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

export type ProductListCardProps = ProductCardProps;

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

export default function ProductListCard({
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
  overviewStay = "",
  overviewRegion = "",
  overviewDuration = "",
  analyticsSource,
  analyticsSection,
  productId,
  maxTags = 3,
}: ProductListCardProps) {
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
  const topLeftChips = topLeftChipsRaw.slice(0, 3);

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const displayTags = tags.slice(0, maxTags);

  const cardContent = (
    <div className="grid w-full grid-cols-[280px_minmax(0,1fr)_200px]">
      {/* 좌측: 이미지 + 배지 */}
      <div className="relative h-full min-h-[220px] overflow-hidden rounded-l-2xl bg-[var(--surface-muted)]">
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

      {/* 중앙: 제목 / 메타 / 오버뷰 / 태그 */}
      <div className="flex min-w-0 flex-col gap-3 p-5">
        <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-[var(--text-primary)]">
          {title || "상품명"}
        </h2>
        {metaLine ? (
          <p className="text-sm text-[var(--text-muted)]">{metaLine}</p>
        ) : null}
        {(overviewStay || overviewRegion || overviewDuration) && (
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">숙소</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                {overviewStay || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">지역</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                {overviewRegion || "-"}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <p className="text-xs text-[var(--text-muted)]">기간</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                {overviewDuration || "-"}
              </p>
            </div>
          </div>
        )}
        {displayTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* 우측: 가격 + 가격 기준 + CTA */}
      <div className="flex h-full flex-col justify-between border-l border-[var(--border)] p-5">
        <div>
          {priceFormatted != null ? (
            <>
              <p className="text-2xl font-bold text-[var(--primary)]">
                {priceFormatted}원~
              </p>
              {priceMeta ? (
                <p className="text-xs text-[var(--text-subtle)]">
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
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
            onClick={handleDetailButtonClick}
          >
            자세히 보기
          </button>
          {onClickConsult ? (
            <button
              type="button"
              disabled={consultPressed}
              className={cn(
                buttonVariants({ variant: "primary", size: "md" }),
                "w-full",
                consultPressed && "pointer-events-none",
              )}
              onClick={handleConsultClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ")
                  handleConsultKey(e);
              }}
            >
              {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const cardClassName = cn(
    "group w-full cursor-pointer overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
    CARD_TRANSITION,
    "hover:shadow-md hover:border-[var(--primary)]/30",
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
