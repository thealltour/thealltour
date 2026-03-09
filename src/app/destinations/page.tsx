import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { StickySectionNav } from "@/components/navigation/StickySectionNav";
import { HubFilterSidebar } from "@/components/hub/HubFilterSidebar";
import CuratedBlock from "@/components/home/CuratedBlock";
import { getHubDestinations, getHubThemes, buildRegionTree, buildThemeTree, getProductTaxonomyOptions } from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import { getHubHeroConfig } from "@/lib/landingMetadata";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

/** 대표 지역 카드용: 해외(루트+중분류) → 국내(루트+하위지역) 순으로 두 그룹 반환. */
function orderDestinationsOverseasThenDomestic(
  destinations: ProductTaxonomy[],
): { overseas: ProductTaxonomy[]; domestic: ProductTaxonomy[] } {
  const sortByOrderThenName = (a: ProductTaxonomy, b: ProductTaxonomy) => {
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  };
  const roots = destinations
    .filter((d) => !d.parent_id || d.parent_id.trim() === "")
    .sort(sortByOrderThenName);
  const childrenByParent = new Map<string, ProductTaxonomy[]>();
  for (const d of destinations) {
    const pid = d.parent_id?.trim();
    if (!pid) continue;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid)!.push(d);
  }
  for (const arr of childrenByParent.values()) arr.sort(sortByOrderThenName);

  const overseas: ProductTaxonomy[] = [];
  const domestic: ProductTaxonomy[] = [];
  for (const root of roots) {
    const name = (root.name ?? "").trim();
    const children = childrenByParent.get(root.id) ?? [];
    if (name === "해외") {
      overseas.push(root, ...children);
    } else if (name === "국내") {
      domestic.push(root, ...children);
    } else {
      overseas.push(root, ...children);
    }
  }
  return { overseas, domestic };
}

/** 카드 이미지 미설정 시 해당 지역 상품의 대표 이미지로 채움. id/name -> image_url */
function buildDestinationFallbackImageMap(
  destinations: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    const first = products.find(
      (p) =>
        (p.image_url?.trim() && (p.destination_id === d.id || (p.category?.trim().toLowerCase() === d.name.trim().toLowerCase()))),
    );
    if (first?.image_url?.trim()) {
      map.set(d.id, first.image_url.trim());
      map.set(d.name.trim().toLowerCase(), first.image_url.trim());
    }
  }
  return map;
}

export const metadata = {
  title: "지역별 여행 | 더올투어",
  description:
    "가고 싶은 지역부터 여행을 찾아보세요. 더올투어가 안내하는 지역별 여행·골프·패키지 상품을 만나보실 수 있습니다.",
};

const PREVIEW_DESTINATIONS_COUNT = 4;
const PREVIEW_PRODUCTS_PER_DESTINATION = 4;

