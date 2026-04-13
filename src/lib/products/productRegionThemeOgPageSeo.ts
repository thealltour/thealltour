import { getRegionSeoData } from "@/lib/products/getRegionSeoData";
import { getThemeSeoData as getProductThemeSeoData } from "@/lib/products/getThemeSeoData";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";

const PLACEHOLDER_SUBSTR = "picsum.photos";

function toImageCandidate(siteUrl: string, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = raw.trim();
  if (u.toLowerCase().includes(PLACEHOLDER_SUBSTR)) return null;
  return /^https?:\/\//i.test(u) ? u : toAbsoluteUrl(siteUrl, u);
}

/** `/products/region/[slug]` — 메타·opengraph-image와 동일 소스 */
export async function getProductRegionOgPageSeo(slug: string): Promise<OgPageSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const siteUrl = getSiteBaseUrl();
  const urlPath = `/products/region/${raw}`;
  const seo = await getRegionSeoData(raw);

  if (!seo) {
    return {
      type: "product_region",
      id: raw,
      urlPath,
      pageTitle: "지역 골프여행 추천",
      metaDescription: "지역 골프여행 가격, 일정, 추천 패키지를 한 번에 확인하세요.",
      imageCandidates: [],
      primaryImageUrl: null,
      eyebrow: "지역",
      subtitle: null,
      regionLine: null,
      themeLine: null,
      badgeLabel: null,
      openGraph: { type: "website" },
      ogImageAlt: "지역 골프여행 추천",
      useAbsolutePageTitle: true,
    };
  }

  const imageCandidates: string[] = [];
  const hero = toImageCandidate(siteUrl, seo.heroImage);
  if (hero) imageCandidates.push(hero);

  return {
    type: "product_region",
    id: seo.slug,
    urlPath,
    pageTitle: `${seo.ogTitle} 골프여행 추천`,
    metaDescription: `${seo.ogTitle} 골프여행 가격, 일정, 추천 패키지를 한 번에 확인하세요.`,
    imageCandidates,
    primaryImageUrl: imageCandidates[0] ?? null,
    eyebrow: "지역",
    subtitle: seo.ogSubtitle,
    regionLine: seo.name,
    themeLine: null,
    badgeLabel: null,
    contentTitle: seo.ogTitle,
    openGraph: { type: "website" },
    ogImageAlt: `${seo.ogTitle} 지역 여행`,
    useAbsolutePageTitle: true,
  };
}

/** `/products/theme/[slug]` — 메타·opengraph-image와 동일 소스 */
export async function getProductThemeOgPageSeo(slug: string): Promise<OgPageSeoData | null> {
  const raw = slug?.trim();
  if (!raw) return null;

  const siteUrl = getSiteBaseUrl();
  const urlPath = `/products/theme/${raw}`;
  const seo = await getProductThemeSeoData(raw);

  if (!seo) {
    return {
      type: "product_theme",
      id: raw,
      urlPath,
      pageTitle: "테마 여행 추천",
      metaDescription: "테마 여행을 찾고 있다면 맞춤 일정과 인기 패키지를 확인하세요.",
      imageCandidates: [],
      primaryImageUrl: null,
      eyebrow: "테마",
      subtitle: null,
      regionLine: null,
      themeLine: null,
      badgeLabel: null,
      openGraph: { type: "website" },
      ogImageAlt: "테마 여행 추천",
      useAbsolutePageTitle: true,
    };
  }

  const imageCandidates: string[] = [];
  const hero = toImageCandidate(siteUrl, seo.heroImage);
  if (hero) imageCandidates.push(hero);

  return {
    type: "product_theme",
    id: seo.slug,
    urlPath,
    pageTitle: `${seo.ogTitle} 여행 추천`,
    metaDescription: `${seo.ogTitle} 여행을 찾고 있다면 맞춤 일정과 인기 패키지를 확인하세요.`,
    imageCandidates,
    primaryImageUrl: imageCandidates[0] ?? null,
    eyebrow: "테마",
    subtitle: seo.ogSubtitle,
    regionLine: null,
    themeLine: seo.name,
    badgeLabel: null,
    contentTitle: seo.ogTitle,
    openGraph: { type: "website" },
    ogImageAlt: `${seo.ogTitle} 테마 여행`,
    useAbsolutePageTitle: true,
  };
}
