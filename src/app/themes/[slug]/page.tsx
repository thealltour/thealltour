import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import CuratedBlock from "@/components/home/CuratedBlock";
import {
  getThemeBySlugForPublicLanding,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";

const RELATED_PRODUCTS_LIMIT = 12;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(theme);
  return {
    title: `${title} | 더올투어`,
    description:
      description ||
      `${title} 테마의 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function ThemeLandingPage({ params }: Props) {
  const { slug } = await params;
  const theme = await getThemeBySlugForPublicLanding(slug);
  if (!theme) notFound();

  const [products, subnodes] = await Promise.all([
    getProducts(),
    getLandingSubnodes("theme", slug),
  ]);
  const themeNameLower = theme.name.trim().toLowerCase();
  const related = products
    .filter((p) => {
      const tokens = parseThemeTokens(p.theme).map((t) =>
        t.trim().toLowerCase(),
      );
      return tokens.includes(themeNameLower);
    })
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = theme.landing_title?.trim() || theme.name;
  const heroDescription =
    theme.landing_description?.trim() ||
    theme.card_description?.trim() ||
    `${theme.name} 테마의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(theme);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="page-content flex w-full flex-col py-0 md:py-0">
        <PageContainer size="wide" className="flex flex-col gap-12 md:gap-16">
          <LandingDetailHero
            title={heroTitle}
            description={heroDescription}
            imageUrl={heroImage}
          />

          <LandingSubCardsSection
            contextTitle={theme.name}
            nodes={subnodes}
          />

          {related.length > 0 ? (
            <CuratedBlock
              title={`${theme.name} 대표 상품`}
              description={`${theme.name} 테마와 연결된 상품입니다.`}
              products={related}
              surface="none"
            />
          ) : null}

          <SectionBlock surface="muted" padding="lg">
            <SectionHeader
              title="더 많은 상품 보기"
              description="전체 상품 목록에서 지역·테마·정렬로 탐색하거나 맞춤 상담을 요청해 보세요."
              align="center"
            />
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link
                href="/products"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90"
              >
                전체 상품 보기
              </Link>
              <Link
                href="/quote"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
              >
                맞춤 상담 문의
              </Link>
            </div>
          </SectionBlock>
        </PageContainer>
      </main>
    </div>
  );
}
