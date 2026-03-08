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
import { getDestinationBySlugForPublicLanding } from "@/lib/productTaxonomies";
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
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) return { title: "Not Found" };
  const { title, description } = getTaxonomyMetadataFallback(destination);
  return {
    title: `${title} | 더올투어`,
    description: description || `${title} 지역 여행·골프·패키지 상품을 만나보세요.`,
  };
}

export default async function DestinationLandingPage({ params }: Props) {
  const { slug } = await params;
  const destination = await getDestinationBySlugForPublicLanding(slug);
  if (!destination) notFound();

  const [products, subnodes] = await Promise.all([
    getProducts(),
    getLandingSubnodes("destination", slug),
  ]);
  const nameLower = destination.name.trim().toLowerCase();
  const related = products
    .filter((p) => p.category?.trim().toLowerCase() === nameLower)
    .slice(0, RELATED_PRODUCTS_LIMIT);

  const heroTitle = destination.landing_title?.trim() || destination.name;
  const heroDescription =
    destination.landing_description?.trim() ||
    destination.card_description?.trim() ||
    `${destination.name} 지역의 여행·골프·패키지 상품을 소개합니다.`;
  const heroImage = getTaxonomyHeroImageFallback(destination);

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
            contextTitle={destination.name}
            nodes={subnodes}
          />

          {related.length > 0 ? (
            <CuratedBlock
              title={`${destination.name} 대표 상품`}
              description={`${destination.name} 지역과 연결된 상품입니다.`}
              products={related}
              surface="none"
            />
          ) : null}

          <SectionBlock surface="muted" padding="lg">
            <SectionHeader
              title="더 많은 상품 보기"
              description="전체 상품 목록에서 지역·테마·정렬로 탐색할 수 있습니다."
              align="center"
            />
            <div className="mt-6 flex justify-center">
              <Link
                href="/products"
                className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90"
              >
                전체 상품 보기
              </Link>
            </div>
          </SectionBlock>
        </PageContainer>
      </main>
    </div>
  );
}
