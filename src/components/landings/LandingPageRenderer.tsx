import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { LandingSectionRenderer } from "@/components/landings/LandingSectionRenderer";
import LandingRecommendedProductsSection from "@/components/landings/sections/LandingRecommendedProductsSection";
import { LandingViewTracker } from "@/components/landings/LandingViewTracker";
import { sortLandingSectionsForLayout } from "@/lib/landings/landingSectionLayoutOrder";
import { getProductListItems } from "@/lib/products/getProductListItems";
import {
  buildGolfProductsHref,
  GOLF_PRESET_CATEGORIES,
  isGolfProductLineTaxonomy,
} from "@/lib/products/golfChannel";
import { getTaxonomyById, getActiveProductLineTaxonomies } from "@/lib/productTaxonomies";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";
import type { ProductListItem } from "@/lib/products/productListItem";

const LANDING_DESTINATION_PRODUCTS_LIMIT = 8;

type LandingPageRendererProps = {
  landing: AdminLandingDetail;
  mode: "preview" | "public";
  sourcePath: string;
};

function getRenderableSections(landing: AdminLandingDetail): AdminLandingSection[] {
  return (landing.sections ?? [])
    .filter((section) => section.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export default async function LandingPageRenderer({
  landing,
  mode,
  sourcePath,
}: LandingPageRendererProps) {
  const sections = sortLandingSectionsForLayout(getRenderableSections(landing));

  const isGolfDestinationLanding = landing.templateType === "destination_golf_consulting";
  const destinationTaxonomyId =
    landing.sourceTaxonomyType === "destination" && landing.sourceTaxonomyId?.trim()
      ? landing.sourceTaxonomyId.trim()
      : null;

  let destinationProducts: ProductListItem[] = [];
  let destinationLabel = landing.title?.trim() || "이 지역";

  if (destinationTaxonomyId) {
    const [taxonomy, productLines] = await Promise.all([
      getTaxonomyById(destinationTaxonomyId),
      getActiveProductLineTaxonomies(),
    ]);
    if (taxonomy?.name?.trim()) {
      destinationLabel = isGolfDestinationLanding
        ? `${taxonomy.name.trim()} 골프투어`
        : taxonomy.name.trim();
    }

    const golfLineIds = productLines
      .filter((p) => isGolfProductLineTaxonomy(p))
      .map((p) => p.id)
      .filter(Boolean);

    destinationProducts = await getProductListItems({
      destinationIdExact: destinationTaxonomyId,
      limit: LANDING_DESTINATION_PRODUCTS_LIMIT,
      ...(isGolfDestinationLanding
        ? {
            golfChannel: {
              productLineIds: golfLineIds,
              legacyCategories: [...GOLF_PRESET_CATEGORIES],
            },
          }
        : {}),
    });
  }

  const showRecommendedProducts = destinationProducts.length > 0;
  const golfChannelFallbackHref = buildGolfProductsHref();

  if (process.env.NODE_ENV !== "production" && mode === "preview" && sections.length === 0) {
    console.warn("[landing-preview] 활성 섹션이 없습니다.", {
      landingId: landing.id,
      slug: landing.slug,
      totalSections: landing.sections?.length ?? 0,
    });
  }

  const heroBlocks: ReactNode[] = [];
  const tailBlocks: ReactNode[] = [];
  let i = 0;
  while (i < sections.length && sections[i].sectionType === "hero") {
    heroBlocks.push(
      <LandingSectionRenderer
        key={sections[i].id}
        landing={landing}
        section={sections[i]}
        mode={mode}
        sourcePath={sourcePath}
        showHeroProductScrollCta={showRecommendedProducts}
      />,
    );
    i += 1;
  }

  const productBlock =
    showRecommendedProducts ? (
      <LandingRecommendedProductsSection
        key="landing-recommended-products"
        label={destinationLabel}
        products={destinationProducts}
        fallbackHref={isGolfDestinationLanding ? golfChannelFallbackHref : undefined}
        fallbackLabel={isGolfDestinationLanding ? "골프투어 전체 보기" : undefined}
      />
    ) : isGolfDestinationLanding ? (
      <div
        key="landing-golf-fallback"
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--text-secondary)]"
      >
        현재 이 지역의 골프 상품을 준비 중입니다.{" "}
        <a href={golfChannelFallbackHref} className="font-semibold text-[var(--primary)] underline">
          골프투어 전체 보기
        </a>
      </div>
    ) : null;

  while (i < sections.length) {
    const section = sections[i];
    tailBlocks.push(
      <LandingSectionRenderer
        key={section.id}
        landing={landing}
        section={section}
        mode={mode}
        sourcePath={sourcePath}
        showHeroProductScrollCta={false}
      />,
    );
    i += 1;
  }

  const hasLead = heroBlocks.length > 0 || productBlock != null;

  return (
    <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
      {mode === "public" ? <LandingViewTracker landing={landing} sourcePath={sourcePath} /> : null}
      <PageContainer size="wide" className="flex flex-col">
        {sections.length > 0 ? (
          <>
            {heroBlocks.length > 0 || productBlock ? (
              <div className="flex flex-col gap-4 sm:gap-5">
                {heroBlocks.length > 0 ? (
                  <div className="flex flex-col gap-4">{heroBlocks}</div>
                ) : null}
                {productBlock}
              </div>
            ) : null}
            {tailBlocks.length > 0 ? (
              <div
                className={cn(
                  "flex flex-col gap-8",
                  hasLead && "mt-10 border-t border-[var(--divider)] pt-10 sm:mt-12 sm:pt-12",
                )}
              >
                {tailBlocks}
              </div>
            ) : null}
          </>
        ) : (
          <SectionBlock surface="muted" padding="md">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{landing.title}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              노출 가능한 섹션이 아직 없습니다.
            </p>
          </SectionBlock>
        )}
      </PageContainer>
    </main>
  );
}
