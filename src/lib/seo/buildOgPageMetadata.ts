import type { Metadata } from "next";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";
import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";

export const OG_CARD_SIZE = { width: 1200, height: 630 } as const;

const BRAND_DEFAULT_OG_PATH = "/og-default-v1.png";

export type BuildOgPageMetadataArgs = {
  siteUrl: string;
  canonicalPath: string;
  documentTitle: string;
  description: string;
  /**
   * 동적 OG 라우트 경로(선행 슬래시). null이면 `BRAND_DEFAULT_OG_PATH` 사용.
   */
  ogImagePath: string | null;
  twitterImagePath?: string | null;
  ogImageAlt: string;
  openGraphType?: "website" | "article";
  /** layout `title.template`과 이중 접미사 방지 */
  useAbsolutePageTitle?: boolean;
};

function joinUrl(siteUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${p}`;
}

/**
 * 공통 Open Graph / Twitter / canonical 메타 조립.
 * 개별 page.tsx는 이미지 후보 계산 없이 getter + 이 빌더만 호출하도록 맞춘다.
 */
export function buildOgPageMetadata(args: BuildOgPageMetadataArgs): Metadata {
  const canonicalUrl = joinUrl(args.siteUrl, args.canonicalPath);
  const ogPath = args.ogImagePath ?? BRAND_DEFAULT_OG_PATH;
  const ogAbs = joinUrl(args.siteUrl, ogPath);
  const twPath = args.twitterImagePath ?? args.ogImagePath ?? BRAND_DEFAULT_OG_PATH;
  const twAbs = joinUrl(args.siteUrl, twPath);

  const titleField: Metadata["title"] = args.useAbsolutePageTitle
    ? { absolute: args.documentTitle }
    : args.documentTitle;

  return {
    title: titleField,
    description: args.description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: args.openGraphType ?? "website",
      url: canonicalUrl,
      siteName: "더올투어",
      title: args.documentTitle,
      description: args.description,
      images: [
        {
          url: ogAbs,
          width: OG_CARD_SIZE.width,
          height: OG_CARD_SIZE.height,
          alt: args.ogImageAlt,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: args.documentTitle,
      description: args.description,
      images: [twAbs],
    },
  };
}

/** `urlPath` 기준 기본 동적 OG 라우트 (루트는 앱 루트의 opengraph-image). */
export function defaultOgImagePathsForUrlPath(urlPath: string): { og: string; twitter: string } {
  const p = urlPath.trim();
  if (!p || p === "/") {
    return { og: "/opengraph-image", twitter: "/twitter-image" };
  }
  const base = p.replace(/\/$/, "");
  return { og: `${base}/opengraph-image`, twitter: `${base}/twitter-image` };
}

/**
 * `OgPageSeoData` + 해당 페이지 전용 opengraph/twitter 경로로 메타 생성.
 */
export function buildOgMetadataFromSeoData(seo: OgPageSeoData): Metadata {
  const siteUrl = getSiteBaseUrl();
  const defaults = defaultOgImagePathsForUrlPath(seo.urlPath);
  const ogImagePath = seo.ogImageRoute ?? defaults.og;
  const twitterImagePath = seo.twitterImageRoute ?? defaults.twitter;
  return buildOgPageMetadata({
    siteUrl,
    canonicalPath: seo.urlPath,
    documentTitle: seo.pageTitle,
    description: seo.metaDescription,
    ogImagePath,
    twitterImagePath,
    ogImageAlt: seo.ogImageAlt,
    openGraphType: seo.openGraph.type,
    useAbsolutePageTitle: seo.useAbsolutePageTitle,
  });
}

/**
 * 콘텐츠 없음·비활성 등: 브랜드 기본 OG PNG + 안내 문구.
 */
export function buildOgBrandFallbackMetadata(input: {
  canonicalPath: string;
  documentTitle: string;
  description: string;
  ogImageAlt?: string;
  openGraphType?: "website" | "article";
  useAbsolutePageTitle?: boolean;
}): Metadata {
  const siteUrl = getSiteBaseUrl();
  return buildOgPageMetadata({
    siteUrl,
    canonicalPath: input.canonicalPath,
    documentTitle: input.documentTitle,
    description: input.description,
    ogImagePath: null,
    ogImageAlt: input.ogImageAlt ?? input.documentTitle,
    openGraphType: input.openGraphType ?? "website",
    useAbsolutePageTitle: input.useAbsolutePageTitle,
  });
}
