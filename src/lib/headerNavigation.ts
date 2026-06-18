import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { HeaderNavigationData, HeaderNavGroup, HeaderNavLeafItem, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { getSiteSettings, type SiteSettings } from "@/lib/siteSettings";
import { buildGolfProductsHref, parseGolfHeroRegions, resolveGolfHeroRegionPreset } from "@/lib/products/golfChannel";

/** hover 메뉴: 지역별 = destination만, 테마별 = theme만. 대분류(parent_id null) 있으면 그룹별로 묶어 표시. */
const HUB_MENU_ITEM_LIMIT = 8;
const HUB_MENU_CHILDREN_PER_GROUP_LIMIT = 10;

/** parent_id 기준으로 대분류 → 중분류 → 세부 트리 구성. 헤더용 그룹은 1단계(해외/국내) → 2단계(일본/동남아 등) → 3단계(도쿄/오사카 등) */
function buildRegionGroupsFromTaxonomy(categories: ProductTaxonomy[]): HeaderNavGroup[] {
  const roots = categories.filter((c) => !c.parent_id || c.parent_id.trim() === "");
  const byParent = new Map<string, ProductTaxonomy[]>();
  for (const c of categories) {
    const pid = c.parent_id?.trim();
    if (!pid) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(c);
  }
  const sortByOrderThenName = (a: ProductTaxonomy, b: ProductTaxonomy) => {
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  };
  roots.sort((a, b) => {
    const na = (a.name ?? "").trim();
    const nb = (b.name ?? "").trim();
    if (na === "해외" && nb !== "해외") return -1;
    if (nb === "해외" && na !== "해외") return 1;
    if (na === "국내" && nb !== "국내") return -1;
    if (nb === "국내" && na !== "국내") return 1;
    return sortByOrderThenName(a, b);
  });
  for (const arr of byParent.values()) arr.sort(sortByOrderThenName);

  const groups: HeaderNavGroup[] = [];
  groups.push({
    key: "region-hub",
    label: "지역별 여행",
    items: [
      { key: "region-all", label: "지역 전체 보기", href: "/destinations" },
      { key: "region-products", label: "전체 상품 보기", href: "/products" },
    ],
  });

  if (roots.length > 0) {
    for (const root of roots.slice(0, 6)) {
      const level2List = byParent.get(root.id) ?? [];
      const subGroups = level2List.map((mid) => {
        const level3List = (byParent.get(mid.id) ?? []).slice(0, HUB_MENU_CHILDREN_PER_GROUP_LIMIT);
        const items: HeaderNavLeafItem[] = level3List.map((c) => ({
          key: `region-${c.id}`,
          label: c.name,
          href: getDestinationLandingHref(c),
        }));
        return {
          key: `region-mid-${mid.id}`,
          label: mid.name,
          labelHref: getDestinationLandingHref(mid),
          items,
        };
      });
      groups.push({
        key: `region-group-${root.id}`,
        label: root.name,
        labelHref: getDestinationLandingHref(root),
        items: [],
        subGroups,
      });
    }
  } else {
    const flat = categories.slice(0, HUB_MENU_ITEM_LIMIT).map((c) => ({
      key: `region-${c.id}`,
      label: c.name,
      href: getDestinationLandingHref(c),
    }));
    groups[0].items = [
      { key: "region-all", label: "지역 전체 보기", href: "/destinations" },
      ...flat,
      { key: "region-products", label: "전체 상품 보기", href: "/products" },
    ];
  }

  return groups;
}

function regionGroupsFromTaxonomy(categories: ProductTaxonomy[]): HeaderNavGroup[] {
  return buildRegionGroupsFromTaxonomy(categories);
}

/** 여행추천 메가메뉴 좌열: /products collection 파라미터와 연결된 4개 고정 메뉴 */
const RECOMMEND_COLLECTION_GROUP: HeaderNavGroup = {
  key: "recommended-collection",
  label: "여행추천",
  labelHref: "/recommended",
  items: [
    { key: "recommended-all", label: "전체 여행 보기", href: "/products" },
    { key: "recommended-recommend", label: "추천 여행", href: "/products?collection=recommend" },
    { key: "recommended-popular", label: "인기 여행", href: "/products?collection=popular" },
    { key: "recommended-new", label: "신규 여행", href: "/products?collection=new" },
  ],
};

function buildGolfRecommendMenuGroup(settings: SiteSettings): HeaderNavGroup {
  const golfAllHref = buildGolfProductsHref();
  const regionItems: HeaderNavLeafItem[] = parseGolfHeroRegions(settings.golf_hero_regions).map(
    (region) => {
      const preset = resolveGolfHeroRegionPreset(region);
      return {
        key: `golf-region-${region.id}`,
        label: region.label,
        href: preset
          ? buildGolfProductsHref({ golfRegion: preset })
          : buildGolfProductsHref({ q: region.searchKeyword }),
      };
    },
  );

  return {
    key: "golf-recommend",
    label: "골프여행 추천",
    labelHref: golfAllHref,
    items: [
      { key: "golf-all", label: "골프여행 전체 보기", href: golfAllHref },
      ...regionItems,
    ],
  };
}

function buildRecommendedMenuGroups(settings: SiteSettings): HeaderNavGroup[] {
  return [RECOMMEND_COLLECTION_GROUP, buildGolfRecommendMenuGroup(settings)];
}

/** parent_id 기준으로 대분류 → 세부 테마 트리 구성 후, 헤더용 그룹 배열로 변환. 다단계 하위 항목 평면 포함 */
function buildThemeGroupsFromTaxonomy(themes: ProductTaxonomy[]): HeaderNavGroup[] {
  const roots = themes.filter((t) => !t.parent_id || t.parent_id.trim() === "");
  const byParent = new Map<string, ProductTaxonomy[]>();
  for (const t of themes) {
    const pid = t.parent_id?.trim();
    if (!pid) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(t);
  }
  const sortByOrderThenName = (a: ProductTaxonomy, b: ProductTaxonomy) => {
    const sa = a.sort_order ?? 9999;
    const sb = b.sort_order ?? 9999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? "").localeCompare(b.name ?? "", "ko");
  };
  roots.sort(sortByOrderThenName);
  for (const arr of byParent.values()) arr.sort(sortByOrderThenName);

  function getDescendantsFlat(parentId: string): ProductTaxonomy[] {
    const out: ProductTaxonomy[] = [];
    function visit(pid: string) {
      const children = byParent.get(pid) ?? [];
      for (const c of children) {
        out.push(c);
        visit(c.id);
      }
    }
    visit(parentId);
    return out;
  }

  const groups: HeaderNavGroup[] = [];
  groups.push({
    key: "theme-hub",
    label: "테마별 여행",
    items: [
      { key: "theme-all", label: "테마 전체 보기", href: "/themes" },
      { key: "theme-products", label: "전체 상품 보기", href: "/products" },
    ],
  });

  if (roots.length > 0) {
    for (const root of roots.slice(0, 6)) {
      const descendants = getDescendantsFlat(root.id).slice(0, HUB_MENU_CHILDREN_PER_GROUP_LIMIT);
      const items: HeaderNavLeafItem[] = descendants.map((c) => ({
        key: `theme-${c.id}`,
        label: c.name,
        href: getThemeLandingHref(c),
      }));
      groups.push({
        key: `theme-group-${root.id}`,
        label: root.name,
        labelHref: getThemeLandingHref(root),
        items,
      });
    }
  } else {
    const flat = themes.slice(0, HUB_MENU_ITEM_LIMIT).map((t) => ({
      key: `theme-${t.id}`,
      label: t.name,
      href: getThemeLandingHref(t),
    }));
    groups[0].items = [
      { key: "theme-all", label: "테마 전체 보기", href: "/themes" },
      ...flat,
      { key: "theme-products", label: "전체 상품 보기", href: "/products" },
    ];
  }

  return groups;
}

