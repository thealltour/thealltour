import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { HubChipList } from "@/components/landing/HubChipList";
import CuratedBlock from "@/components/home/CuratedBlock";
import { getHubDestinations } from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";

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

  const hasDestinations = destinations.length > 0;

  const destinationPreviews = hasDestinations
    ? destinations.slice(0, PREVIEW_DESTINATIONS_COUNT).map((d) => {
        const items = products.filter(
          (p) => p.category?.trim().toLowerCase() === d.name.trim().toLowerCase(),
        );
        return { destination: d, products: items.slice(0, PREVIEW_PRODUCTS_PER_DESTINATION) };
      })
    : [];
  const hasPreviews = destinationPreviews.some((p) => p.products.length > 0);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />

      <main className="page-content flex w-full flex-col py-8 md:py-12">
        <PageContainer size="wide" className="flex flex-col gap-16 md:gap-20">
          <LandingHero
            title="지역별 여행"
            description="가고 싶은 지역부터 여행을 찾아볼 수 있도록 안내합니다. 지역을 선택하면 해당 지역의 상품을 바로 둘러보실 수 있습니다."
            ctaLabel="전체 상품 보기"
            ctaHref="/products"
          />

          {hasDestinations ? (
            <>
              <SectionBlock surface="none" padding="md">
                <HubChipList
                  items={destinations}
                  getHref={getDestinationLandingHref}
                />
              </SectionBlock>
              <SectionBlock surface="none" padding="md">
                <SectionHeader
                  title="대표 지역"
                  description="원하는 지역을 선택해 보세요."
                  align="left"
                />
                <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {destinations.map((d) => (
                    <li key={d.id}>
                      <HubBrowseCard
                        item={d}
                        href={getDestinationLandingHref(d)}
                        showImage={true}
                      />
                    </li>
                  ))}
                </ul>
              </SectionBlock>

              {hasPreviews && (
                <section className="space-y-12">
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
                </section>
              )}

              <SectionBlock surface="muted" padding="lg">
                <SectionHeader
                  title="더 많은 상품 보기"
                  description="전체 상품 목록에서 지역·테마·정렬로 편하게 탐색할 수 있습니다."
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
            </>
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
