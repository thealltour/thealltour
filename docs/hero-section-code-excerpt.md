# 히어로 섹션 관련 코드 발췌

히어로 섹션 CSS 개선 작업을 위한 관련 코드 전체 발췌 문서.

---

## 1) 카테고리/지역별 페이지에서 히어로를 렌더하는 페이지

### `src/app/destinations/page.tsx`  
(지역별 여행 목록 — "지역별 여행" 문구, `LandingHero` 사용)

```tsx
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
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";
import type { HubChipGroup } from "@/components/landing/HubChipList";

/** 대분류(해외/국내) → 중분류(일본, 제주 등) 그룹. parent_id 기준. */
function groupDestinationsByRoot(
  destinations: ProductTaxonomy[],
): HubChipGroup[] {
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
  return roots.map((root) => ({
    root,
    children: childrenByParent.get(root.id) ?? [],
  }));
}

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

  const hasDestinations = destinations.length > 0;
  const destinationFallbackImages = buildDestinationFallbackImageMap(destinations, products);
  const destinationGroups = groupDestinationsByRoot(destinations);
  const { overseas: overseasDestinations, domestic: domesticDestinations } =
    orderDestinationsOverseasThenDomestic(destinations);

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
          />

          {hasDestinations ? (
            <>
              <SectionBlock surface="none" padding="md">
                <HubChipList
                  items={destinations}
                  getHref={getDestinationLandingHref}
                  getLabel={(i) => i.card_title?.trim() || i.name}
                  title="빠른 선택"
                  description="원하는 지역을 탭하면 해당 지역 상품을 볼 수 있습니다."
                  groups={destinationGroups.length > 0 ? destinationGroups : undefined}
                  wrap={destinationGroups.length === 0}
                />
              </SectionBlock>
              <SectionBlock surface="none" padding="md">
                <SectionHeader
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
```

---

### `src/app/destinations/[slug]/page.tsx`  
(지역 상세 — "도시·지역 선택", `LandingDetailHero` 사용)

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import { LandingSubCardsSection } from "@/components/landing/LandingSubCardsSection";
import CuratedBlock from "@/components/home/CuratedBlock";
import { getDestinationBySlugForPublicLanding, getHubDestinations } from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

