"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  trackAffiliateClicked,
  trackAffiliateImpression,
} from "@/lib/analytics/trackPlannerEvents";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

/**
 * Shared affiliate offer tracking: one impression per tracking token per mount,
 * server impression ping, click analytics, and the token-only redirect href.
 */
export function useAffiliateOfferTracking(params: {
  offer: AffiliateOffer;
  sessionId: string;
  sourceProductId?: string | null;
}): { href: string; onClick: () => void } {
  const { offer, sessionId, sourceProductId } = params;
  const impressedToken = useRef<string | null>(null);

  useEffect(() => {
    if (impressedToken.current === offer.trackingToken) return;
    impressedToken.current = offer.trackingToken;

    trackAffiliateImpression({
      sessionId,
      providerId: offer.providerId,
      category: offer.category,
      placement: offer.placement,
      destination: offer.destinationLabel,
      sourceProductId,
      dayNumber: offer.metadata?.dayNumber,
      itemOrder: offer.metadata?.itemOrder,
      trackingToken: offer.trackingToken,
    });

    void fetch("/api/affiliate/impression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingToken: offer.trackingToken }),
    }).catch(() => {
      /* soft fail */
    });
  }, [offer, sessionId, sourceProductId]);

  const onClick = useCallback(() => {
    trackAffiliateClicked({
      sessionId,
      providerId: offer.providerId,
      category: offer.category,
      placement: offer.placement,
      destination: offer.destinationLabel,
      sourceProductId,
      dayNumber: offer.metadata?.dayNumber,
      itemOrder: offer.metadata?.itemOrder,
      trackingToken: offer.trackingToken,
    });
  }, [offer, sessionId, sourceProductId]);

  return {
    href: `/r/affiliate/${encodeURIComponent(offer.trackingToken)}`,
    onClick,
  };
}
