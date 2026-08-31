/**
 * 랜딩 페이지용 데이터 로더 (region/theme).
 * POST-UI-01D-2A: bounded ProductListItem — no getProducts() full catalog.
 */

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import {
  countProductListItems,
  getProductListItems,
  restoreProductListItemOrderByIds,
} from "@/lib/products/getProductListItems";
import type { ProductCardSource, ProductListItem } from "@/lib/products/productListItem";
import { getTaxonomyNameBySlug, getActiveTaxonomiesForHeader, parseThemeTokens, getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type {
  ProductLandingData,
  ProductLandingHero,
  ProductLandingFeaturedLink,
  ProductLandingProductSummary,
  ProductLandingType,
} from "@/types/productLanding";

const RECOMMENDED_MAX = 8;
/** Fetch enough remaining candidates after curated merge. */
const REMAINING_FETCH_LIMIT = 24;

function productMatchesLandingScope(
  product: ProductCardSource,
  type: ProductLandingType,
  taxonomyName: string,
  options?: {
    regionIds?: string[];
    regionNames?: string[];
    themeNames?: string[];
  },
): boolean {
  const name = taxonomyName.trim();
  if (!name) return false;
  if (type === "region") {
    const idsSet = options?.regionIds?.length ? new Set(options.regionIds) : null;
    const namesSet = options?.regionNames?.length ? new Set(options.regionNames) : null;
    if (idsSet || namesSet) {
      if (product.destination_id && idsSet?.has(product.destination_id)) return true;
      const cat = (product.category ?? "").trim();
      return Boolean(cat && namesSet?.has(cat));
    }
    return (product.category ?? "").trim() === name;
  }
  if (type === "theme") {
    const themeNamesSet = options?.themeNames?.length ? new Set(options.themeNames) : null;
    if (themeNamesSet) {
      return parseThemeTokens(product.theme).some((t) => themeNamesSet.has(t.trim()));
    }
    return parseThemeTokens(product.theme).includes(name);
  }
  return false;
}

/** Product → 랜딩 카드용 요약. null/undefined 안전 처리. */
export function toLandingProductSummary(
  product: ProductCardSource & { description?: string | null },
): ProductLandingProductSummary {
  const id = product.id ?? "";
  const title = product.title ?? "상품명 미정";
  const description = product.description ?? null;
  const imageUrl = product.image_url ?? null;
  const price = product.price != null ? product.price : null;
  const href = id ? `/products/${encodeURIComponent(id)}` : "/products";
  const categories = product.category ? [product.category] : [];
  const themes = product.theme ? parseThemeTokens(product.theme) : [];
  return {
    id,
    title,
    imageUrl,
    description,
    price,
    href,
    categories,
    themes,
    badges: buildCampaignRepresentativeBadges(product, { max: 2 }),
  };
}

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

function buildLandingFeaturedLinks(type: ProductLandingType, taxonomyName: string): ProductLandingFeaturedLink[] {
  const baseHref =
    type === "region"
      ? `/products?region=${encodeURIComponent(taxonomyName)}`
      : `/products?theme=${encodeURIComponent(taxonomyName)}`;
  return [
    { key: "all", label: "전체 상품 보기", href: baseHref },
    { key: "popular", label: "인기순", href: `${baseHref}&sort=popular` },
    { key: "new", label: "신규순", href: `${baseHref}&sort=new` },
    { key: "consult", label: "맞춤 상담 문의", href: "/quote" },
  ];
}

function buildLandingRelatedTaxonomies(
  type: ProductLandingType,
  taxonomies: ProductTaxonomy[],
  _currentName: string,
): ProductLandingFeaturedLink[] {
  const pathSegment = type === "region" ? "theme" : "region";
  const queryKey = type === "region" ? "theme" : "region";
  const targetType = type === "region" ? "theme" : "destination";
  const list = taxonomies
    .filter((t) => t.taxonomy_type === targetType)
    .slice(0, 6)
    .map((t) => ({
      key: `related-${t.id}-${t.slug ?? t.name}`,
      label: t.name,
      href: t.slug
        ? `/products/${pathSegment}/${encodeURIComponent(t.slug.trim().toLowerCase().replace(/\s+/g, "-"))}`
        : `/products?${queryKey}=${encodeURIComponent(t.name)}`,
    }));
  return list;
}

/**
 * curated matching (curated order) first, then catalog-order remaining. Max RECOMMENDED_MAX.
 */
function selectRecommendedFromPools(
  curatedMatching: ProductListItem[],
  remainingMatching: ProductListItem[],
): ProductListItem[] {
  const curatedIds = new Set(curatedMatching.map((p) => p.id));
  const rest = remainingMatching.filter((p) => !curatedIds.has(p.id));
  const seen = new Set<string>();
  const out: ProductListItem[] = [];
  for (const p of [...curatedMatching, ...rest]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= RECOMMENDED_MAX) break;
  }
  return out;
}

