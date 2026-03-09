# /destinations 페이지 루트 + 콘텐츠 래퍼 발췌

`/destinations`는 별도 콘텐츠 래퍼 컴포넌트 없이 `page.tsx` 안에서 레이아웃과 섹션을 모두 처리합니다.

---

## 1. 루트 페이지 — `src/app/destinations/page.tsx`

```tsx
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
        const items = products.filter(
          (p) => p.category?.trim().toLowerCase() === d.name.trim().toLowerCase(),
        );
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

      <main className="page-content flex w-full flex-col py-8 md:py-12">
        <PageContainer size="wide" className="flex flex-col gap-16 md:gap-20">
          <LandingHero {...getHubHeroConfig("destinations")} className="mb-12" />

          {hasDestinations ? (
            /* ▼ 콘텐츠 래퍼 (아래 2번) */
            ...
          ) : (
            <SectionBlock surface="muted" padding="lg">
              ...
            </SectionBlock>
          )}
        </PageContainer>
      </main>
    </div>
  );
}
```

- 페이지 내부 헬퍼: `orderDestinationsOverseasThenDomestic`, `buildDestinationFallbackImageMap` 는 동일 파일 상단에 정의되어 있음.

---

## 2. 콘텐츠 래퍼 (같은 파일 내 JSX 구조)

`hasDestinations === true` 일 때 렌더되는, 2단 레이아웃 + 메인 섹션들을 감싸는 부분입니다.

```tsx
<div className="-mx-4 flex w-[calc(100%+2rem)] flex-col gap-8 sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)] lg:flex-row lg:items-start xl:-mx-10 xl:w-[calc(100%+5rem)]">
  {/* 좌측: 필터 + 빠른 이동 */}
  <div className="flex shrink-0 flex-col gap-6 pl-4 sm:pl-6 lg:pl-8 xl:pl-10">
    <HubFilterSidebar
      regionOptions={categories}
      regionTree={regionTree}
      themeOptions={themes}
      themeTree={themeTree}
      productLineOptions={productLines}
    />
    <StickySectionNav variant="desktop" sections={hubSections} />
  </div>

  {/* 우측: 메인 콘텐츠 */}
  <div className="min-w-0 flex-1 pr-4 sm:pr-6 lg:pr-8 xl:pr-10">
    <StickySectionNav variant="mobile" sections={hubSections} />

    <section id="destinations" aria-labelledby="destinations-heading">
      <SectionBlock surface="none" padding="md">
        <SectionHeader titleId="destinations-heading" title="대표 지역" ... />
        <div className="mt-6 flex flex-col gap-10">
          {/* 해외 지역 카드 그리드 */}
          {/* 국내 지역 카드 그리드 */}
        </div>
      </SectionBlock>
    </section>

    {hasPreviews && (
      <section id="recommended-products" aria-labelledby="recommended-products-heading" className="mt-16">
        <h2 id="recommended-products-heading" className="sr-only">추천 상품</h2>
        <div className="space-y-12">
          {destinationPreviews.map(...) => <CuratedBlock ... />}
        </div>
      </section>
    )}

    <section id="themes" aria-labelledby="themes-heading" className="mt-16">
      <SectionBlock surface="none" padding="md">
        <SectionHeader titleId="themes-heading" title="테마 여행" ... />
        <div className="mt-6">
          <Link href="/themes" ...>테마별로 보기</Link>
        </div>
      </SectionBlock>
    </section>
  </div>
</div>
```

---

## 구조 요약

| 계층 | 역할 |
|------|------|
| **page.tsx 루트** | 배경 div → SiteHeader → main → PageContainer(size="wide") → LandingHero → (콘텐츠 래퍼 또는 빈 상태용 SectionBlock) |
| **콘텐츠 래퍼** | 음수 마진으로 패딩 상쇄한 2단 flex: 좌측 `HubFilterSidebar` + `StickySectionNav`, 우측 `min-w-0 flex-1`(모바일 StickySectionNav + 여행지 / 추천 상품 / 테마 여행 섹션) |

- `/products`와 달리 **콘텐츠 래퍼가 별도 파일이 아니라** `src/app/destinations/page.tsx` 안의 위 JSX 블록이 해당 역할을 합니다.
