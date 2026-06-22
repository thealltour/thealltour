import { getPublicLandingBySlug } from "@/lib/adminLandings/service";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { regionSeoCopy } from "@/lib/seo/landingSeoCopy";
import type { AdminLandingDetail } from "@/types/adminLanding";

const PLACEHOLDER_SUBSTR = "picsum.photos";

const SECTION_DATA_IMAGE_KEYS = [
  "imageUrl",
  "heroImageUrl",
  "hero_url",
  "backgroundImageUrl",
  "coverImageUrl",
  "thumbnailUrl",
  "cardImageUrl",
];

function isSkippable(url: string): boolean {
  return url.toLowerCase().includes(PLACEHOLDER_SUBSTR);
}

function stringsFromSectionData(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const o = data as Record<string, unknown>;
  const out: string[] = [];
  for (const k of SECTION_DATA_IMAGE_KEYS) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return out;
}

function collectLandingImageRaws(landing: AdminLandingDetail): string[] {
  const raws: string[] = [];
  for (const sec of landing.sections ?? []) {
    if (sec.sectionData) {
      raws.push(...stringsFromSectionData(sec.sectionData));
    }
  }
  return raws;
}

function pushCandidate(
  list: string[],
  seen: Set<string>,
  siteUrl: string,
  raw: string | null | undefined,
) {
  if (!raw?.trim()) return;
  if (isSkippable(raw)) return;
  const abs = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : toAbsoluteUrl(siteUrl, raw.trim());
  if (seen.has(abs)) return;
  seen.add(abs);
  list.push(abs);
}

function rootSlugFromGolfLandingSlug(slug: string): string {
  const s = slug.trim().toLowerCase();
  if (s.endsWith("-golf-travel")) return s.slice(0, -"-golf-travel".length);
  return s;
}

/**
 * `/recommended/[slug]` — `getPublicLandingBySlug`와 동일 조건(공개·landing_enabled)의 OG/메타 스냅샷.
 */
export async function getRecommendedLandingSeoData(slug: string): Promise<OgPageSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const landing = await getPublicLandingBySlug(raw);
  if (!landing?.slug?.trim()) return null;

  const siteUrl = getSiteBaseUrl();
  const pathSlug = landing.slug.trim();
  const urlPath = `/recommended/${pathSlug}`;

  const displayTitle = landing.title?.trim() || pathSlug;
  let contentTitle = landing.seoTitle?.trim() || displayTitle;
  let metaDescription =
    landing.seoDescription?.trim() ||
    landing.summary?.trim() ||
    `${contentTitle} 맞춤 여행 안내와 추천 정보를 더올투어에서 확인해 보세요.`;
  let eyebrow = "추천 여행";

  if (landing.templateType === "destination_golf_consulting") {
    eyebrow = "골프여행";
    const rootSlug = rootSlugFromGolfLandingSlug(pathSlug);
    const seo = regionSeoCopy[rootSlug];
    if (seo?.title?.trim()) {
      contentTitle = seo.title.replace(/\s*\|\s*더올투어\s*$/i, "").trim() || contentTitle;
    }
    if (seo?.description?.trim()) {
      metaDescription = seo.description.trim();
    } else if (!landing.seoDescription?.trim() && !landing.summary?.trim()) {
      metaDescription = `${displayTitle} 골프 상품을 살펴보고, 일정과 예산에 맞는 라운딩 구성은 맞춤 상담으로 확인해 보세요.`;
    }
  }

  const seen = new Set<string>();
  const imageCandidates: string[] = [];

  for (const u of collectLandingImageRaws(landing)) {
    pushCandidate(imageCandidates, seen, siteUrl, u);
  }

  const taxId = landing.sourceTaxonomyId?.trim();
  if (taxId) {
    const tax = await getTaxonomyById(taxId);
    if (tax) {
      pushCandidate(imageCandidates, seen, siteUrl, tax.hero_image_url);
      pushCandidate(imageCandidates, seen, siteUrl, tax.card_image_url);
    }
  }

  return {
    type: "recommended_landing",
    id: landing.id,
    urlPath,
    pageTitle: `${contentTitle} | 더올투어`,
    metaDescription,
    imageCandidates,
    primaryImageUrl: imageCandidates[0] ?? null,
    eyebrow,
    subtitle: landing.summary?.trim() || null,
    regionLine: null,
    themeLine: null,
    badgeLabel: null,
    contentTitle,
    openGraph: { type: "website" },
    ogImageAlt: contentTitle,
    useAbsolutePageTitle: true,
  };
}
