import { getPublicLandingBySlug } from "@/lib/adminLandings/service";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
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
  const contentTitle = landing.seoTitle?.trim() || displayTitle;
  const metaDescription =
    landing.seoDescription?.trim() ||
    landing.summary?.trim() ||
    `${contentTitle} 맞춤 여행 안내와 추천 정보를 더올투어에서 확인해 보세요.`;

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
    eyebrow: "추천 여행",
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
