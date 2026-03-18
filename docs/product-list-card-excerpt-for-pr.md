# 랜딩 하단 상품카드 구조 발췌 (PR 검토용)

목적: 랜딩 하단 전체상품 조회 섹션의 상품카드가 조잡해 보이는 원인 파악.  
카드 구조·데이터 주입 경로·공용 컴포넌트 사용 여부를 확인하기 위해 관련 파일 전체를 발췌함.

---

## 1) 데스크톱 상품목록 카드 컴포넌트 전체

### `src/components/products/ProductListCard.tsx`

```tsx
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
```

---

## 2) 모바일 상품목록 카드 컴포넌트 전체

### `src/components/products/ProductListCardMobile.tsx`

```tsx
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
```

참고: 모바일 카드는 `overviewStay` / `overviewRegion` / `overviewDuration` props를 받지 않음(ProductCardProps 타입 상에는 있으나 destructure에서 제외). 따라서 **숙소/지역/기간 3열 박스는 데스크톱 전용**이며, 모바일에는 제목·메타·가격·태그·상담 버튼만 노출됨.

---

## 3) 상품목록 카드에 데이터 넣는 상위 컴포넌트 전체

### `src/components/ProductCatalogSection.tsx`

```tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Product } from "@/types/product";
import ProductListCard from "@/components/products/ProductListCard";
import ProductListCardMobile from "@/components/products/ProductListCardMobile";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/ConsultModal";
import {
  getThemeTabs,
  groupProductsByTheme,
  matchesThemeTab,
  matchesProductTab,
  type ProductCategoryTabId,
} from "@/lib/productCategory";

type ProductCatalogSectionProps = {
  products: Product[];
  categories: string[];
  initialKeyword?: string;
  presetCategories?: string[];
  presetLabel?: string;
  initialRegion?: string | null;
  initialTheme?: string | null;
  onCategoryChange?: (region: string | null) => void;
  onThemeChange?: (theme: string | null) => void;
  onResetFilters?: () => void;
};

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

function matchesKeyword(product: Product, keyword: string) {
  if (!keyword) {
    return true;
  }

  const haystack = [product.title, product.description, product.category, product.theme ?? ""]
    .join(" ")
    .toLowerCase();

  const tokens = keyword
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.some((token) => haystack.includes(token));
}

export default function ProductCatalogSection({
  products,
  categories,
  initialKeyword = "",
  presetCategories,
  presetLabel,
  initialRegion,
  initialTheme,
  onCategoryChange,
  onThemeChange,
  onResetFilters,
}: ProductCatalogSectionProps) {
  const [internalTab, setInternalTab] = useState<ProductCategoryTabId>("all");
  const [internalThemeTab, setInternalThemeTab] = useState("전체");

  const isUrlControlled = onCategoryChange != null && onThemeChange != null;
  const activeTab: ProductCategoryTabId = isUrlControlled
    ? (initialRegion ?? "all")
    : internalTab;
  const activeThemeTab = isUrlControlled
    ? (initialTheme ?? "전체")
    : internalThemeTab;

  useEffect(() => {
    if (!isUrlControlled) return;
    setInternalTab(initialRegion ?? "all");
    setInternalThemeTab(initialTheme ?? "전체");
  }, [isUrlControlled, initialRegion, initialTheme]);

  const keyword = useMemo(() => normalizeSearchKeyword(initialKeyword), [initialKeyword]);
  const presetCategorySet = useMemo(
    () => new Set((presetCategories ?? []).map((item) => item.trim()).filter(Boolean)),
    [presetCategories],
  );
  const baseProducts = useMemo(
    () =>
      presetCategorySet.size > 0
        ? products.filter((product) => presetCategorySet.has(product.category))
        : products,
    [products, presetCategorySet],
  );
  const visibleCategories = useMemo(
    () => (presetCategorySet.size > 0 ? categories.filter((category) => presetCategorySet.has(category)) : categories),
    [categories, presetCategorySet],
  );
  const categoryTabs = useMemo(() => ["전체", ...visibleCategories], [visibleCategories]);
  const filteredProducts = useMemo(() => {
    if (isUrlControlled) return baseProducts;
    return baseProducts.filter((product) => matchesProductTab(product, activeTab));
  }, [baseProducts, activeTab, isUrlControlled]);
  const themeTabs = useMemo(() => {
    const inferred = getThemeTabs(baseProducts, activeTab);
    return Array.from(new Set(["전체", ...inferred.slice(1)]));
  }, [baseProducts, activeTab]);
  const themeFilteredProducts = useMemo(() => {
    if (isUrlControlled) return filteredProducts;
    return filteredProducts.filter((product) => matchesThemeTab(product, activeThemeTab));
  }, [filteredProducts, activeThemeTab, isUrlControlled]);
  const keywordFilteredProducts = useMemo(
    () =>
      (isUrlControlled ? filteredProducts : themeFilteredProducts).filter((product) =>
        matchesKeyword(product, keyword),
      ),
    [isUrlControlled, filteredProducts, themeFilteredProducts, keyword],
  );
  const groupedByTheme = useMemo(
    () => groupProductsByTheme(keywordFilteredProducts, themeTabs),
    [keywordFilteredProducts, themeTabs],
  );
  const displayGroups = useMemo(
    () =>
      groupedByTheme.length > 0
        ? groupedByTheme
        : keywordFilteredProducts.length > 0
          ? [{ theme: "기타", products: keywordFilteredProducts }]
          : [],
    [groupedByTheme, keywordFilteredProducts],
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();

  function handleProductConsult(product: Product) {
    const isMobile =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (isMobile) {
      const query = searchParams.toString();
      openModal({
        productId: product.id,
        productTitle: product.title,
        sourcePath: query ? `${pathname}?${query}` : pathname,
      });
      return;
    }
    router.push(`/quote?productId=${encodeURIComponent(product.id)}`);
  }

  return (
    <section className="space-y-4">
      <div className="sticky top-[76px] z-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5 backdrop-blur sm:rounded-xl sm:px-3 sm:py-3">
        <div className="space-y-1">
          <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-sm">
            총 {keywordFilteredProducts.length}건 · 현재 카테고리 {activeTab === "all" ? "전체" : activeTab}
          </p>
          {presetLabel ? <p className="text-xs leading-snug text-[#15803d] sm:text-sm">필터: {presetLabel}</p> : null}
          {keyword ? (
            <p className="text-xs leading-snug text-[var(--primary)] sm:text-sm">검색어: {initialKeyword}</p>
          ) : null}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {categoryTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              if (isUrlControlled && onCategoryChange) {
                onCategoryChange(tab === "전체" ? null : tab);
                return;
              }
              setInternalTab(tab === "전체" ? "all" : tab);
              setInternalThemeTab("전체");
            }}
            className={`min-h-[32px] rounded-full px-3 py-1.5 text-sm font-medium transition ${
              (tab === "전체" ? "all" : tab) === activeTab
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {themeTabs.map((tab) => (
          <button
            key={`theme-${tab}`}
            type="button"
            onClick={() => {
              if (isUrlControlled && onThemeChange) {
                onThemeChange(tab === "전체" ? null : tab);
                return;
              }
              setInternalThemeTab(tab);
            }}
            className={`min-h-[28px] rounded-full px-2.5 py-1 text-xs font-semibold transition sm:min-h-[32px] sm:px-3 sm:py-1.5 sm:text-sm ${
              activeThemeTab === tab
                ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tab}
          </button>
        ))}
        </div>
      </div>

      <div key={`${activeTab}-${activeThemeTab}`} className="fade-in-up space-y-5">
        {keywordFilteredProducts.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface)] p-8 type-small text-[var(--text-muted)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
            {(initialRegion || initialTheme || (initialKeyword && initialKeyword.trim())) && onResetFilters ? (
              <>
                <p className="font-semibold text-[var(--text-primary)]">선택한 조건에 맞는 상품이 없습니다.</p>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {[initialRegion && `지역: ${initialRegion}`, initialTheme && `테마: ${initialTheme}`, initialKeyword?.trim() && `키워드: ${initialKeyword.trim()}`].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href="/products"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90"
                  >
                    전체 상품 보기
                  </Link>
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    필터 초기화
                  </button>
                </div>
              </>
            ) : keyword ? (
              "검색어와 일치하는 상품이 없습니다."
            ) : (
              "선택한 카테고리에 해당하는 상품이 없습니다."
            )}
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.theme} className="space-y-3">
              <h3 className="font-card-title type-h3 text-[var(--primary)]">{group.theme}</h3>
              <div className="flex w-full max-w-[1344px] flex-col gap-4 md:gap-5">
                {group.products.map((product) => {
                  const cardProps = productToProductCardProps(product, {
                    analyticsSource: "product_list",
                    analyticsSection: "catalog",
                    onClickDetail: () => router.push(`/products/${product.id}`),
                    onClickConsult: () => handleProductConsult(product),
                  });

                  return (
                    <div key={product.id} className="w-full">
                      {/* Desktop */}
                      <div className="hidden md:block">
                        <ProductListCard {...cardProps} />
                      </div>

                      {/* Mobile */}
                      <div className="md:hidden">
                        <ProductListCardMobile {...cardProps} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

요약:
- **랜딩 하단**과 **`/products` 본문** 모두 `ProductCatalogSection` 한 컴포넌트를 사용함.
- 카드 렌더 조건: `keywordFilteredProducts.length > 0`일 때만 `displayGroups`를 순회하며, 각 상품마다 `productToProductCardProps(product, { analyticsSource: "product_list", analyticsSection: "catalog", ... })`로 props를 만들고, **동일한** `ProductListCard` / `ProductListCardMobile`에 그대로 넘김.
- **variant 분리 지점**: 현재는 `analyticsSection: "catalog"`만 넘기고, 카드 컴포넌트는 진입 경로(랜딩 vs /products)를 구분하지 않음. 분리하려면 `ProductCatalogSection`에 props(예: `cardVariant?: "catalog" | "landing"`)를 추가하고, `productToProductCardProps` 또는 카드 컴포넌트에 해당 값을 전달하는 방식이 필요함.

---

## 4) 카드 props 변환/가공 로직 전체

### `src/lib/productCardProps.ts`

```ts
import type { Product } from "@/types/product";
import type { ProductCardBadge, ProductCardProps, ProductCardStatus } from "@/components/products/ProductCard";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { getPrimaryImageUrl } from "@/lib/products/images";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

/**
 * Product → ProductCard badges (테마/카테고리 배지).
 * SearchResults, RelatedProductsSection, ProductCatalogSection, CuratedBlock 등에서 공통 사용.
 */
export function buildProductCardBadges(product: Product): ProductCardBadge[] {
  const themeBadges = getProductBadges(product);
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type ProductToProductCardOverrides = Partial<
  Pick<ProductCardProps, "layout" | "analyticsSource" | "analyticsSection" | "onClickDetail" | "onClickConsult">
>;

/**
 * Product → ProductCard에 넘길 공통 props.
 * CuratedBlock, SearchResults, RelatedProductsSection, ProductCatalogSection, guides 등에서 재사용.
 */
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> & ProductToProductCardOverrides {
  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  const isRelatedSection = overrides?.analyticsSection === "related_products";
  const baseBadges = buildProductCardBadges(product);
  const relatedBadges: ProductCardBadge[] = [
    ...baseBadges,
    ...(product.is_popular ? [{ type: "accent", label: "인기", priority: 10, isActive: true }] : []),
    ...(product.is_recommend ? [{ type: "accent", label: "추천", priority: 9, isActive: true }] : []),
  ];
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: isRelatedSection ? relatedBadges : baseBadges,
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta ?? "1인 기준",
    metaInfo: product.meta_info ?? "",
    overviewStay: product.overview_accommodation?.trim() || product.meta_info?.trim() || "",
    overviewRegion: product.overview_region?.trim() || product.theme?.trim() || product.category?.trim() || "",
    overviewDuration: product.overview_duration?.trim() || product.duration?.trim() || "",
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    ...overrides,
    ...(isRelatedSection ? { layout: "related" as const, badges: relatedBadges } : {}),
  };
}
```

요약:
- **랜딩 하단**에서는 `analyticsSection: "catalog"`만 넘기므로 `isRelatedSection`은 false. 따라서 `badges`는 `baseBadges`만 사용되고, `overviewStay` / `overviewRegion` / `overviewDuration`은 Product 필드에서 그대로 채워짐.
- 랜딩 하단에서 “덜어낼” 정보를 결정하는 곳은 **여기서가 아니라 카드 컴포넌트 내부**임. 현재는 목록용 카드(ProductListCard/ProductListCardMobile)가 항상 동일한 props를 받아 **숙소/지역/기간 박스·태그·버튼 2개**를 같은 조건으로 그리므로, “랜딩 하단만 가볍게” 하려면 (1) `productToProductCardProps`에서 진입 경로/용도에 따라 overview·tags 등을 비우거나, (2) 카드 쪽에 variant를 두고 랜딩 하단일 때 해당 블록을 숨기는 방식이 필요함.

---

## 5) 공용 상품카드 컴포넌트 전체 (grid / list / related)

### `src/components/products/ProductCard.tsx`

**전체 원문**은 동일 내용을 `docs/product-card-full-source.tsx` 에 복사해 두었습니다. (생략 없이 복사 가능)

- **ProductCard**는 `layout`: `"grid"` | `"list"` | `"related"` 를 받음.
- **ProductCatalogSection**에서는 **ProductCard를 쓰지 않고**, **ProductListCard** / **ProductListCardMobile** 만 사용함.
- 랜딩 추천 상품(ProductLandingPage 등)에서는 **ProductCard** + **ProductCardGridSection** 조합으로 `layout="grid"` 사용.
- 따라서:
  - **`/products` 본문 및 랜딩 하단 전체상품 조회** → `ProductListCard` / `ProductListCardMobile` (목록 전용, 3열 그리드·숙소/지역/기간 박스·버튼 2개 포함).
  - **랜딩 추천 상품·홈 추천 등** → `ProductCard` (grid/related 등).

즉, **랜딩 하단 “전체 상품 보기” 섹션**은 **목록용 카드(ProductListCard 계열)**와 동일한 구조/밀도로 렌더링되고 있음.

---

## 6) 상품목록 카드 스타일에 영향을 주는 유틸/타입

### `src/components/ui/Card.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "elevated" | "hero" | "interactive";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

export function Card({ variant = "default", className, ...props }: CardProps) {
  let variantClass: string;

  switch (variant) {
    case "elevated":
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-soft-strong)]";
      break;
    case "hero":
      variantClass =
        "rounded-3xl bg-[var(--theall-primary-navy)] text-[var(--site-text-primary)] " +
        "shadow-xl ring-1 ring-[var(--site-border)]";
      break;
    case "interactive":
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] " +
        "transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";
      break;
    case "default":
    default:
      variantClass =
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";
      break;
  }

  return <div className={cn(variantClass, className)} {...props} />;
}
```

### `src/lib/cardTokens.ts`

```ts
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";

export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";

export const CARD_TRANSITION = "transition-all duration-200 ease-out";

export const CARD_PADDING = "p-4";
export const CARD_PADDING_HOME = "px-3 pt-2 pb-3 sm:p-4";
export const CARD_PADDING_RELAXED = "p-5";
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";
export const CARD_IMAGE_ASPECT_HOME = "aspect-[16/9] md:aspect-[4/3]";
export const CARD_GRID_GAP = "gap-4";
export const CARD_GRID_GAP_RELAXED = "gap-6";
```

### `src/components/ui/Button.tsx` — buttonVariants 부분

```ts
export function buttonVariants(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = options ?? {};
  const base =
    "inline-flex items-center justify-center rounded-xl type-btn transition-all duration-150 " +
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] " +
    "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed " +
    "active:translate-y-px";
  const sizeClass =
    size === "sm"
      ? "h-9 min-h-9 px-3"
      : size === "lg"
        ? "min-h-[52px] px-6 py-3"
        : "min-h-[44px] px-4 py-2.5";
  // variantClass: primary, secondary, kakao, ghost, outline
  // ...
  return cn(base, sizeClass, variantClass, className);
}
```

### `src/types/product.ts` — 카드에 직접 쓰이는 필드만 발췌

- `id`, `title`, `description`, `image_url`, `images_json`, `category`, `theme`, `destination_id`, `product_line_id`, `price`, `duration`, `meta_title`, `meta_info`, `price_meta`, `status`, `is_recommend`, `is_popular`, `overview_accommodation`, `overview_region`, `overview_duration` 등이 productCardProps/카드에 매핑됨.

(전체 타입 정의는 이미 앞에서 읽은 product.ts 전체와 동일하므로 여기서는 생략.)

---

## 7) ProductCardGridSection (랜딩 추천 상품용 그리드)

### `src/components/products/ProductCardGridSection.tsx`

```tsx
"use client";

import * as React from "react";

export type ProductCardGridSectionProps = {
  children: React.ReactNode;
  className?: string;
  desktopGridCols?: 2 | 3;
};

export function ProductCardGridSection({
  children,
  className,
  desktopGridCols = 3,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 sm:hidden">
          {items.map((item, i) => (
            <div key={i} className="min-w-[78%] max-w-[320px] shrink-0">
              {item}
            </div>
          ))}
        </div>
        <div
          className={
            desktopGridCols === 2
              ? "hidden sm:grid sm:grid-cols-2 lg:grid-cols-2 sm:gap-4"
              : "hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4"
          }
        >
          {items}
        </div>
      </div>
    </div>
  );
}
```

- 랜딩 추천 상품은 **ProductCard** + **ProductCardGridSection** 사용.
- 랜딩 하단 “전체 상품 보기”는 **ProductCatalogSection** → **ProductListCard** / **ProductListCardMobile** 사용.
- 따라서 **같은 base 컴포넌트를 공유하지 않음**. 목록용 카드와 랜딩 추천 카드는 서로 다른 컴포넌트이며, 랜딩 하단은 목록용 카드와 **완전히 동일한 구조/밀도**로 렌더링됨.

---

## 8) 검토 목적에 대한 정리

1. **`/products` 본문 카드와 랜딩 하단 카드가 완전히 동일한가?**  
   → **예.** 둘 다 `ProductCatalogSection` → `productToProductCardProps(product, { analyticsSource: "product_list", analyticsSection: "catalog", ... })` → `ProductListCard` / `ProductListCardMobile` 이며, 동일한 props·동일한 UI.

2. **랜딩 하단 전용 카드 variant 추가가 맞는가?**  
   → **가능함.** “랜딩 하단만 더 단순한 카드”를 원하면, `ProductCatalogSection`에 `cardVariant="landing"` 같은 props를 추가하고, 이 값을 `productToProductCardProps` 또는 카드 컴포넌트에 넘겨, 랜딩 하단일 때만 숙소/지역/기간 박스·태그·버튼 구성을 줄이는 방식이 적합함.

3. **기존 카드에서 정보 밀도만 줄이는 게 맞는가?**  
   → **목적에 따라.** “목록 페이지는 그대로 두고, 랜딩 하단만 가볍게”라면 variant 분리가 맞고, “전체 목록 카드를 다 가볍게”라면 ProductListCard/ProductListCardMobile에서 공통으로 밀도만 낮추면 됨.

4. **숙소/지역/기간 박스, 해시태그, 버튼 2개 중 조잡함의 핵심은?**  
   - **데스크톱 ProductListCard**: 3열 그리드(이미지 280px | 본문 | 가격+CTA 200px) + 이미지 위 칩 3개 + 본문에 **숙소/지역/기간 3개 박스** + **해시태그** + **자세히 보기 / 상담 문의 버튼 2개**.  
   - 랜딩 하단은 “탐색용”인데, 같은 비교용 목록 카드가 그대로 쓰이면 **정보량·버튼 수**가 많아져 조잡해 보일 수 있음.  
   - **핵심 후보**: (1) **숙소/지역/기간 3열 박스** (데스크톱만, 데이터가 비어 있으면 "-"로 채워져 시각적으로 무거움), (2) **해시태그 줄**, (3) **버튼 2개(자세히 보기 + 상담 문의)**.

5. **최소 수정 범위로 톤을 정리할 수 있는 지점**  
   - **옵션 A**: `ProductCatalogSection`에서 “랜딩 하단” 여부를 prop으로 받고, `productToProductCardProps`에 `compactForLanding?: boolean` 등을 넘겨, `overviewStay`/`overviewRegion`/`overviewDuration`를 빈 문자열로 덮고, `maxTags=0` 등으로 태그를 끄고, 카드 쪽에서 “상담 문의” 버튼만 두는 등 **데이터/표시만 조절**.  
   - **옵션 B**: ProductListCard/ProductListCardMobile에 `variant="compact"` 를 도입해, `variant === "compact"`일 때 숙소/지역/기간 블록·태그·자세히 보기 버튼 중 일부를 숨기고, 랜딩 하단에서만 해당 variant를 넘김.  
   - **옵션 C**: 랜딩 하단에서는 아예 **ProductCard** + **ProductCardGridSection** 조합으로 바꾸고, `layout="grid"` 또는 새로운 `layout="landing"`으로 더 단순한 카드만 노출. (구조 변경·데이터 경로 변경이 커짐.)

이 문서는 위 1~7의 파일 내용을 복사 가능한 형태로 모은 것이며, PR 시 “현재 카드 구조와 데이터 주입 경로” 검토용으로 사용하시면 됩니다.