export default async function DestinationsHubPage() {
  const [destinations, products] = await Promise.all([
    getHubDestinations(),
    getProducts(),
  ]);
  const [taxonomyOptions, hubThemes] = await Promise.all([
    getProductTaxonomyOptions(products),
    getHubThemes(),
  ]);
  const { categories, themes, productLines } = taxonomyOptions;
  const regionTree = buildRegionTree(destinations);
  const themeTree = buildThemeTree(hubThemes);

  const hasDestinations = destinations.length > 0;
  const destinationFallbackImages = buildDestinationFallbackImageMap(destinations, products);
  const { overseas: overseasDestinations, domestic: domesticDestinations } =
    orderDestinationsOverseasThenDomestic(destinations);

  const destinationPreviews = hasDestinations
    ? destinations.slice(0, PREVIEW_DESTINATIONS_COUNT).map((d) => {
        const items = products.filter((p) => {
          if (p.destination_id) {
            return p.destination_id === d.id;
          }
          return p.category?.trim().toLowerCase() === d.name.trim().toLowerCase();
        });
        return { destination: d, products: items.slice(0, PREVIEW_PRODUCTS_PER_DESTINATION) };
      })
    : [];
  const hasPreviews = destinationPreviews.some((p) => p.products.length > 0);

  const hubSections = [
    { id: "destinations", label: "여행지" },
    { id: "recommended-products", label: "추천 상품" },
    { id: "themes", label: "테마 여행" },
  ];

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <LandingHero {...getHubHeroConfig("destinations")} className="mb-12" />

          {hasDestinations ? (
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
              <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-6">
                <HubFilterSidebar
                  regionOptions={categories}
                  regionTree={regionTree}
                  themeOptions={themes}
                  themeTree={themeTree}
                  productLineOptions={productLines}
                />
                <StickySectionNav variant="desktop" sections={hubSections} />
              </div>
              <div className="min-w-0 flex-1">
                <StickySectionNav variant="mobile" sections={hubSections} />
                <section id="destinations" aria-labelledby="destinations-heading">
                  <SectionBlock surface="none" padding="md">
                    <SectionHeader
                      titleId="destinations-heading"
                      title="대표 지역"
                      description="원하는 지역을 선택해 보세요."
                      align="left"
                    />
                    <div className="mt-6 flex flex-col gap-10">
                      {overseasDestinations.length > 0 && (
                        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {overseasDestinations.map((d) => {
                            const cardImageUrl =
                              d.card_image_url?.trim() ||
                              destinationFallbackImages.get(d.id) ||
                              destinationFallbackImages.get(d.name.trim().toLowerCase()) ||
                              undefined;
                            return (
                              <li key={d.id}>
                                <HubBrowseCard
                                  item={{ ...d, card_image_url: cardImageUrl ?? d.card_image_url }}
                                  href={getDestinationLandingHref(d)}
                                  showImage={true}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {overseasDestinations.length > 0 && domesticDestinations.length > 0 && (
                        <div className="w-full border-t border-[var(--border)]" aria-hidden />
                      )}
                      {domesticDestinations.length > 0 && (
                        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {domesticDestinations.map((d) => {
                            const cardImageUrl =
                              d.card_image_url?.trim() ||
                              destinationFallbackImages.get(d.id) ||
                              destinationFallbackImages.get(d.name.trim().toLowerCase()) ||
                              undefined;
                            return (
                              <li key={d.id}>
                                <HubBrowseCard
                                  item={{ ...d, card_image_url: cardImageUrl ?? d.card_image_url }}
                                  href={getDestinationLandingHref(d)}
                                  showImage={true}
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </SectionBlock>
                </section>

                {hasPreviews && (
                  <section id="recommended-products" aria-labelledby="recommended-products-heading" className="mt-16">
                    <h2 id="recommended-products-heading" className="sr-only">
                      추천 상품
                    </h2>
                    <div className="space-y-12">
                      {destinationPreviews.map(
                        ({ destination, products: destProducts }) =>
                          destProducts.length > 0 && (
                            <CuratedBlock
                              key={destination.id}
                              title={destination.card_title?.trim() || destination.name}
                              description={
                                destination.card_description?.trim() ||
                                `${destination.name} 지역 상품을 소개합니다.`
                              }
                              products={destProducts}
                              surface="none"
                            />
                          ),
                      )}
                    </div>
                  </section>
                )}

                <section id="themes" aria-labelledby="themes-heading" className="mt-16">
                  <SectionBlock surface="none" padding="md">
                    <SectionHeader
                      titleId="themes-heading"
                      title="테마 여행"
                      description="테마별로 여행 상품을 둘러보세요."
                      align="left"
                    />
                    <div className="mt-6">
                      <Link
                        href="/themes"
                        className="type-btn inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                      >
                        테마별로 보기
                      </Link>
                    </div>
                  </SectionBlock>
                </section>
              </div>
            </div>
          ) : (
            <SectionBlock surface="muted" padding="lg">
              <SectionHeader
                title="현재 노출 가능한 지역 카테고리가 없습니다"
                description="곧 지역별 상품을 준비하겠습니다. 아래에서 전체 상품을 둘러보실 수 있습니다."
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
          )}
        </PageContainer>
      </main>
    </div>
  );
}