function themeGroupsFromTaxonomy(themes: ProductTaxonomy[]): HeaderNavGroup[] {
  return buildThemeGroupsFromTaxonomy(themes);
}

async function getHeaderNavigationDataUncached(): Promise<HeaderNavigationData> {
  const [destinations, themes, siteSettings] = await Promise.all([
    getHubDestinations(),
    getHubThemes(),
    getSiteSettings(),
  ]);

  const recommendedGroups = buildRecommendedMenuGroups(siteSettings);
  const regionGroups = regionGroupsFromTaxonomy(destinations);
  const themeGroups = themeGroupsFromTaxonomy(themes);

  const primaryNav: HeaderPrimaryNavItem[] = [
    {
      key: "recommended",
      label: "여행추천",
      href: "/recommended",
      groups: recommendedGroups.length > 0 ? recommendedGroups : [{ key: "recommended-default", label: "추천", items: [{ key: "home", label: "홈", href: "/" }] }],
    },
    {
      key: "region",
      label: "지역별 여행",
      href: "/destinations",
      groups: regionGroups,
    },
    {
      key: "theme",
      label: "테마별 여행",
      href: "/themes",
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
    tags: [CACHE_TAGS.HEADER_NAV, CACHE_TAGS.TAXONOMY, CACHE_TAGS.HOME_CURATED, "site-settings"],
  })();
}
