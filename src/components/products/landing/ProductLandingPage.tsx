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