async function getProductLandingDataUncached(params: {
  type: ProductLandingType;
  slug: string;
}): Promise<ProductLandingData | null> {
  const { type, slug } = params;
  const normalizedSlug = slug?.trim();
  if (!normalizedSlug) return null;

  const taxonomyName = await getTaxonomyNameBySlug(type === "region" ? "category" : "theme", normalizedSlug);
  if (!taxonomyName) return null;

  const [curatedData, taxonomies] = await Promise.all([
    getHomeCuratedData(),
    getActiveTaxonomiesForHeader(),
  ]);

  const curatedProducts = curatedData.sections.flatMap((s) => s.products ?? []);
  const destinations = taxonomies.filter((t) => t.taxonomy_type === "destination");
  const themes = taxonomies.filter((t) => t.taxonomy_type === "theme");
  const regionSet =
    type === "region" ? getSelfAndDescendantIdsAndNames(destinations, taxonomyName) : null;
  const themeSet =
    type === "theme" ? getSelfAndDescendantIdsAndNames(themes, taxonomyName) : null;
  const matchOptions =
    type === "region" && regionSet
      ? { regionIds: regionSet.ids, regionNames: regionSet.names }
      : type === "theme" && themeSet
        ? { themeNames: themeSet.names }
        : undefined;

  const scopeFilter =
    type === "region" && regionSet
      ? { destinationScope: { ids: regionSet.ids, names: regionSet.names } }
      : type === "theme" && themeSet
        ? { themeNames: themeSet.names }
        : type === "region"
          ? { categoryExact: taxonomyName }
          : { themeTokenExact: taxonomyName };

  const curatedMatchingSources = curatedProducts.filter((p) =>
    productMatchesLandingScope(p, type, taxonomyName, matchOptions),
  );
  const curatedMatchingIds = curatedMatchingSources.map((p) => p.id);

  const [productCount, curatedListItems, remainingItems] = await Promise.all([
    countProductListItems(scopeFilter),
    curatedMatchingIds.length > 0
      ? getProductListItems({ ids: curatedMatchingIds, limit: curatedMatchingIds.length }).then(
          (items) => restoreProductListItemOrderByIds(curatedMatchingIds, items),
        )
      : Promise.resolve([] as ProductListItem[]),
    getProductListItems({ ...scopeFilter, limit: REMAINING_FETCH_LIMIT }),
  ]);

  const recommended = selectRecommendedFromPools(curatedListItems, remainingItems);

  const currentTaxonomy =
    taxonomies.find(
      (t) =>
        t.taxonomy_type === (type === "region" ? "destination" : "theme") &&
        (t.name === taxonomyName ||
          (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug.toLowerCase())),
    ) ?? null;
  const hero = buildLandingHero(type, taxonomyName, normalizedSlug, currentTaxonomy);
  const featuredLinks = buildLandingFeaturedLinks(type, taxonomyName);
  const relatedTaxonomies = buildLandingRelatedTaxonomies(type, taxonomies, taxonomyName);

  const taxonomySlug =
    taxonomies.find(
      (t) =>
        t.taxonomy_type === (type === "region" ? "destination" : "theme") &&
        (t.name === taxonomyName || (t.slug && t.slug.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug.toLowerCase())),
    )?.slug ?? null;

  return {
    type,
    slug: normalizedSlug,
    taxonomyName,
    taxonomySlug,
    hero,
    featuredLinks,
    recommendedProducts: recommended.map(toLandingProductSummary),
    relatedTaxonomies,
    productCount,
  };
}

/**
 * 랜딩 페이지용 데이터 로드. slug로 taxonomy name 조회 후 상품/hero/링크 구성.
 */
export async function getProductLandingData(params: {
  type: ProductLandingType;
  slug: string;
}): Promise<ProductLandingData | null> {
  const cacheKey = `product-landing:${params.type}:${params.slug.trim().toLowerCase()}`;
  return unstable_cache(getProductLandingDataUncached, [cacheKey], {
    revalidate: 60,
    tags: [CACHE_TAGS.TAXONOMY, CACHE_TAGS.HOME_CURATED, CACHE_TAGS.PRODUCTS],
  })(params);
}
