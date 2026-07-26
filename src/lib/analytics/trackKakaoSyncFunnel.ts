/**
 * 카카오싱크 랜딩 → 간편가입 CTA 계측 + OAuth start URL 빌드.
 */

import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { getAttributionTouch } from "@/lib/analytics/firstTouch";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";
import { MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL } from "@/lib/adminMobileGolfAds/types";
import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
} from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";

export type KakaoSyncCtaTrackInput = {
  landingSlug: string;
  sourcePath: string;
  templateType: string;
  label: string;
  href?: string;
  /** CTA 노출 위치 — 대시보드 집계(section)는 그대로 두고 metadata로만 세분화 */
  ctaPlacement?: "fixed" | "inline";
};

/** landing_cta_click fire-and-forget */
export function trackKakaoSyncCtaClick(input: KakaoSyncCtaTrackInput): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.landing_cta_click,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: input.sourcePath,
    sourcePath: input.sourcePath,
    landingSlug: input.landingSlug,
    templateType: input.templateType,
    section: "kakao_sync_cta",
    label: input.label,
    href: input.href ?? MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL,
    metadata: {
      funnel: "kakao_sync",
      landingKind: input.templateType,
      ingest: "client",
      ctaPlacement: input.ctaPlacement ?? "fixed",
    },
  });
}

/**
 * first_touch/UTM을 query로 실어 OAuth start URL 생성.
 * 서버 start 라우트가 state.acquisition에 넣는다.
 */
export function buildKakaoSyncAuthStartHref(opts?: {
  next?: string;
  landingSlug?: string;
  sourcePath?: string;
}): string {
  const base = MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL;
  const url = new URL(base, typeof window !== "undefined" ? window.location.origin : "https://thealltour.com");
  if (opts?.next) url.searchParams.set("next", opts.next);

  const touch = typeof window !== "undefined" ? getAttributionTouch() : null;
  const landingSlug = opts?.landingSlug?.trim() || KAKAO_SYNC_GOLF_LANDING_SLUG;
  const sourcePath =
    opts?.sourcePath?.trim() ||
    (typeof window !== "undefined" ? window.location.pathname : KAKAO_SYNC_GOLF_PUBLIC_PATH);

  url.searchParams.set("landing_slug", landingSlug);
  url.searchParams.set("landing_path", sourcePath);

  if (touch?.utm_source) url.searchParams.set("utm_source", touch.utm_source);
  if (touch?.utm_medium) url.searchParams.set("utm_medium", touch.utm_medium);
  if (touch?.utm_campaign) url.searchParams.set("utm_campaign", touch.utm_campaign);
  if (touch?.utm_term) url.searchParams.set("utm_term", touch.utm_term);
  if (touch?.utm_content) url.searchParams.set("utm_content", touch.utm_content);

  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function trackKakaoSyncLandingView(input: {
  landingSlug: string;
  sourcePath: string;
  templateType: string;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.landing_view,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: input.sourcePath,
    sourcePath: input.sourcePath,
    landingSlug: input.landingSlug,
    templateType: input.templateType,
    metadata: {
      funnel: "kakao_sync",
      landingKind: input.templateType,
      ingest: "client",
    },
  });
}

/**
 * 섹션 스크롤 노출 계측 — 어디까지 보고 이탈/클릭하는지 파악용 (fire-and-forget, 1회성).
 * 이번 단계는 이벤트 적재만 하며, 어드민 대시보드 시각화는 후속 작업.
 */
export function trackKakaoSyncSectionView(input: {
  landingSlug: string;
  sourcePath: string;
  templateType: string;
  sectionName: string;
}): void {
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.landing_section_view,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: input.sourcePath,
    sourcePath: input.sourcePath,
    landingSlug: input.landingSlug,
    templateType: input.templateType,
    section: input.sectionName,
    metadata: {
      funnel: "kakao_sync",
      landingKind: input.templateType,
      ingest: "client",
    },
  });
}

export { KAKAO_SYNC_GOLF_LANDING_SLUG, KAKAO_SYNC_GOLF_PUBLIC_PATH, KAKAO_SYNC_GOLF_TEMPLATE_TYPE };
