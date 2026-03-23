import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { getGuideBySlug, getRelatedGuidesByGuide } from "@/lib/guides";
import { getProductsForGuide } from "@/lib/products";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { GuideCardGrid } from "@/components/guides/GuideCardGrid";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");

function toAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${p}`;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) return { title: "가이드 | 더올투어" };

  const title =
    guide.seo_title?.trim() ||
    guide.title_override?.trim() ||
    guide.title ||
    "여행 가이드";
  const description =
    guide.seo_description?.trim() ||
    guide.summary?.trim() ||
    `${title} - 더올투어 여행 가이드`;
  const ogImage =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    null;
  const canonicalUrl = toAbsoluteUrl(`/guides/${encodeURIComponent(slug)}`);

  return {
    title: `${title} | 더올투어`,
    description: description.slice(0, 160),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      siteName: "더올투어",
      title: `${title} | 더올투어`,
      description: description.slice(0, 160),
      images: ogImage ? [{ url: toAbsoluteUrl(ogImage) }] : [],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | 더올투어`,
      description: description.slice(0, 160),
      images: ogImage ? [toAbsoluteUrl(ogImage)] : [],
    },
  };
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide) notFound();

  const [relatedProducts, relatedGuides, destinationTax, themeTax] = await Promise.all([
    getProductsForGuide(guide, 6),
    getRelatedGuidesByGuide(guide, 4),
    guide.destination_id ? getTaxonomyById(guide.destination_id) : null,
    guide.theme_id ? getTaxonomyById(guide.theme_id) : null,
  ]);

  const displayTitle = guide.title_override?.trim() || guide.title;
  const coverUrl =
    guide.cover_image_url?.trim() ||
    guide.guide_thumbnail_url?.trim() ||
    guide.thumbnail_url?.trim() ||
    "";

  const bodyLinks: { label: string; href: string }[] = [];
  if (guide.landing_url?.trim()) bodyLinks.push({ label: "상세 보기", href: guide.landing_url.trim() });
  if (guide.notion_url?.trim()) bodyLinks.push({ label: "노션에서 보기", href: guide.notion_url.trim() });
  if (guide.guide_pdf_url?.trim()) bodyLinks.push({ label: "PDF 다운로드", href: guide.guide_pdf_url.trim() });

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          {/* Hero / 상단 비주얼 */}
          <section className="overflow-hidden rounded-2xl sm:rounded-3xl bg-[var(--surface-muted)]">
            {coverUrl ? (
              <div className="relative aspect-[21/9] w-full">
                <Image
                  src={coverUrl}
                  alt=""
                  fill
                  sizes="100vw"
                  priority
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 text-white">
                  <h1 className="heading-display type-h2 font-semibold text-white drop-shadow-md md:type-h1">
                    {displayTitle}
                  </h1>
                  {guide.published_at ? (
                    <p className="mt-2 type-caption text-white/90">
                      {new Date(guide.published_at).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-end p-5 sm:p-8 min-h-[200px]">
                <h1 className="heading-display type-h2 font-semibold text-[var(--foreground)] md:type-h1">
                  {displayTitle}
                </h1>
                {guide.published_at ? (
                  <p className="mt-2 type-caption text-[var(--text-muted)]">
                    {new Date(guide.published_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {/* 요약 + 태그/카테고리 */}
          <SectionBlock surface="none" padding="md">
            {guide.summary ? (
              <p className="type-body text-[var(--foreground)] leading-relaxed">
                {guide.summary}
              </p>
            ) : null}
            {(guide.tags?.length ?? 0) > 0 || guide.category ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {guide.category ? (
                  <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 type-caption font-medium text-[var(--foreground)] ring-1 ring-[var(--border)]">
                    {guide.category}
                  </span>
                ) : null}
                {guide.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--surface-muted)] px-3 py-1 type-caption text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {bodyLinks.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-3">
                {bodyLinks.map(({ label, href }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                  >
                    {label}
                  </a>
                ))}
              </div>
            ) : null}
          </SectionBlock>

          {/* 관련 destination / theme 링크 */}
          {(destinationTax || themeTax) ? (
            <SectionBlock surface="muted" padding="md">
              <SectionHeader
                title="이 가이드와 관련된 탐색"
                align="left"
              />
              <ul className="mt-4 flex flex-wrap gap-3">
                {destinationTax ? (
                  <li>
                    <Link
                      href={getDestinationLandingHref(destinationTax)}
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      {destinationTax.name} 여행 보기
                    </Link>
                  </li>
                ) : null}
                {themeTax ? (
                  <li>
                    <Link
                      href={getThemeLandingHref(themeTax)}
                      className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                    >
                      {themeTax.name} 테마 보기
                    </Link>
                  </li>
                ) : null}
              </ul>
            </SectionBlock>
          ) : null}

          {/* 관련 상품 */}
          {relatedProducts.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="RELATED PRODUCTS"
                title="이 가이드와 함께 보면 좋은 여행"
                description="연결된 지역·테마의 추천 상품입니다."
                align="left"
              />
              <ProductCardGridSection>
                {relatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    {...productToProductCardProps(product, {
                      layout: "grid",
                      analyticsSource: "home_curated",
                      analyticsSection: `guide_${slug}`,
                    })}
                  />
                ))}
              </ProductCardGridSection>
              <div className="mt-4">
                <Link
                  href="/products"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  전체 상품 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}

          {/* 관련 가이드 */}
          {relatedGuides.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                eyebrow="TRAVEL GUIDE"
                title="함께 보면 좋은 가이드"
                align="left"
              />
              <div className="mt-6">
                <GuideCardGrid guides={relatedGuides} gridCols="4" />
              </div>
              <div className="mt-4">
                <Link
                  href="/guides"
                  className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
                >
                  가이드 전체 보기
                </Link>
              </div>
            </SectionBlock>
          ) : null}
        </PageContainer>
      </main>
    </div>
  );
}
