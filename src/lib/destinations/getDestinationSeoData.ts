import {
  getDestinationBySlugForPublicLanding,
} from "@/lib/productTaxonomies";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { getTaxonomyMetadataFallback } from "@/lib/landingMetadata";

const PLACEHOLDER_SUBSTR = "picsum.photos";

function pushTaxonomyImages(
  list: string[],
  seen: Set<string>,
  siteUrl: string,
  hero: string | null,
  card: string | null,
) {
  const add = (raw: string | null | undefined) => {
    if (!raw?.trim()) return;
    const u = raw.trim();
    if (u.toLowerCase().includes(PLACEHOLDER_SUBSTR)) return;
    const abs = /^https?:\/\//i.test(u) ? u : toAbsoluteUrl(siteUrl, u);
    if (seen.has(abs)) return;
    seen.add(abs);
    list.push(abs);
  };
  add(hero);
  add(card);
}

/** 목적지 랜딩 OG/메타 단일 소스 */
export async function getDestinationSeoData(slug: string): Promise<OgPageSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const destination = await getDestinationBySlugForPublicLanding(raw);
  if (!destination) return null;

  const { title, description } = getTaxonomyMetadataFallback(destination);

  const siteUrl = getSiteBaseUrl();
  const seen = new Set<string>();
  const imageCandidates: string[] = [];
  pushTaxonomyImages(
    imageCandidates,
    seen,
    siteUrl,
    destination.hero_image_url?.trim() || null,
    destination.card_image_url?.trim() || null,
  );

  const displayName = destination.landing_title?.trim() || destination.name.trim() || title;
  const metaDescription =
    description.trim() ||
    `${displayName} 지역 여행·골프·패키지 상품을 만나보세요.`;

  const subtitle =
    description.trim() ||
    `${displayName} 지역의 여행·골프·패키지 상품을 소개합니다.`;

  return {
    type: "destination",
    id: destination.id,
    urlPath: `/destinations/${raw}`,
    contentTitle: displayName,
    pageTitle: `${title} | 더올투어`,
    metaDescription,
    imageCandidates,
    primaryImageUrl: imageCandidates[0] ?? null,
    eyebrow: "여행지",
    subtitle: subtitle.length > 140 ? `${subtitle.slice(0, 137)}…` : subtitle,
    regionLine: destination.name.trim(),
    themeLine: null,
    badgeLabel: null,
    openGraph: { type: "website" },
    ogImageAlt: displayName,
    useAbsolutePageTitle: true,
  };
}
