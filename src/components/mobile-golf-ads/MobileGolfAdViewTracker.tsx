"use client";

import { useEffect, useRef } from "react";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";

type MobileGolfAdViewTrackerProps = {
  slug: string;
  sourcePath: string;
};

export function MobileGolfAdViewTracker({ slug, sourcePath }: MobileGolfAdViewTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackClientAnalytics({
      eventName: ANALYTICS_EVENTS.landing_view,
      source: ANALYTICS_SOURCES.recommended_landing,
      pagePath: sourcePath,
      sourcePath,
      landingSlug: slug,
      templateType: "mobile_golf_ad",
      metadata: { landingKind: "mobile_golf_ad" },
    });
  }, [slug, sourcePath]);

  return null;
}
