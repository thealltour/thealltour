import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import {
  getGuideBySlug,
  getRelatedGuidesForBlogBridge,
  getGuideNotionViewUrl,
  getAdjacentPublishedGuidesBySlug,
} from "@/lib/guides";
import { getProducts, getGuideBridgeRecommendations } from "@/lib/products";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import { GuideBridgeHeroCtas } from "@/components/guides/GuideBridgeHeroCtas";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { BreadcrumbWrapper } from "@/components/navigation/BreadcrumbWrapper";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import {
  buildGuideBridgeSelectionLine,
  buildProductExperienceSummary,
  productToProductCardProps,
} from "@/lib/productCardProps";
import type { Product } from "@/types/product";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { getGuideSeoData } from "@/lib/guides/getGuideSeoData";
import {
  buildOgBrandFallbackMetadata,
  buildOgMetadataFromSeoData,
} from "@/lib/seo/buildOgPageMetadata";
import { GUIDE_HERO_FALLBACK_IMAGE, pickGuidePreferredImageUrl } from "@/lib/guides/imageUrl";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const seo = await getGuideSeoData(slug);
  if (!seo) {
    return buildOgBrandFallbackMetadata({
      canonicalPath: `/guides/${slug}`,
      documentTitle: "가이드 | 더올투어",
      description: "더올투어 여행 가이드를 찾을 수 없거나 비공개입니다.",
      openGraphType: "website",
    });
  }
  return buildOgMetadataFromSeoData(seo);
}

function productsFilterHrefForTag(tag: string) {
  return `/products?q=${encodeURIComponent(tag.trim())}`;
}