const RELATED_PRODUCTS_LIMIT = 12;

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

  const [products, subnodes, allDestinations] = await Promise.all([
    getProducts(),
    getLandingSubnodes("destination", slug),
    getHubDestinations(),
  ]);

  const parentId = destination.id.trim();
  const childDestinations = allDestinations
    .filter((d) => (d.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildDestinationFallbackImageMap(childDestinations, products);

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

          {childDestinations.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                title="도시·지역 선택"
                description="원하는 도시·지역을 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childDestinations.map((d) => {
                  const cardImageUrl =
                    d.card_image_url?.trim() ||
                    childFallbackImages.get(d.id) ||
                    childFallbackImages.get(d.name.trim().toLowerCase()) ||
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
            </SectionBlock>
          ) : null}

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
```

---

### `src/app/themes/[slug]/page.tsx`  
(테마 상세 — "세부 테마 선택", `LandingDetailHero` 사용)

```tsx
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
  getHubThemes,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import { getProducts } from "@/lib/products";
import { getLandingSubnodes } from "@/lib/landingSubnodes";
import { getThemeLandingHref } from "@/lib/hubLandingLinks";
import {
  getTaxonomyMetadataFallback,
  getTaxonomyHeroImageFallback,
} from "@/lib/landingMetadata";
import { HubBrowseCard } from "@/components/landing/HubBrowseCard";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

const RELATED_PRODUCTS_LIMIT = 12;

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

  const [products, subnodes, allThemes] = await Promise.all([
    getProducts(),
    getLandingSubnodes("theme", slug),
    getHubThemes(),
  ]);

  const parentId = theme.id.trim();
  const childThemes = allThemes
    .filter((t) => (t.parent_id ?? "").trim() === parentId)
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const childFallbackImages = buildThemeFallbackImageMap(childThemes, products);

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

          {childThemes.length > 0 ? (
            <SectionBlock surface="none" padding="md">
              <SectionHeader
                title="세부 테마 선택"
                description="원하는 테마를 선택해 보세요."
                align="left"
              />
              <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {childThemes.map((t) => {
                  const nameKey = t.name.trim().toLowerCase();
                  const cardImageUrl =
                    t.card_image_url?.trim() ||
                    childFallbackImages.get(nameKey) ||
                    undefined;
                  return (
                    <li key={t.id}>
                      <HubBrowseCard
                        item={{ ...t, card_image_url: cardImageUrl ?? t.card_image_url }}
                        href={getThemeLandingHref(t)}
                        showImage={true}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionBlock>
          ) : null}

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
```

---

### `src/app/products/region/[slug]/page.tsx`  
(상품 지역 랜딩 — `ProductLandingPage` 내부 히어로)

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

### `src/app/products/theme/[slug]/page.tsx`  
(상품 테마 랜딩 — 동일하게 `ProductLandingPage` 사용)

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

## 2) 히어로 섹션 컴포넌트 (props 타입 포함 전체)

### `src/components/landing/LandingDetailHero.tsx`  
(상세 랜딩용: 이미지 배경 + 제목·설명)

```tsx
import Image from "next/image";
import { cn } from "@/lib/cn";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";

export type LandingDetailHeroProps = {
  title: string;
  description?: string;
  imageUrl: string | null;
  className?: string;
};

/**
 * 상세 랜딩용 Hero. 이미지 배경 + 제목·설명. 맥락이 있는 페이지 느낌.
 */
export function LandingDetailHero({
  title,
  description,
  imageUrl,
  className,
}: LandingDetailHeroProps) {
  const src = imageUrl || LANDING_HERO_FALLBACK_IMAGE;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-b-2xl bg-[var(--surface-muted)]",
        "min-h-[240px] sm:min-h-[280px] md:min-h-[320px]",
        className,
      )}
    >
      <div className="absolute inset-0">
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/90 via-[var(--overlay)]/40 to-transparent"
          aria-hidden
        />
      </div>
      <div className="relative flex min-h-[240px] flex-col justify-end p-6 sm:min-h-[280px] sm:p-8 sm:pb-10 md:min-h-[320px] md:p-10 md:pb-12">
        <h1 className="heading-display font-card-title text-2xl font-semibold text-white drop-shadow-sm sm:text-3xl md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl type-small text-white/95 drop-shadow-sm sm:type-body">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
```

---

### `src/components/landing/LandingHero.tsx`  
(허브 랜딩 상단: 제목·설명·CTA, 이미지 없음)

```tsx
import Link from "next/link";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { cn } from "@/lib/cn";

export type LandingHeroProps = {
  title: string;
  description?: string;
  /** 없으면 CTA 버튼 미노출 */
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
};

/**
 * 허브 랜딩 상단 Hero. 제목·설명·CTA(선택).
 */
export function LandingHero({
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: LandingHeroProps) {
  const hasCta = ctaLabel?.trim() && ctaHref?.trim();
  return (
    <section className={cn("space-y-6", className)}>
      <SectionHeader
        title={title}
        description={description}
        align="left"
        action={
          hasCta ? (
            <Link
              href={ctaHref!}
              className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {ctaLabel}
            </Link>
          ) : undefined
        }
      />
    </section>
  );
}
```

---

## 3) 히어로 이미지·오버레이·타이틀·CTA 렌더 요약

### LandingDetailHero
- **wrapper**: `section.relative.overflow-hidden.rounded-b-2xl.bg-[var(--surface-muted)].min-h-[240px]...`
- **이미지**: `div.absolute.inset-0` 안 `next/image` (fill, priority, object-cover)
- **오버레이**: 같은 div 안 `div.absolute.inset-0.bg-gradient-to-t.from-[var(--overlay)]/90...`
- **콘텐츠**: `div.relative.flex...justify-end.p-6...` 안 h1, p (타이틀·설명만, CTA 없음)

### ProductLandingPage (이미지 있을 때)
- **wrapper**: `section.relative.min-h-[240px].overflow-hidden.rounded-2xl.bg-[var(--surface-muted)]...`
- **이미지**: `div.absolute.inset-0` → `Image` (fill, priority, object-cover)
- **오버레이**: `div.absolute.inset-0.bg-gradient-to-t.from-black/80.via-black/40.to-transparent`
- **콘텐츠**: eyebrow → `p.text-sm.font-semibold.text-white/90`, title → `h1.mt-2.text-2xl.font-bold.text-white...`, description, productCount, CTA(primary: `Link...rounded-xl.bg-[var(--primary)]...`, secondary: `Link...border-white/60.bg-white/10...`)

### ProductLandingPage (이미지 없을 때 — 카드 스타일)
- **wrapper**: `section.rounded-2xl.bg-[var(--surface)].p-6...ring-1.ring-[var(--border)]`
- **콘텐츠**: 동일 구조, 색상만 `text-[var(--foreground)]` / `text-[var(--text-muted)]` / border·bg 토큰 사용

---

## 4) 히어로 관련 스타일 (`src/app/globals.css`)

```css
  /* Hero: theme-aware (light by default) */
  --hero-bg: var(--theall-page-bg);
  --hero-scrim-from: rgba(255, 255, 255, 0.88);
  --hero-scrim-to: transparent;
  --hero-text-primary: var(--foreground);
  --hero-text-secondary: var(--text-muted);
  --hero-accent: var(--primary);
  --hero-badge-bg: rgba(0, 0, 0, 0.06);
  --hero-badge-border: rgba(0, 0, 0, 0.12);
  --hero-vignette-edge: rgba(255, 255, 255, 0.35);
  --hero-vignette-soft: transparent;
  --hero-overlay-warm-start: rgba(255, 248, 240, 0.2);
  --hero-overlay-warm-end: transparent;

/* Hero / card overlay gradients (token-based, no inline rgba in components) */
.hero-scrim {
  background-image: linear-gradient(to right, var(--hero-scrim-from) 0%, var(--hero-scrim-from) 45%, var(--hero-scrim-to) 100%);
}
.hero-overlay-warm {
  background-image: linear-gradient(to left, var(--hero-overlay-warm-start) 0%, var(--hero-overlay-warm-end) 50%, transparent 100%);
}
.hero-vignette {
  background-image: radial-gradient(circle at center, transparent 62%, var(--hero-vignette-edge) 100%);
}
.hero-vignette-soft {
  background-image: radial-gradient(circle at top left, var(--hero-vignette-soft) 0%, transparent 60%);
}

  /* Hero overlay tokens (dark mode) */
  --hero-bg: var(--site-bg);
  --hero-scrim-from: var(--site-bg);
  --hero-scrim-to: transparent;
  --hero-text-primary: var(--site-text-primary);
  --hero-text-secondary: var(--site-text-secondary);
  --hero-accent: var(--site-accent);
  --hero-badge-bg: rgba(255, 255, 255, 0.08);
  --hero-badge-border: rgba(255, 255, 255, 0.12);
  --hero-vignette-edge: rgba(2, 6, 23, 0.85);
  --hero-vignette-soft: rgba(148, 163, 184, 0.26);
  --hero-overlay-warm-start: rgba(248, 196, 113, 0.26);
  --hero-overlay-warm-end: rgba(248, 196, 113, 0.08);

.heading-display-hero {
  font-family: var(--font-display-sans);
  letter-spacing: var(--type-letter-tighter);
}

.page-hero {
  background: var(--primary);
  border-radius: 24px;
  padding-block: var(--space-6);
  padding-inline: var(--space-7);
  box-shadow: var(--shadow-soft-strong);
  color: var(--on-primary);
}
```

참고: `LandingDetailHero` / `ProductLandingPage` 히어로는 현재 **Tailwind만** 사용하며, `.hero-scrim`, `.hero-overlay-warm`, `.hero-vignette`, `.page-hero`는 **사용하지 않음**. 이미지 오버레이는 `from-[var(--overlay)]/90` 또는 `from-black/80` 등 인라인 Tailwind로만 적용.

---

## 5) 히어로에 연결되는 데이터 구조·타입·매핑

### `src/types/productLanding.ts`

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
  /** 카테고리/테마 관리에서 저장한 히어로 배경 이미지. 없으면 카드 스타일만 표시 */
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
  /** region 랜딩일 때만: 현재 지역의 소분류(도시·지역) 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childDestinations?: ProductTaxonomy[];
  /** theme 랜딩일 때만: 현재 테마의 하위 테마 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childThemes?: ProductTaxonomy[];
};
```

---

### `src/types/productTaxonomy.ts` (히어로 관련 필드만)

```ts
  // --- 선택: 카드/랜딩/SEO (향후 확장)
  card_title?: string | null;
  card_description?: string | null;
  card_image_url?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
```

---

### `src/lib/productLanding.ts` — buildLandingHero 및 hero 이미지 매핑

```ts
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
```

(같은 파일의 `getProductLandingDataUncached`에서 `currentTaxonomy`를 구한 뒤 `buildLandingHero(type, taxonomyName, normalizedSlug, currentTaxonomy)`로 호출해 `hero`에 넣고, `ProductLandingPage`의 `data.hero`로 전달됨.)

---

### `src/lib/landingMetadata.ts` — 히어로 이미지 fallback·상수

```ts
/**
 * 지역/테마 히어로 이미지 fallback.
 * 1. hero_image_url
 * 2. card_image_url
 * 3. null (호출 측에서 공통 fallback URL 사용)
 */
export function getTaxonomyHeroImageFallback(
  item: ProductTaxonomy,
): string | null {
  const url = item.hero_image_url?.trim() || item.card_image_url?.trim();
  return url || null;
}

/** 상세 랜딩 공통 히어로 이미지 fallback (taxonomy/section에 이미지 없을 때) */
export const LANDING_HERO_FALLBACK_IMAGE =
  "https://picsum.photos/seed/thealltour-landing/1600/900";
```

---

## ProductLandingPage 히어로 블록 전체 (참조용)

`src/components/products/landing/ProductLandingPage.tsx` 내 히어로 렌더 부분(이미지 있을 때 / 없을 때 분기) 전체 코드는 해당 파일 105~218라인을 참고. (이미지 있을 때: section → absolute inset-0 → Image + overlay → relative content(eyebrow, h1, description, productCount, primary/secondary CTA). 없을 때: section 카드 스타일 → 동일 콘텐츠, 라이트 테마 색상.)
