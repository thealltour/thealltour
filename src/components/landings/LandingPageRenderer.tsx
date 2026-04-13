import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { LandingSectionRenderer } from "@/components/landings/LandingSectionRenderer";
import LandingRecommendedProductsSection from "@/components/landings/sections/LandingRecommendedProductsSection";
import { LandingViewTracker } from "@/components/landings/LandingViewTracker";
import { sortLandingSectionsForLayout } from "@/lib/landings/landingSectionLayoutOrder";
import { getProducts } from "@/lib/products";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";
import type { Product } from "@/types/product";

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

  const destinationTaxonomyId =
    landing.sourceTaxonomyType === "destination" && landing.sourceTaxonomyId?.trim()
      ? landing.sourceTaxonomyId.trim()
      : null;

  let destinationProducts: Product[] = [];
  let destinationLabel = landing.title?.trim() || "이 지역";

  if (destinationTaxonomyId) {
    const [products, taxonomy] = await Promise.all([
      getProducts(),
      getTaxonomyById(destinationTaxonomyId),
    ]);
    if (taxonomy?.name?.trim()) {
      destinationLabel = taxonomy.name.trim();
    }
    destinationProducts = products
      .filter(
        (p) =>
          p.is_active !== false &&
          p.destination_id?.trim() &&
          p.destination_id.trim() === destinationTaxonomyId,
      )
      .slice(0, LANDING_DESTINATION_PRODUCTS_LIMIT);
  }

  const showRecommendedProducts = destinationProducts.length > 0;

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
      />
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
