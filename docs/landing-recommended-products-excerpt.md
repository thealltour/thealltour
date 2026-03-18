# 지역별/테마별 페이지 하단 "추천 상품" 섹션 코드 발췌

데스크톱에서 하단 추천 상품 카드가 작게 보이는 문제 해결을 위해,  
카드 구조·그리드 배치·이미지·텍스트 비율·너비 제어 방식을 파악할 수 있도록 관련 파일 전체를 발췌했습니다.  
요약 없이 **전체 복사 가능** 형태로 작성했습니다.

---

## 1) 추천 상품 섹션을 렌더링하는 페이지 컴포넌트

### 1-1. 지역별 페이지 (하단 추천 상품은 공용 랜딩 컴포넌트에서 렌더)

**파일 경로:** `src/app/products/region/[slug]/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getTaxonomyNameBySlug, getHubDestinations } from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import SiteHeader from "@/components/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type RegionLandingProps = {
  params: Promise<{ slug: string }>;
};

/** 카드 이미지 미설정 시 해당 지역 상품 대표 이미지로 채움. */
function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        (p.destination_id === d.id ||
          p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()),
    );
    if (first?.image_url?.trim()) {
      map.set(d.id, first.image_url.trim());
      map.set(d.name.trim().toLowerCase(), first.image_url.trim());
    }
  }
  return map;
}

/**
 * 지역 랜딩: /products/region/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?region={name} redirect.
 */
export default async function ProductsRegionSlugPage({ params }: RegionLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "region", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("category", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    let dataWithChildren = landingData;
    const [allDestinations, products] = await Promise.all([
      getHubDestinations(),
      getProducts(),
    ]);
    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allDestinations.find(
      (d) =>
        (d.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        d.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childDestinations = allDestinations
        .filter((d) => (d.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildDestinationFallbackImageMap(childDestinations, products);
      const childDestinationsWithImages = childDestinations.map((d) => {
        const cardImageUrl =
          d.card_image_url?.trim() ||
          fallbackMap.get(d.id) ||
          fallbackMap.get(d.name.trim().toLowerCase()) ||
          undefined;
        return { ...d, card_image_url: cardImageUrl ?? d.card_image_url };
      });
      dataWithChildren = { ...landingData, childDestinations: childDestinationsWithImages };
    }
    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage data={dataWithChildren} />
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?region=${encodeURIComponent(name)}`);
}
```

---

### 1-2. 테마별 페이지 (하단 추천 상품은 공용 랜딩 컴포넌트에서 렌더)

**파일 경로:** `src/app/products/theme/[slug]/page.tsx`

```tsx
import { redirect } from "next/navigation";
import {
  getTaxonomyNameBySlug,
  getHubThemes,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProductLandingData } from "@/lib/productLanding";
import { getProducts } from "@/lib/products";
import ProductLandingPage from "@/components/products/landing/ProductLandingPage";
import SiteHeader from "@/components/SiteHeader";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

type ThemeLandingProps = {
  params: Promise<{ slug: string }>;
};

/** 카드 이미지 미설정 시 해당 테마 상품 대표 이미지로 채움. */
function buildThemeFallbackImageMap(
  themes: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of themes) {
    const nameLower = t.name.trim().toLowerCase();
    if (map.has(nameLower)) continue;
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        parseThemeTokens(p.theme).map((x) => x.trim().toLowerCase()).includes(nameLower),
    );
    if (first?.image_url?.trim()) map.set(nameLower, first.image_url.trim());
  }
  return map;
}

/**
 * 테마 랜딩: /products/theme/[slug]
 * 랜딩 데이터가 유효하면 새 랜딩 UI 렌더, 아니면 기존대로 /products?theme={name} redirect.
 */
