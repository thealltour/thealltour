import { getThemeBySlug, getTaxonomyNameBySlug } from "@/lib/productTaxonomies";
import { themeSeoCopy, ensureLandingDocumentTitle } from "@/lib/seo/landingSeoCopy";

export type ThemeSeoData = {
  slug: string;
  name: string;
  documentTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogSubtitle: string;
  heroImage?: string;
  badge?: string;
};

function normalizeSlugInput(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * `/products/theme/[slug]` — generateMetadata·opengraph-image 공통.
 * 우선순위: DB seo → slug 매핑 → fallback
 */
export async function getThemeSeoData(slug: string): Promise<ThemeSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const normalized = normalizeSlugInput(raw);
  const tax = await getThemeBySlug(raw);
  const map = themeSeoCopy[normalized];

  const name =
    tax?.name?.trim() ||
    (await getTaxonomyNameBySlug("theme", raw)) ||
    normalized.replace(/-/g, " ").trim() ||
    "테마";

  const defaultDescription = `${name}에 맞는 맞춤형 여행 상품을 더올투어에서 만나보세요.`;
  const fallbackOgSubtitle = `${name} 맞춤형 여행 상품`;

  let documentTitle: string;
  if (tax?.seo_title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(tax.seo_title.trim());
  } else if (map?.title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(map.title.trim());
  } else if (tax?.landing_title?.trim()) {
    documentTitle = ensureLandingDocumentTitle(tax.landing_title.trim());
  } else {
    documentTitle = ensureLandingDocumentTitle(name);
  }

  const metaDescription =
    tax?.seo_description?.trim() ||
    map?.description?.trim() ||
    tax?.landing_description?.trim() ||
    defaultDescription;

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
