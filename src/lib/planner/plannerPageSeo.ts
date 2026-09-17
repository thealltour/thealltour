import type { Metadata } from "next";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";

/** Public Planner landing SEO — indexable. */
export function buildPlannerLandingPageMetadata(): Metadata {
  const base = buildOgBrandFallbackMetadata({
    canonicalPath: "/planner",
    documentTitle: "자유여행 플래너 | 더올투어",
    description:
      "출발지와 목적지, 여행 날짜, 동행, 취향을 입력하면 더올투어가 맞춤 자유여행 일정을 만들어드립니다.",
    ogImageAlt: "자유여행 플래너",
    openGraphType: "website",
    useAbsolutePageTitle: true,
  });

  return {
    ...base,
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Private result page SEO — noindex; canonical points at public landing.
 * Does not read session/plan data.
 */
export function buildPlannerResultPageMetadata(): Metadata {
  const base = buildOgBrandFallbackMetadata({
    canonicalPath: "/planner",
    documentTitle: "나의 자유여행 플랜 | 더올투어",
    description: "입력하신 조건으로 만든 자유여행 일정 초안입니다.",
    ogImageAlt: "자유여행 플랜",
    openGraphType: "website",
    useAbsolutePageTitle: true,
  });

  return {
    ...base,
    robots: {
      index: false,
      follow: true,
    },
  };
}
