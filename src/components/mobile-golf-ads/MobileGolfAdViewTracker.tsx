"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { KAKAO_SYNC_LANDING_VIEW_COOKIE } from "@/lib/analytics/kakaoSyncLandingHit";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";

type MobileGolfAdViewTrackerProps = {
  slug: string;
  sourcePath: string;
};

function hasMiddlewareViewCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${KAKAO_SYNC_LANDING_VIEW_COOKIE}=`));
}

export function MobileGolfAdViewTracker({ slug, sourcePath }: MobileGolfAdViewTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (hasMiddlewareViewCookie()) return;
    trackClientAnalytics({
      eventName: ANALYTICS_EVENTS.landing_view,
      source: ANALYTICS_SOURCES.recommended_landing,
      pagePath: sourcePath,
      sourcePath,
      landingSlug: slug,
      templateType: "mobile_golf_ad",
      metadata: {
        funnel: "kakao_sync",
        landingKind: "mobile_golf_ad",
        ingest: "client",
      },
    });
  }, [slug, sourcePath]);

  return null;
}
