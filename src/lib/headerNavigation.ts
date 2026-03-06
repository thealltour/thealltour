import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { HeaderNavigationData, HeaderNavGroup, HeaderNavLeafItem, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getActiveTaxonomiesForHeader } from "@/lib/productTaxonomies";
import { getHomeCuratedData } from "@/lib/homeCurated";

function buildProductsHref(param: "region" | "theme", name: string, slug: string | null): string {
  const path = param === "region" ? "region" : "theme";
  const segment = (slug && slug.trim())
    ? slug.trim().toLowerCase().replace(/\s+/g, "-")
    : name.trim().toLowerCase().replace(/\s+/g, "-");
  if (segment) {
    return `/products/${path}/${encodeURIComponent(segment)}`;
  }
  return `/products?${param}=${encodeURIComponent(name)}`;
}

function recommendedGroupsFromCurated(sections: { id: string; title: string }[]): HeaderNavGroup[] {
  const groups: HeaderNavGroup[] = [];
  if (sections.length > 0) {
    groups.push({
      key: "recommended-featured",
      label: "이번 달 추천",
      items: [{ key: "curated", label: "홈 추천 상품", href: "/" }],
    });
    sections.slice(0, 4).forEach((sec) => {
      if (sec.title) {
        groups.push({
          key: `recommended-section-${sec.id}`,
          label: sec.title,
          items: [{ key: `sec-${sec.id}`, label: "보기", href: `/#section-${sec.id}` }],
        });
      }
    });
  }
  if (groups.length === 0) {
    groups.push({
      key: "recommended-featured",
      label: "이번 달 추천",
      items: [{ key: "curated", label: "홈 추천 상품", href: "/" }],
    });
  }
  groups.push(
    {
      key: "recommended-popular",
      label: "인기 상품",
      items: [{ key: "popular", label: "인기 패키지", href: "/products?sort=popular" }],
    },
    {
      key: "recommended-new",
      label: "신규 여행",
      items: [{ key: "new", label: "신규 상품", href: "/products?sort=new" }],
    },
  );
  return groups;
}

function regionGroupsFromTaxonomy(categories: ProductTaxonomy[]): HeaderNavGroup[] {
  if (categories.length === 0) {
    return [{ key: "region-all", label: "전체", items: [{ key: "region-products", label: "상품 보기", href: "/products" }] }];
  }
  const items: HeaderNavLeafItem[] = categories.map((c) => ({
    key: `region-${c.id}`,
    label: c.name,
    href: buildProductsHref("region", c.name, c.slug),
  }));
  return [{ key: "region-group", label: "지역별", items }];
}

function themeGroupsFromTaxonomy(themes: ProductTaxonomy[]): HeaderNavGroup[] {
  if (themes.length === 0) {
    return [{ key: "theme-all", label: "전체", items: [{ key: "theme-products", label: "상품 보기", href: "/products" }] }];
  }
  const items: HeaderNavLeafItem[] = themes.map((t) => ({
    key: `theme-${t.id}`,
    label: t.name,
    href: buildProductsHref("theme", t.name, t.slug),
  }));
  return [{ key: "theme-group", label: "테마별", items }];
}

async function getHeaderNavigationDataUncached(): Promise<HeaderNavigationData> {
  const [taxonomies, curated] = await Promise.all([
    getActiveTaxonomiesForHeader(),
    getHomeCuratedData(),
  ]);

  const categories = taxonomies.filter((t) => t.type === "category");
  const themes = taxonomies.filter((t) => t.type === "theme");

  const recommendedGroups = recommendedGroupsFromCurated(
    curated.sections.map((s) => ({ id: s.id, title: s.title })),
  );
  const regionGroups = regionGroupsFromTaxonomy(categories);
  const themeGroups = themeGroupsFromTaxonomy(themes);

  const primaryNav: HeaderPrimaryNavItem[] = [
    {
      key: "recommended",
      label: "추천여행",
      groups: recommendedGroups.length > 0 ? recommendedGroups : [{ key: "recommended-default", label: "추천", items: [{ key: "home", label: "홈", href: "/" }] }],
    },
    {
      key: "region",
      label: "지역별 여행",
      groups: regionGroups,
    },
    {
      key: "theme",
      label: "테마별 여행",
      groups: themeGroups,
    },
    { key: "inquiry", label: "맞춤/단체문의", href: "/quote" },
    { key: "guides", label: "여행가이드", href: "/guides" },
    { key: "support", label: "고객센터", href: "/support" },
  ];

  return { primaryNav };
}

/**
 * 헤더 메가메뉴/모바일 메뉴용 네비게이션 데이터.
 * taxonomy + home-curated 기반. tags로 revalidate 시 갱신.
 */
export async function getHeaderNavigationData(): Promise<HeaderNavigationData> {
  return unstable_cache(getHeaderNavigationDataUncached, ["header-navigation"], {
    revalidate: 60,
    tags: [CACHE_TAGS.HEADER_NAV, CACHE_TAGS.TAXONOMY, CACHE_TAGS.HOME_CURATED],
  })();
}
