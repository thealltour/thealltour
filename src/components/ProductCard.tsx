"use client";

import Image from "next/image";
import Link from "next/link";
import { Scale, Bookmark, Check, Info } from "lucide-react";
import Tag from "@/components/ui/Tag";

export type ProductCardTag = {
  label: string;
  variant: "accent" | "muted" | "gold";
};

export type ProductCardProps = {
  href: string;
  imageUrl: string;
  imageAlt: string;
  tags?: ProductCardTag[];
  title: string;
  description: string;
  price?: number;
  duration?: string;
  priceMeta?: string;
  fuelSurchargeIncluded?: boolean;
  hashtags?: string[];
  ctaLabel?: string;
  onCompareAdd?: (e: React.MouseEvent) => void;
  onBookmark?: (e: React.MouseEvent) => void;
  showCompareButton?: boolean;
  showBookmarkButton?: boolean;
};

const TRANSITION = "transition-all duration-[250ms] ease-out";

export default function ProductCard({
  href,
  imageUrl,
  imageAlt,
  tags = [],
  title,
  description,
  price,
  duration,
  priceMeta = "1인 기준",
  fuelSurchargeIncluded,
  hashtags = [],
  ctaLabel = "상세 보기",
  onCompareAdd,
  onBookmark,
  showCompareButton = false,
  showBookmarkButton = false,
}: ProductCardProps) {
  const handleActionClick = (e: React.MouseEvent, fn?: (e: React.MouseEvent) => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn?.(e);
  };

  const priceFormatted =
    typeof price === "number" ? new Intl.NumberFormat("ko-KR").format(price) : null;

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col overflow-hidden rounded-3xl bg-[var(--card)] shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] ${TRANSITION} hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-strong)]`}
    >
      {/* ImageArea */}
      <div className="relative h-52 w-full overflow-hidden">
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={900}
          height={560}
          sizes="(max-width: 768px) 100vw, 50vw"
          loading="lazy"
          className={`h-full w-full object-cover ${TRANSITION} group-hover:scale-[1.03]`}
        />
        {/* 비교 추가 / 북마크: 우측 상단 액션 영역 */}
        {(showCompareButton || showBookmarkButton) && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            {showCompareButton && (
              <button
                type="button"
                onClick={(e) => handleActionClick(e, onCompareAdd)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--glass-surface)] text-[var(--text-secondary)] shadow-sm backdrop-blur hover:bg-[var(--surface)] hover:text-[var(--primary)]"
                aria-label="비교 추가"
              >
                <Scale className="h-4 w-4" />
              </button>
            )}
            {showBookmarkButton && (
              <button
                type="button"
                onClick={(e) => handleActionClick(e, onBookmark)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--glass-surface)] text-[var(--text-secondary)] shadow-sm backdrop-blur hover:bg-[var(--surface)] hover:text-[var(--primary)]"
                aria-label="찜하기"
              >
                <Bookmark className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* BadgeRow */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag.label} variant={tag.variant} size="sm">
                {tag.label}
              </Tag>
            ))}
          </div>
        )}

        {/* Title */}
        <h2 className="font-card-title type-body font-semibold text-content-primary md:type-small line-clamp-2">
          {title}
        </h2>

        {/* MetaInfo */}
        <p className="line-clamp-1 type-small leading-6 text-content-secondary">{description}</p>

        {/* PriceBlock */}
        <div className="space-y-1">
          {priceFormatted !== null && (
            <p className="font-price-strong type-body font-bold text-[#1E3A8A]">
              ₩{priceFormatted}~
            </p>
          )}
          {(duration || priceMeta) && (
            <p className="type-caption text-[var(--text-muted)]">
              {[duration, priceMeta].filter(Boolean).join(" / ")}
            </p>
          )}
          {typeof fuelSurchargeIncluded === "boolean" && (
            <p className="type-caption flex items-center gap-1.5 text-[var(--text-muted)]">
              {fuelSurchargeIncluded ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                  유류할증료 포함
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                  유류할증료 별도
                </>
              )}
            </p>
          )}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <span key={tag} className="type-caption text-[var(--text-secondary)]">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <span
          className={`type-btn mt-auto inline-flex w-fit rounded-lg bg-[var(--primary)] px-4 py-2 text-white ${TRANSITION} group-hover:bg-[var(--primary-hover)] group-hover:shadow-[var(--shadow-soft-strong)]`}
        >
          {ctaLabel}
        </span>
      </div>
    </Link>
  );
}