type ExplorationCard = {
  key: string;
  title: string;
  subtitle: string;
  href: string;
};

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const allProducts = await getProducts();

  const [bridgeRec, relatedGuides, destinationTax, themeTax, adjacent] = await Promise.all([
    getGuideBridgeRecommendations(guide, { totalLimit: 12 }),
    getRelatedGuidesForBlogBridge(guide, 4),
    guide.destination_id ? getTaxonomyById(guide.destination_id) : null,
    guide.theme_id ? getTaxonomyById(guide.theme_id) : null,
    getAdjacentPublishedGuidesBySlug(slug),
  ]);

  const displayTitle = guide.title_override?.trim() || guide.title;
  const coverUrl = pickGuidePreferredImageUrl(guide);

  const notionFullUrl = getGuideNotionViewUrl(guide).trim();

  const secondaryLinks: { label: string; href: string }[] = [];
  if (guide.landing_url?.trim()) secondaryLinks.push({ label: "외부 상세 보기", href: guide.landing_url.trim() });
  if (guide.guide_pdf_url?.trim()) secondaryLinks.push({ label: "PDF 다운로드", href: guide.guide_pdf_url.trim() });

  /** 점수 양수 primary 우선; 없으면 폴백만 있는 경우 all 상단 사용 */
  const topPicks =
    bridgeRec.primary.length > 0 ? bridgeRec.primary : bridgeRec.all.slice(0, 3);

  const morePicks: Product[] = [];
  const usedIds = new Set(topPicks.map((p) => p.id));
  if (bridgeRec.primary.length > 0) {
    for (const p of bridgeRec.secondary) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
    for (const p of bridgeRec.all) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
  } else {
    for (const p of bridgeRec.all.slice(3)) {
      if (morePicks.length >= 6) break;
      if (!usedIds.has(p.id)) {
        usedIds.add(p.id);
        morePicks.push(p);
      }
    }
  }

  const explorationCards: ExplorationCard[] = [];
  if (destinationTax?.name?.trim()) {
    const n = destinationTax.name.trim();
    explorationCards.push({
      key: "region",
      title: "지역으로 더 알아보기",
      subtitle: `${n} 여행 더 알아보기`,
      href: `/products?region=${encodeURIComponent(n)}`,
    });
  }
  if (themeTax?.name?.trim()) {
    const n = themeTax.name.trim();
    explorationCards.push({
      key: "theme",
      title: "테마로 더 알아보기",
      subtitle: `${n} 여행 더 알아보기`,
      href: `/products?theme=${encodeURIComponent(n)}`,
    });
  }
  const firstTag = guide.tags?.find((t) => t?.trim());
  if (firstTag && explorationCards.length < 3) {
    explorationCards.push({
      key: "tag",
      title: "키워드로 더 알아보기",
      subtitle: `「${firstTag.trim()}」 여행 더 알아보기`,
      href: productsFilterHrefForTag(firstTag),
    });
  }

  const prev = adjacent.prev?.slug?.trim() ? adjacent.prev : null;
  const next = adjacent.next?.slug?.trim() ? adjacent.next : null;
  const showRelatedGrid = relatedGuides.length >= 3;

  /** `/destinations`·`/themes` LandingHero와 동일 min-height */
  const guideHeroMinHeight = "min-h-[240px] sm:min-h-[300px] md:min-h-[340px]";
  const heroImageUrl = coverUrl.trim() ? coverUrl : GUIDE_HERO_FALLBACK_IMAGE;
  const heroEyebrow =
    guide.category?.trim() || destinationTax?.name?.trim() || "여행 가이드";
  const publishedLine = guide.published_at
    ? new Date(guide.published_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-5 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-5 md:gap-8">
          <BreadcrumbWrapper
            items={[
              { label: "홈", href: "/" },
              { label: "여행가이드", href: "/blog" },
              { label: displayTitle },
            ]}
          />

          {/* 1. 히어로 — 허브(/destinations, /themes)와 동일 HeroVisual 레이어·높이·그라데이션 */}
          <HeroVisual
            imageUrl={heroImageUrl}
            imageAlt={displayTitle ? `${displayTitle} 여행 가이드` : "여행 가이드"}
            priority
            minHeightClassName={guideHeroMinHeight}
            className="sm:rounded-3xl"
            contentClassName="max-w-[640px] gap-2"
          >
            <p className="hero-text-shadow-body text-sm font-semibold text-white/92">{heroEyebrow}</p>
            <h1 className="hero-text-shadow-title text-xl font-bold leading-tight text-white sm:text-2xl md:text-3xl">
              {`${displayTitle} 여행 가이드`}
            </h1>
            {guide.summary?.trim() ? (
              <p className="hero-text-shadow-body line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
                {guide.summary.trim()}
              </p>
            ) : publishedLine ? (
              <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                {publishedLine}
              </p>
            ) : (
              <p className="hero-text-shadow-body max-w-2xl text-sm text-white/90 sm:text-base">
                원문과 함께 여행 정보를 이어서 확인해 보세요.
              </p>
            )}
            <GuideBridgeHeroCtas notionUrl={notionFullUrl || null} />
          </HeroVisual>

          {/* 요약·카테고리·태그는 히어로에 이미 노출되어 중복 제거. 보조 링크만 유지 */}
          {secondaryLinks.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 sm:px-0">
              {secondaryLinks.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="type-caption font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {label}
                </a>
              ))}
            </div>
          ) : null}

          {/* 4. 가이드에 맞닿은 여행 (앵커) */}
          <section
            id="recommended-products"
            className="max-sm:scroll-mt-[100px] sm:scroll-mt-24 rounded-2xl border-2 border-[color-mix(in_srgb,var(--primary)_22%,transparent)] bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))] p-3.5 pt-3.5 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] sm:rounded-3xl sm:p-6 sm:pt-5 md:p-7 md:pt-7"
            aria-labelledby="recommended-products-heading"
          >
            <SectionHeader
              titleId="recommended-products-heading"
              title="이 가이드에서 본 여행을 직접 경험해보세요"
              align="left"
            />

            {topPicks.length > 0 ? (
              <div
                className={cn(
                  "mt-3 space-y-2 sm:mt-5 sm:space-y-2.5",
                  morePicks.length > 0 && "border-b border-[var(--border)] pb-4 sm:border-b sm:pb-6",
                )}
              >
                <h3 className="text-sm font-semibold leading-snug tracking-tight text-[var(--text-muted)] sm:text-[15px]">
                  가장 먼저 살펴볼 여행
                </h3>
                <p className="text-xs leading-snug text-[var(--text-muted)] sm:text-[13px]">
                  가장 많이 선택되는 일정부터 확인해보세요.
                </p>
                <ProductCardGridSection
                  desktopGridCols={3}
                  className="w-full max-w-[1344px]"
                  guideBridgeTopPicksLayout
                >
                  {topPicks.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: `guide_bridge_top_${slug}`,
                        topPickLabel: index === 0 ? "가장 많이 선택된" : undefined,
                        experienceSummary: buildProductExperienceSummary(product),
                        emphasizeFirstOnMobile: index === 0,
                        guideBridgeNarrowCopy: true,
                        selectionHighlightLine: buildGuideBridgeSelectionLine(product),
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              </div>
            ) : (
              <p className="mt-4 type-small text-[var(--text-muted)]">
                아직 표시할 여행이 없습니다. 아래에서 지역·테마로 더 찾아보세요.
              </p>
            )}

            {morePicks.length > 0 ? (
              <div className="mt-4 space-y-2 pt-1 sm:mt-6 sm:space-y-2.5 sm:pt-0">
                <h3 className="text-xs font-normal leading-snug text-[var(--text-subtle)] sm:text-[13px] sm:text-[var(--text-muted)]">
                  비슷한 여행을 함께 비교해보세요
                </h3>
                <ProductCardGridSection
                  desktopGridCols={3}
                  className="w-full max-w-[1344px]"
                  guideBridgeMobileTightGap
                >
                  {morePicks.map((product) => (
                    <ProductCard
                      key={product.id}
                      {...productToProductCardProps(product, {
                        layout: "related",
                        analyticsSource: "landing",
                        analyticsSection: `guide_bridge_more_${slug}`,
                        experienceSummary: buildProductExperienceSummary(product),
                        guideBridgeNarrowCopy: true,
                        selectionHighlightLine: buildGuideBridgeSelectionLine(product),
                      })}
                    />
                  ))}
                </ProductCardGridSection>
              </div>
            ) : null}

            <div className="mt-3 sm:mt-4">
              <Link
                href="/products"
                className="type-btn inline-flex items-center gap-2 rounded-xl bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] ring-1 ring-[var(--border-strong)] transition hover:bg-[var(--primary-soft)]"
              >
                전체 여행 더 알아보기
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>

          {/* 5. 관련 탐색 (카드형) */}
          {explorationCards.length > 0 ? (
            <SectionBlock surface="muted" padding="md" className="!py-3.5 sm:!py-6 md:!py-8">
              <SectionHeader
                title="관심 있는 여행을 더 찾아보세요"
                description="지역·테마·키워드별로 목록을 열어 더 알아보실 수 있어요."
                descriptionClassName="text-xs font-normal text-[var(--text-subtle)] sm:text-[13px]"
                align="left"
              />
              <ul className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                {explorationCards.map((card) => (
                  <li key={card.key}>
                    <Link
                      href={card.href}
                      className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] transition hover:border-[var(--primary)]/40 hover:shadow-md sm:p-5"
                    >
                      <span className="text-xs font-semibold text-[var(--primary)] sm:text-[13px]">{card.title}</span>
                      <span className="mt-2 text-sm font-semibold leading-snug text-[var(--foreground)] sm:text-base">
                        {card.subtitle}
                      </span>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">
                        더 알아보기
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          ) : null}

          {/* 6. 가이드 탐색: 이전/다음 · 전체 · (조건) 연관 가이드 — 한 카드로 묶음 */}
          <SectionBlock surface="none" padding="none" className="!space-y-0">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]/50 sm:rounded-3xl sm:p-5 md:p-6">
              <SectionHeader title="가이드 더 보기" align="left" className="!space-y-1 sm:pb-0" />
              <div className="mt-3 flex flex-col gap-4 sm:mt-4 sm:gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                  <div className="min-h-[3rem] flex-1 sm:max-w-[42%]">
                    {prev ? (
                      <Link
                        href={`/guides/${encodeURIComponent(prev.slug!.trim())}`}
                        className="flex h-full flex-col justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 transition hover:bg-[var(--surface-muted)]"
                      >
                        <span className="type-caption text-[var(--text-muted)]">이전 가이드</span>
                        <span className="mt-1 font-semibold text-[var(--foreground)]">
                          {prev.title_override?.trim() || prev.title}
                        </span>
                      </Link>
                    ) : (
                      <div className="type-caption text-[var(--text-muted)] sm:pt-2">이전 가이드가 없습니다.</div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 sm:max-w-[28%]">
                    <Link
                      href="/blog"
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface-muted)]/40 px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      가이드 전체 보기
                    </Link>
                  </div>
                  <div className="min-h-[3rem] flex-1 text-right sm:max-w-[42%]">
                    {next ? (
                      <Link
                        href={`/guides/${encodeURIComponent(next.slug!.trim())}`}
                        className="flex h-full flex-col items-end justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-4 text-right transition hover:bg-[var(--surface-muted)]"
                      >
                        <span className="type-caption text-[var(--text-muted)]">다음 가이드</span>
                        <span className="mt-1 font-semibold text-[var(--foreground)]">
                          {next.title_override?.trim() || next.title}
                        </span>
                      </Link>
                    ) : (
                      <div className="type-caption text-[var(--text-muted)] sm:pt-2 sm:text-right">다음 가이드가 없습니다.</div>
                    )}
                  </div>
                </div>

                {showRelatedGrid ? (
                  <div className="border-t border-[var(--divider)] pt-4 sm:pt-5">
                    <h3 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">비슷한 주제의 가이드</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)] sm:text-sm">
                      같은 지역·테마와 연결된 글이에요.
                    </p>
                    <div className="mt-3 sm:mt-4">
                      <GuideCardGrid guides={relatedGuides} gridCols="3" />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </SectionBlock>
        </PageContainer>
      </main>
    </div>
  );
}
