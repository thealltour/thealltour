import type { Metadata } from "next";
import { getRegionSeoData } from "@/lib/products/getRegionSeoData";
import { getThemeSeoData } from "@/lib/products/getThemeSeoData";
import { getSiteBaseUrl } from "@/lib/seo/getSiteSeoDefaults";

/** `generateMetadata` 전용 — `/products/region/[slug]` (본문 로더와 분리) */
export async function loadProductRegionLandingMetadata(slugTrimmed: string): Promise<Metadata> {
  const siteUrl = getSiteBaseUrl();
  if (!slugTrimmed) {
    return {
      title: "지역별 여행",
      description: "더올투어 지역별 맞춤 골프·테마 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getRegionSeoData(slugTrimmed);
  const path = `/products/region/${slugTrimmed}`;
  const url = `${siteUrl}${path}`;
  const defaultOgImageUrl = `${siteUrl}/og-default-v1.png`;

  if (!seo) {
    const title = "지역 골프여행 추천";
    const description =
      "지역 골프여행 가격, 일정, 추천 패키지를 한 번에 확인하세요.";
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "website",
        url,
        siteName: "더올투어",
        title,
        description,
        images: [
          {
            url: defaultOgImageUrl,
            width: 1200,
            height: 630,
            alt: "지역 골프여행 추천",
          },
        ],
        locale: "ko_KR",
      },
    };
  }

  const title = `${seo.ogTitle} 골프여행 추천`;
  const description = `${seo.ogTitle} 골프여행 가격, 일정, 추천 패키지를 한 번에 확인하세요.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "더올투어",
      title,
      description,
      images: [
        {
          url: defaultOgImageUrl,
          width: 1200,
          height: 630,
          alt: `${seo.ogTitle} 지역 여행`,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${path}/twitter-image`],
    },
  };
}

/** `generateMetadata` 전용 — `/products/theme/[slug]` (본문 로더와 분리) */
export async function loadProductThemeLandingMetadata(slugTrimmed: string): Promise<Metadata> {
  const siteUrl = getSiteBaseUrl();
  if (!slugTrimmed) {
    return {
      title: "테마별 여행",
      description: "더올투어 테마별 맞춤 여행 상품을 확인해 보세요.",
      alternates: { canonical: `${siteUrl}/products` },
    };
  }

  const seo = await getThemeSeoData(slugTrimmed);
  const path = `/products/theme/${slugTrimmed}`;
  const url = `${siteUrl}${path}`;
  const defaultOgImageUrl = `${siteUrl}/og-default-v1.png`;

  if (!seo) {
    const title = "테마 여행 추천";
    const description =
      "테마 여행을 찾고 있다면 맞춤 일정과 인기 패키지를 확인하세요.";
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "website",
        url,
        siteName: "더올투어",
        title,
        description,
        images: [
          {
            url: defaultOgImageUrl,
            width: 1200,
            height: 630,
            alt: "테마 여행 추천",
          },
        ],
        locale: "ko_KR",
      },
    };
  }

  const title = `${seo.ogTitle} 여행 추천`;
  const description = `${seo.ogTitle} 여행을 찾고 있다면 맞춤 일정과 인기 패키지를 확인하세요.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "더올투어",
      title,
      description,
      images: [
        {
          url: defaultOgImageUrl,
          width: 1200,
          height: 630,
          alt: `${seo.ogTitle} 테마 여행`,
        },
      ],
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${path}/twitter-image`],
    },
  };
}
