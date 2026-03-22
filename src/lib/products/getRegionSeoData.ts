import { getDestinationBySlug, getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { regionSeoCopy, ensureLandingDocumentTitle } from "@/lib/seo/landingSeoCopy";

export type RegionSeoData = {
  slug: string;
  name: string;
  /** `<title>` 전체 — layout 템플릿과 중복되지 않게 `absolute` 로 사용 */
  documentTitle: string;
  metaDescription: string;
  /** OG 카드 메인 (짧은 시각적 제목) */
  ogTitle: string;
  /** OG 카드 보조 한 줄 */
  ogSubtitle: string;
  heroImage?: string;
  badge?: string;
};

function normalizeSlugInput(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * `/products/region/[slug]` — generateMetadata·opengraph-image 공통.
 * 우선순위: DB seo → slug 매핑 → fallback
 */
export async function getRegionSeoData(slug: string): Promise<RegionSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const normalized = normalizeSlugInput(raw);
  const tax = await getDestinationBySlug(raw);
  const map = regionSeoCopy[normalized];

  const name =
    tax?.name?.trim() ||
    (await getTaxonomyNameBySlug("category", raw)) ||
    normalized.replace(/-/g, " ").trim() ||
    "지역";

  const fallbackDescription = `${name} 지역 맞춤 골프·테마 여행 상품을 한눈에 확인하세요.`;
  const fallbackOgSubtitle = "맞춤형 골프·테마 여행";

  let documentTitle: string;
  if (tax?.seo_title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(tax.seo_title.trim());
  } else if (map?.title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(map.title.trim());
  } else if (tax?.landing_title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(tax.landing_title.trim());
  } else {
    documentTitle = ensureLandingDocumentTitle(`${name} 골프투어`);
  }

  const metaDescription =
    tax?.seo_description?.trim() ||
    map?.description?.trim() ||
    tax?.landing_description?.trim() ||
    fallbackDescription;

  const ogTitle = map?.ogTitle?.trim() || name;
  const ogSubtitle = map?.ogSubtitle?.trim() || fallbackOgSubtitle;

  const heroImage =
    tax?.card_image_url?.trim() || tax?.hero_image_url?.trim() || undefined;

  return {
    slug: normalized,
    name,
    documentTitle,
    metaDescription,
    ogTitle,
    ogSubtitle,
    heroImage,
  };
}