export default async function ProductsThemeSlugPage({ params }: ThemeLandingProps) {
  const { slug } = await params;
  const trimmedSlug = slug?.trim();
  if (!trimmedSlug) {
    redirect("/products");
  }

  const landingData = await getProductLandingData({ type: "theme", slug: trimmedSlug });
  const name = await getTaxonomyNameBySlug("theme", trimmedSlug);

  if (landingData && landingData.taxonomyName && landingData.hero?.primaryCtaHref) {
    let dataWithChildren = landingData;
    const [allThemes, products] = await Promise.all([
      getHubThemes(),
      getProducts(),
    ]);
    const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
    const parent = allThemes.find(
      (t) =>
        (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
        t.name?.trim() === landingData.taxonomyName,
    );
    if (parent) {
      const parentId = parent.id.trim();
      const childThemes = allThemes
        .filter((t) => (t.parent_id ?? "").trim() === parentId)
        .sort((a, b) => {
          const sa = a.sort_order ?? 9999;
          const sb = b.sort_order ?? 9999;
          if (sa !== sb) return sa - sb;
          return (a.name ?? "").localeCompare(b.name ?? "", "ko");
        });
      const fallbackMap = buildThemeFallbackImageMap(childThemes, products);
      const childThemesWithImages = childThemes.map((t) => {
        const nameKey = t.name.trim().toLowerCase();
        const cardImageUrl =
          t.card_image_url?.trim() ||
          fallbackMap.get(nameKey) ||
          undefined;
        return { ...t, card_image_url: cardImageUrl ?? t.card_image_url };
      });
      dataWithChildren = { ...landingData, childThemes: childThemesWithImages };
    }
    return (
      <>
        <SiteHeader activeTab="products" />
        <ProductLandingPage data={dataWithChildren} />
      </>
    );
  }

  if (!name) {
    redirect("/products");
  }
  redirect(`/products?theme=${encodeURIComponent(name)}`);
}
```

---

### 1-3. 공용 랜딩 페이지 (추천 상품 섹션 포함)

**파일 경로:** `src/components/products/landing/ProductLandingPage.tsx`

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ProductLandingData, ProductLandingProductSummary } from "@/types/productLanding";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { trackLandingCtaClick } from "@/lib/analytics/trackLandingCta";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";

export type ProductLandingPageProps = {
  data: ProductLandingData;
};

function getLandingCtaPayload(data: ProductLandingData, section: "hero" | "recommended_products" | "bottom_cta") {
  return {
    landingType: data.type,
    taxonomySlug: data.taxonomySlug ?? data.slug ?? null,
    taxonomyName: data.taxonomyName ?? null,
    section,
  };
}

export default function ProductLandingPage({ data }: ProductLandingPageProps) {
  const { hero, featuredLinks, recommendedProducts, relatedTaxonomies, type, taxonomyName, productCount, childDestinations, childThemes } = data;

  /** 동일 id 중복 제거 (React key 충돌 방지) */
  const uniqueRecommendedProducts = useMemo(() => {
    const seen = new Set<string>();
    return recommendedProducts.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [recommendedProducts]);

  const relatedTitle = type === "region" ? "함께 살펴볼 테마" : "함께 살펴볼 지역";
  const relatedDescription =
    type === "region"
      ? `${taxonomyName} 여행과 함께 많이 찾는 테마를 둘러보세요.`
      : `${taxonomyName} 테마로 많이 찾는 지역을 확인해보세요.`;
  const bottomCtaTitle =
    type === "region"
      ? `${taxonomyName} 여행을 찾고 계신가요?`
      : `${taxonomyName} 중심 일정이 필요하신가요?`;
  const moreProductsLabel = type === "region" ? "이 지역 상품 더 보기" : "이 테마 상품 더 보기";

  const basePayload = getLandingCtaPayload(data, "hero");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] text-[var(--text-primary)]">
      <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 sm:py-10 md:px-10 md:py-14">
        <div className="flex flex-col gap-10">
          {/* Hero: 이미지 있으면 배경 히어로, 없으면 카드 스타일 */}
          {hero.imageUrl ? (
            <HeroVisual
              imageUrl={hero.imageUrl}
              priority
              contentClassName="max-w-[680px] gap-2"
            >
              {hero.eyebrow ? (
                <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{hero.eyebrow}</p>
              ) : null}
              <h1 className="hero-text-shadow-title text-2xl font-bold leading-tight text-white sm:text-3xl">
                {hero.title}
              </h1>
              {hero.description ? (
                <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                  {hero.description}
                </p>
              ) : null}
              {productCount > 0 ? (
                <p className="inline-flex w-fit rounded-lg border border-white/25 bg-black/20 px-2.5 py-1 text-sm text-white/90 backdrop-blur-sm">
                  총 {productCount}개 상품
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={hero.primaryCtaHref}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.primaryCtaLabel,
                      href: hero.primaryCtaHref,
                    })
                  }
                >
                  {hero.primaryCtaLabel}
                </Link>
                {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                  <Link
                    href={hero.secondaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-white/60 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...basePayload,
                        section: "hero",
                        label: hero.secondaryCtaLabel!,
                        href: hero.secondaryCtaHref!,
                      })
                    }
                  >
                    {hero.secondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </HeroVisual>
          ) : (
          <section className="rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:p-8">
            {hero.eyebrow ? (
              <p className="text-sm font-semibold text-[var(--text-muted)]">{hero.eyebrow}</p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{hero.title}</h1>
            {hero.description ? (
              <p className="mt-3 text-[var(--text-muted)] sm:text-base">{hero.description}</p>
            ) : null}
            {productCount > 0 ? (
              <p className="mt-2 text-sm text-[var(--text-muted)]">총 {productCount}개 상품</p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={hero.primaryCtaHref}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() =>
                  trackLandingCtaClick({
                    ...basePayload,
                    section: "hero",
                    label: hero.primaryCtaLabel,
                    href: hero.primaryCtaHref,
                  })
                }
              >
                {hero.primaryCtaLabel}
              </Link>
              {hero.secondaryCtaLabel && hero.secondaryCtaHref ? (
                <Link
                  href={hero.secondaryCtaHref}
                  className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  onClick={() =>
                    trackLandingCtaClick({
                      ...basePayload,
                      section: "hero",
                      label: hero.secondaryCtaLabel!,
                      href: hero.secondaryCtaHref!,
                    })
                  }
                >
                  {hero.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          </section>
          )}

          {/* 도시·지역 선택 (region 랜딩이고 소분류가 있을 때만) */}
          {type === "region" && childDestinations && childDestinations.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">도시·지역 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 도시·지역을 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => (
                  <li key={d.id}>
                    <HubBrowseCard
                      item={d}
                      href={getDestinationLandingHref(d)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 세부 테마 선택 (theme 랜딩이고 하위 테마가 있을 때만) */}
          {type === "theme" && childThemes && childThemes.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">세부 테마 선택</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">원하는 테마를 선택해 보세요.</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => (
                  <li key={t.id}>
                    <HubBrowseCard
                      item={t}
                      href={getThemeLandingHref(t)}
                      showImage={true}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 바로가기 링크 묶음 */}
          {featuredLinks.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-[var(--text-muted)]">바로가기</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {featuredLinks.slice(0, 4).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 추천 상품 그리드 */}
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">추천 상품</h2>
              {productCount > 0 && uniqueRecommendedProducts.length > 0 ? (
                <p className="text-sm text-[var(--text-muted)]">현재 {productCount}개 상품을 확인할 수 있습니다.</p>
              ) : null}
            </div>
            {uniqueRecommendedProducts.length === 0 ? (
              <div className="mt-3 space-y-4">
                <p className="rounded-xl bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                  현재 준비된 추천 상품이 없습니다. 전체 상품 목록에서 더 많은 상품을 확인해보세요.
                </p>
                <div className="flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...getLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: "전체 상품 보기",
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    전체 상품 보기
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <ProductCardGridSection>
                  {uniqueRecommendedProducts.map((item) => (
                    <ProductCard
                      key={item.id}
                      layout="grid"
                      title={item.title}
                      price={item.price ?? undefined}
                      region={item.themes?.join(", ")}
                      categories={item.categories ?? []}
                      status="AVAILABLE"
                      thumbnailUrl={item.imageUrl ?? ""}
                      hrefDetail={item.href}
                      analyticsSource="landing"
                      analyticsSection={`${data.type}_${data.taxonomySlug ?? data.slug ?? ""}`}
                      productId={item.id}
                    />
                  ))}
                </ProductCardGridSection>
                <div className="mt-4 flex justify-end">
                  <Link
                    href={hero.primaryCtaHref}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)] sm:px-5"
                    onClick={() =>
                      trackLandingCtaClick({
                        ...getLandingCtaPayload(data, "recommended_products"),
                        section: "recommended_products",
                        label: moreProductsLabel,
                        href: hero.primaryCtaHref,
                      })
                    }
                  >
                    {moreProductsLabel}
                  </Link>
                </div>
              </>
            )}
          </section>

          {/* 관련 taxonomy 링크 */}
          {relatedTaxonomies.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[var(--foreground)]">{relatedTitle}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{relatedDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {relatedTaxonomies.slice(0, 6).map((link) => (
                  <Link
                    key={link.key}
                    href={link.href}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 하단 전환 CTA */}
          <section className="rounded-2xl bg-[var(--surface)] p-6 text-center ring-1 ring-[var(--border)] sm:p-8">
            <h2 className="text-lg font-bold text-[var(--foreground)]">{bottomCtaTitle}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              원하시는 일정/예산/출발 시기에 맞춰 맞춤 상담을 받아보세요.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={hero.primaryCtaHref}
                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() =>
                  trackLandingCtaClick({
                    ...getLandingCtaPayload(data, "bottom_cta"),
                    section: "bottom_cta",
                    label: "전체 상품 보기",
                    href: hero.primaryCtaHref,
                  })
                }
              >
                전체 상품 보기
              </Link>
              <Link
                href="/quote"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                onClick={() =>
                  trackLandingCtaClick({
                    ...getLandingCtaPayload(data, "bottom_cta"),
                    section: "bottom_cta",
                    label: "맞춤 상담 문의",
                    href: "/quote",
                  })
                }
              >
                맞춤 상담 문의
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
```

---

## 2) 추천 상품 카드 컴포넌트

### 2-1. 공용 상품 카드 (추천 상품에서 layout="grid" 로 사용)

**파일 경로:** `src/components/products/ProductCard.tsx`

(전체 332줄 — 아래는 그대로 복사용 전체 코드입니다.)

```tsx
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
  hrefDetail?: string;
  onClickDetail?: () => void;
  onClickConsult?: () => void;
  priceMeta?: string;
  metaInfo?: string;
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  productId?: string;
  layout?: ProductCardLayout;
  maxTags?: number;
  overviewStay?: string;
  overviewRegion?: string;
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
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
```

---

### 2-2. 카드 래퍼 UI (Card)

**파일 경로:** `src/components/ui/Card.tsx`

```tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "elevated" | "hero" | "interactive";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

/** bg=--surface, border=--border, shadow=--shadow-soft, radius 16px. interactive: hover 시 shadow-soft-strong + border-strong */
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

---

## 3) 추천 상품 리스트 / 그리드 래퍼

**파일 경로:** `src/components/products/ProductCardGridSection.tsx`

```tsx
"use client";

import * as React from "react";

export type ProductCardGridSectionProps = {
  /** 카드 목록 (보통 ProductCard 컴포넌트들). key는 각 카드에 부여해야 함. */
  children: React.ReactNode;
  className?: string;
};

/**
 * /recommended와 동일한 상품 카드 노출 방식.
 * - 모바일: 가로 스크롤 (카드당 min-w-[78%] max-w-[320px])
 * - 데스크톱: 그리드 2열(sm) / 3열(lg), 최대 너비 1344px
 * 메인 홈 추천, /recommended, 검색 결과, 랜딩, 가이드 관련 상품 등에서 공통 사용.
 */
export function ProductCardGridSection({
  children,
  className,
}: ProductCardGridSectionProps) {
  const items = React.Children.toArray(children);

  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="mx-auto w-full max-w-[1344px]">
        {/* 모바일: 가로 스크롤 */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 sm:hidden">
          {items.map((item, i) => (
            <div
              key={i}
              className="min-w-[78%] max-w-[320px] shrink-0"
            >
              {item}
            </div>
          ))}
        </div>
        {/* 데스크톱: 그리드 2열 → 3열 */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          {items}
        </div>
      </div>
    </div>
  );
}
```

---

## 4) 스타일 및 클래스 유틸

### 4-1. 카드 토큰 (비율·갭·트랜지션 등)

**파일 경로:** `src/lib/cardTokens.ts`

```ts
/**
 * 유저 페이지 공통 카드 시각 토큰.
 * 홈/목록/상세 카드·섹션에서 일관된 rounded, shadow, ring, hover, padding 사용.
 *
 * PR26: 홈 카드 디자인 시스템 통합.
 * 기준 = 지역별 카드 섹션(HomeTaxonomyGrid). 테마/추천상품 카드와 공통 규칙 적용.
 */

/** 카드 wrapper 기본: 배경·테두리·그림자·라운드 */
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";

/** 카드 hover 시 강조 (링크/버튼 카드용) */
export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";

/** 카드 전환 */
export const CARD_TRANSITION = "transition-all duration-200 ease-out";

/** 카드 내부 패딩 - 기본 */
export const CARD_PADDING = "p-4";

/** 홈 카드 본문 패딩: 지역 카드 기준. 모바일 px-3 pt-2 pb-3, sm 이상 p-4 */
export const CARD_PADDING_HOME = "px-3 pt-2 pb-3 sm:p-4";

/** 카드 내부 패딩 - 여유 */
export const CARD_PADDING_RELAXED = "p-5";

/** 카드 이미지 영역 공통 */
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";

/** 홈 카드 이미지 비율: 지역/테마와 동일. 16:9(모바일), 4:3( md 이상) */
export const CARD_IMAGE_ASPECT_HOME = "aspect-[16/9] md:aspect-[4/3]";

/** 그리드 갭 - 카드 간격 */
export const CARD_GRID_GAP = "gap-4";

/** 그리드 갭 - 여유 */
export const CARD_GRID_GAP_RELAXED = "gap-6";
```

### 4-2. className 유틸 (cn)

**파일 경로:** `src/lib/cn.ts`

```ts
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
```

---

## 5) 데이터 바인딩

### 5-1. 추천 상품 데이터 타입 정의

**파일 경로:** `src/types/productLanding.ts`

```ts
/**
 * 랜딩 페이지용 타입 (region/theme).
 * 후속 PR에서 실제 랜딩 UI가 이 shape를 소비.
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type ProductLandingType = "region" | "theme";

export type ProductLandingHero = {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export type ProductLandingFeaturedLink = {
  key: string;
  label: string;
  href: string;
};

export type ProductLandingProductSummary = {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | number | null;
  href: string;
  categories?: string[];
  themes?: string[];
};

export type ProductLandingData = {
  type: ProductLandingType;
  slug: string;
  taxonomyName: string;
  taxonomySlug: string | null;
  hero: ProductLandingHero;
  featuredLinks: ProductLandingFeaturedLink[];
  recommendedProducts: ProductLandingProductSummary[];
  relatedTaxonomies: ProductLandingFeaturedLink[];
  productCount: number;
  childDestinations?: ProductTaxonomy[];
  childThemes?: ProductTaxonomy[];
};
```

### 5-2. 추천 상품 데이터 매핑·선택 로직 (가격, href, 뱃지/상태는 카드에서 고정)

**파일 경로:** `src/lib/productLanding.ts`

```ts
/**
 * 랜딩 페이지용 데이터 로더 (region/theme).
 * 기존 redirect는 유지하고, 후속 PR에서 page가 이 로더를 사용해 실제 랜딩 UI로 전환할 수 있도록 준비.
 * TODO: 후속 PR-34~36에서 taxonomy id 기반 매칭으로 전환 시 문자열(name) 의존 축소 가능.
 */

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { getProducts } from "@/lib/products";
import { getTaxonomyNameBySlug, getActiveTaxonomiesForHeader, parseThemeTokens } from "@/lib/productTaxonomies";
import { getHomeCuratedData } from "@/lib/homeCurated";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type {
  ProductLandingData,
  ProductLandingHero,
  ProductLandingFeaturedLink,
  ProductLandingProductSummary,
  ProductLandingType,
} from "@/types/productLanding";

const RECOMMENDED_MAX = 8;

/** region = category name 일치, theme = theme 토큰에 name 포함. /products 필터와 동일 기준. */
function matchProductsByTaxonomyName(
  products: Product[],
  type: ProductLandingType,
  taxonomyName: string,
): Product[] {
  const name = taxonomyName.trim();
  if (!name) return [];
  if (type === "region") {
    return products.filter((p) => (p.category ?? "").trim() === name);
  }
  return products.filter((p) => parseThemeTokens(p.theme).includes(name));
}

/** Product → 랜딩 카드용 요약. null/undefined 안전 처리. */
export function toLandingProductSummary(product: Product): ProductLandingProductSummary {
  const id = product.id ?? "";
  const title = product.title ?? "상품명 미정";
  const description = product.description ?? null;
  const imageUrl = product.image_url ?? null;
  const price = product.price != null ? product.price : null;
  const href = id ? `/products/${encodeURIComponent(id)}` : "/products";
  const categories = product.category ? [product.category] : [];
  const themes = product.theme ? parseThemeTokens(product.theme) : [];
  return {
    id,
    title,
    imageUrl,
    description,
    price,
    href,
    categories,
    themes,
  };
}

/** hero 문구/CTA 계산형 생성. taxonomy에 landing_title·landing_description 있으면 우선 사용. */
function buildLandingHero(
  type: ProductLandingType,
  taxonomyName: string,
  _slug: string,
  taxonomy?: ProductTaxonomy | null,
): ProductLandingHero {
  const primaryCtaHref =
    type === "region"
      ? `/products?region=${encodeURIComponent(taxonomyName)}`
      : `/products?theme=${encodeURIComponent(taxonomyName)}`;
  const defaultTitle =
    type === "region" ? `${taxonomyName} 여행 추천` : `${taxonomyName} 테마 추천`;
  const defaultDescription =
    type === "region"
      ? `${taxonomyName} 중심으로 둘러보는 추천 상품을 한곳에서 확인해보세요.`
      : `${taxonomyName} 성격의 여행 상품을 모아 비교해보세요.`;
  const imageUrl =
    taxonomy?.hero_image_url?.trim() || taxonomy?.card_image_url?.trim() || null;
  if (type === "region") {
    return {
      eyebrow: "지역별 여행",
      title: taxonomy?.landing_title?.trim() || defaultTitle,
      description: taxonomy?.landing_description?.trim() || defaultDescription,
      imageUrl: imageUrl || undefined,
      primaryCtaLabel: "전체 상품 보기",
      primaryCtaHref,
      secondaryCtaLabel: "맞춤 상담 문의",
      secondaryCtaHref: "/quote",
    };
  }
  return {
    eyebrow: "테마별 여행",
    title: taxonomy?.landing_title?.trim() || defaultTitle,
    description: taxonomy?.landing_description?.trim() || defaultDescription,
    imageUrl: imageUrl || undefined,
    primaryCtaLabel: "전체 상품 보기",
    primaryCtaHref,
    secondaryCtaLabel: "맞춤 상담 문의",
    secondaryCtaHref: "/quote",
  };
}

function buildLandingFeaturedLinks(type: ProductLandingType, taxonomyName: string): ProductLandingFeaturedLink[] {
  const baseHref =
    type === "region"
      ? `/products?region=${encodeURIComponent(taxonomyName)}`
      : `/products?theme=${encodeURIComponent(taxonomyName)}`;
  return [
    { key: "all", label: "전체 상품 보기", href: baseHref },
    { key: "popular", label: "인기순", href: `${baseHref}&sort=popular` },
    { key: "new", label: "신규순", href: `${baseHref}&sort=new` },
    { key: "consult", label: "맞춤 상담 문의", href: "/quote" },
  ];
}

function buildLandingRelatedTaxonomies(
  type: ProductLandingType,
  taxonomies: ProductTaxonomy[],
  _currentName: string,
): ProductLandingFeaturedLink[] {
  const pathSegment = type === "region" ? "theme" : "region";
  const queryKey = type === "region" ? "theme" : "region";
  const targetType = type === "region" ? "theme" : "destination";
  const list = taxonomies
    .filter((t) => t.taxonomy_type === targetType)
    .slice(0, 6)
    .map((t) => ({
      key: `related-${t.id}-${t.slug ?? t.name}`,
      label: t.name,
      href: t.slug
        ? `/products/${pathSegment}/${encodeURIComponent(t.slug.trim().toLowerCase().replace(/\s+/g, "-"))}`
        : `/products?${queryKey}=${encodeURIComponent(t.name)}`,
    }));
  return list;
}

/**
 * 추천 상품: home curated에서 해당 taxonomy 매칭 우선, 그 다음 일반 상품 매칭. 중복 제거, 최대 8개.
 */
function selectRecommendedProductsForLanding(
  allProducts: Product[],
  curatedProducts: Product[],
  type: ProductLandingType,
  taxonomyName: string,
): Product[] {
  const matched = matchProductsByTaxonomyName(allProducts, type, taxonomyName);
  const matchedIds = new Set(matched.map((p) => p.id));
  const fromCurated = curatedProducts.filter((p) => matchedIds.has(p.id));
  const curatedIds = new Set(fromCurated.map((p) => p.id));
  const rest = matched.filter((p) => !curatedIds.has(p.id));
  const combined = [...fromCurated, ...rest];
  return combined.slice(0, RECOMMENDED_MAX);
}

async function getProductLandingDataUncached(params: {
  type: ProductLandingType;
  slug: string;
}): Promise<ProductLandingData | null> {
  const { type, slug } = params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) return null;

  const taxonomyName = await getTaxonomyNameBySlug(type === "region" ? "category" : "theme", normalizedSlug);
  if (!taxonomyName) return null;

  const [products, curatedData, taxonomies] = await Promise.all([
    getProducts(),
    getHomeCuratedData(),
    getActiveTaxonomiesForHeader(),
  ]);

  const curatedProducts = curatedData.sections.flatMap((s) => s.products ?? []);
  const recommended = selectRecommendedProductsForLanding(
    products,
    curatedProducts,
    type,
    taxonomyName,
  );
  const matchedAll = matchProductsByTaxonomyName(products, type, taxonomyName);

  const currentTaxonomy =
    taxonomies.find(
      (t) =>
        t.taxonomy_type === (type === "region" ? "destination" : "theme") &&
        (t.name === taxonomyName ||
          (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug.toLowerCase())),
    ) ?? null;
  const hero = buildLandingHero(type, taxonomyName, normalizedSlug, currentTaxonomy);
  const featuredLinks = buildLandingFeaturedLinks(type, taxonomyName);
  const relatedTaxonomies = buildLandingRelatedTaxonomies(type, taxonomies, taxonomyName);

  const taxonomySlug =
    taxonomies.find(
      (t) =>
        t.taxonomy_type === (type === "region" ? "destination" : "theme") &&
        (t.name === taxonomyName || (t.slug && t.slug.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug.toLowerCase())),
    )?.slug ?? null;

  return {
    type,
    slug: normalizedSlug,
    taxonomyName,
    taxonomySlug,
    hero,
    featuredLinks,
    recommendedProducts: recommended.map(toLandingProductSummary),
    relatedTaxonomies,
    productCount: matchedAll.length,
  };
}

export async function getProductLandingData(params: {
  type: ProductLandingType;
  slug: string;
}): Promise<ProductLandingData | null> {
  const cacheKey = `product-landing:${params.type}:${params.slug.trim().toLowerCase()}`;
  return unstable_cache(getProductLandingDataUncached, [cacheKey], {
    revalidate: 60,
    tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HOME_CURATED, CACHE_TAGS.PRODUCTS],
  })(params);
}
```

---

## 6) 연관 스타일 소스

- **추천 상품 카드·그리드:** Tailwind만 사용.  
  - 그리드/카드 크기·비율·갭은 위에 적은 다음 파일들에 있는 **className**으로만 제어됩니다.  
    - `ProductCardGridSection.tsx`: `max-w-[1344px]`, `min-w-[78%] max-w-[320px]`, `sm:grid-cols-2 lg:grid-cols-3`, `sm:gap-4`  
    - `ProductCard.tsx`: `layout="grid"` 일 때 썸네일 `w-[42%] min-w-[140px] max-w-[220px]`, 본문 `p-4`  
    - `cardTokens.ts`: `CARD_TRANSITION` 등 (ProductCard에서 import해 사용)  
- **Card.tsx**: `rounded-2xl`, `border`, `shadow`, `variant="interactive"` 등 Tailwind + CSS 변수.  
- **별도 CSS 모듈 / styled-components / 추천 상품 전용 .css 파일은 없음.**

---

## 요약: 카드·그리드 구조 정리

| 항목 | 현재 값 |
|------|--------|
| **그리드 래퍼** | `ProductCardGridSection`: 데스크톱 `max-w-[1344px]`, `sm:grid-cols-2 lg:grid-cols-3`, `sm:gap-4` |
| **카드 레이아웃** | `ProductCard` `layout="grid"`: 가로형 (썸네일 42% + 본문), `min-h-[140px]` |
| **썸네일 비율/너비** | 그리드 카드 기준 `w-[42%] min-w-[140px] max-w-[220px]`, 이미지 `fill` + `object-cover` (비율 고정 없음, 컨테이너 높이에 맞춤) |
| **모바일 카드** | `min-w-[78%] max-w-[320px]` (가로 스크롤) |
| **가격/뱃지/링크** | 랜딩에서는 `status="AVAILABLE"`, `hrefDetail={item.href}`(`/products/{id}`), `price`/`title`/`region`/`categories`는 `ProductLandingProductSummary`에서 매핑 |

이 문서만으로도 현재 카드 구조·그리드 배치·이미지·텍스트 비율·최소/최대 너비 제어 방식을 전체 복사 가능한 형태로 확인할 수 있습니다.
