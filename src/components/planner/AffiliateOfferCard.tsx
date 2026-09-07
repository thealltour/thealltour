"use client";

import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  trackAffiliateClicked,
  trackAffiliateImpression,
} from "@/lib/analytics/trackPlannerEvents";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

type AffiliateOfferCardProps = {
  offer: AffiliateOffer;
  sessionId: string;
  sourceProductId?: string | null;
};

export function AffiliateOfferCard({
  offer,
  sessionId,
  sourceProductId,
}: AffiliateOfferCardProps) {
  const impressed = useRef(false);

  useEffect(() => {
    if (impressed.current) return;
    impressed.current = true;

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

  const href = `/r/affiliate/${encodeURIComponent(offer.trackingToken)}`;

  return (
    <Card className="p-4">
      <div className="space-y-2">
        <p className="type-caption text-[var(--text-muted)]">제휴 링크</p>
        <p className="type-body font-semibold text-[var(--foreground)]">{offer.title}</p>
        {offer.description ? (
          <p className="type-small text-[var(--text-secondary)]">{offer.description}</p>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-1" })}
          onClick={() => {
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
          }}
        >
          {offer.ctaLabel}
        </a>
      </div>
    </Card>
  );
}
