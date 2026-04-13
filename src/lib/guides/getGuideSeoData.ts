import { getGuideBySlug } from "@/lib/guides";
import { getTaxonomyById } from "@/lib/productTaxonomies";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";

const PLACEHOLDER_SUBSTR = "picsum.photos";

function isSkippableImageUrl(url: string): boolean {
  return url.toLowerCase().includes(PLACEHOLDER_SUBSTR);
}

function pushCandidate(list: string[], seen: Set<string>, siteUrl: string, raw: string | null | undefined) {
  if (!raw?.trim()) return;
  if (isSkippableImageUrl(raw)) return;
  const abs = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : toAbsoluteUrl(siteUrl, raw.trim());
  if (seen.has(abs)) return;
  seen.add(abs);
  list.push(abs);
}

/**
 * 가이드 상세 OG/메타 단일 소스.
 * 이미지: 커버·썸네일 → 연결된 지역/테마 taxonomy 카드·히어로.
 */
export async function getGuideSeoData(slug: string): Promise<OgPageSeoData | null> {
  const rawSlug = slug?.trim();
  if (!rawSlug) return null;

  const guide = await getGuideBySlug(rawSlug);
  if (!guide) return null;

  const siteUrl = getSiteBaseUrl();
  const seen = new Set<string>();
  const imageCandidates: string[] = [];

  pushCandidate(imageCandidates, seen, siteUrl, guide.cover_image_url);
  pushCandidate(imageCandidates, seen, siteUrl, guide.guide_thumbnail_url);
  pushCandidate(imageCandidates, seen, siteUrl, guide.thumbnail_url);

  const [destTax, themeTax] = await Promise.all([
    guide.destination_id?.trim() ? getTaxonomyById(guide.destination_id.trim()) : null,
    guide.theme_id?.trim() ? getTaxonomyById(guide.theme_id.trim()) : null,
  ]);

  if (destTax) {
    pushCandidate(imageCandidates, seen, siteUrl, destTax.hero_image_url);
    pushCandidate(imageCandidates, seen, siteUrl, destTax.card_image_url);
  }
  if (themeTax) {
    pushCandidate(imageCandidates, seen, siteUrl, themeTax.hero_image_url);
    pushCandidate(imageCandidates, seen, siteUrl, themeTax.card_image_url);
  }

  const baseTitle =
    guide.seo_title?.trim() ||
    guide.title_override?.trim() ||
    guide.title?.trim() ||
    "여행 가이드";

  const metaDescription =
    guide.seo_description?.trim() ||
    guide.summary?.trim() ||
    `${baseTitle} 여행 준비와 관련 여행 정보를 더올투어에서 확인해 보세요.`;

  const destinationName =
    guide.destination_name?.trim() || destTax?.name?.trim() || null;
  const themeName = guide.theme_name?.trim() || themeTax?.name?.trim() || null;

  const categoryLabel = guide.category?.trim() || null;
  const subtitleLine =
    [destinationName, themeName].filter(Boolean).join(" · ") ||
    (guide.summary?.trim() ? guide.summary.trim().replace(/\s+/g, " ") : null);

  return {
    type: "guide",
    id: guide.id,
    urlPath: `/guides/${rawSlug}`,
    contentTitle: baseTitle,
    pageTitle: `${baseTitle} | 여행 가이드 | 더올투어`,
    metaDescription,
    imageCandidates,
    primaryImageUrl: imageCandidates[0] ?? null,
    eyebrow: categoryLabel,
    subtitle: subtitleLine ? subtitleLine.slice(0, 160) : null,
    regionLine: destinationName,
    themeLine: themeName,
    badgeLabel: null,
    openGraph: { type: "article" },
    ogImageAlt: baseTitle,
    categoryLabel,
    readingTimeLabel: null,
    useAbsolutePageTitle: true,
  };
}
