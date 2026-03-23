/**
 * 랜딩 페이지용 데이터 로더 (region/theme).
 * 기존 redirect는 유지하고, 후속 PR에서 page가 이 로더를 사용해 실제 랜딩 UI로 전환할 수 있도록 준비.
 * TODO: 후속 PR-34~36에서 taxonomy id 기반 매칭으로 전환 시 문자열(name) 의존 축소 가능.
 */

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { getProducts } from "@/lib/products";
import { getTaxonomyNameBySlug, getActiveTaxonomiesForHeader, parseThemeTokens, getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import { getHomeCuratedData } from "@/lib/homeCurated";
import type { Product } from "@/types/product";
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

/** 옵션으로 하위 지역/테마 id·name 집합을 주면 해당 집합에 포함되는 상품도 매칭 (상위 랜딩 시 하위 포함). */
function matchProductsByTaxonomyName(
  products: Product[],
  type: ProductLandingType,
  taxonomyName: string,
  options?: {
    regionIds?: string[];
    regionNames?: string[];
    themeNames?: string[];
  },
): Product[] {
  const name = taxonomyName.trim();
  if (!name) return [];
  if (type === "region") {
    const idsSet = options?.regionIds?.length ? new Set(options.regionIds) : null;
    const namesSet = options?.regionNames?.length ? new Set(options.regionNames) : null;
    if (idsSet || namesSet) {
      return products.filter((p) => {
        if (p.destination_id && idsSet?.has(p.destination_id)) return true;
        const cat = (p.category ?? "").trim();
        return cat && namesSet?.has(cat) === true;
      });
    }
    return products.filter((p) => (p.category ?? "").trim() === name);
  }
  if (type === "theme") {
    const themeNamesSet = options?.themeNames?.length ? new Set(options.themeNames) : null;
    if (themeNamesSet) {
      return products.filter((p) =>
        parseThemeTokens(p.theme).some((t) => themeNamesSet.has(t.trim())),
      );
    }
    return products.filter((p) => parseThemeTokens(p.theme).includes(name));
  }
  return [];
}

/** Product → 랜딩 카드용 요약. null/undefined 안전 처리. */
export function toLandingProductSummary(product: Product): ProductLandingProductSummary {
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

/** featuredLinks: 전체 상품 보기 + 정렬 링크 + 맞춤 상담. */
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

/** relatedTaxonomies: 반대 축 활성 taxonomy. region 랜딩 → theme만, theme 랜딩 → destination만. taxonomy_type 기준. */
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
 * 추천 상품: home curated에서 해당 taxonomy 매칭 우선, 그 다음 일반 상품 매칭. 중복 제거, 최대 8개.
 * matchOptions 전달 시 해당 taxonomy + 하위 전체가 매칭 대상.
 */
function selectRecommendedProductsForLanding(
  allProducts: Product[],
  curatedProducts: Product[],
  type: ProductLandingType,
  taxonomyName: string,
  matchOptions?: Parameters<typeof matchProductsByTaxonomyName>[3],
): Product[] {
  const matched = matchProductsByTaxonomyName(allProducts, type, taxonomyName, matchOptions);
  const matchedIds = new Set(matched.map((p) => p.id));
  const fromCurated = curatedProducts.filter((p) => matchedIds.has(p.id));
  const curatedIds = new Set(fromCurated.map((p) => p.id));
  const rest = matched.filter((p) => !curatedIds.has(p.id));
  const combined = [...fromCurated, ...rest];
  return combined.slice(0, RECOMMENDED_MAX);
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

  const [products, curatedData, taxonomies] = await Promise.all([
    getProducts(),
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
  const recommended = selectRecommendedProductsForLanding(
    products,
    curatedProducts,
    type,
    taxonomyName,
    matchOptions,
  );
  const matchedAll = matchProductsByTaxonomyName(products, type, taxonomyName, matchOptions);

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
    productCount: matchedAll.length,
  };
}

/**
 * 랜딩 페이지용 데이터 로드. slug로 taxonomy name 조회 후 상품/hero/링크 구성.
 * taxonomy 없으면 null. 후속 PR에서 page가 이 함수를 사용해 redirect 대신 랜딩 UI 렌더 가능.
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
