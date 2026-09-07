"use client";

import { AffiliateOfferCard } from "@/components/planner/AffiliateOfferCard";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

type AffiliateOfferSlotProps = {
  offers: AffiliateOffer[];
  sessionId: string;
  sourceProductId?: string | null;
  className?: string;
};

/** Renders nothing when offers empty — no placeholders. */
export function AffiliateOfferSlot({
  offers,
  sessionId,
  sourceProductId,
  className,
}: AffiliateOfferSlotProps) {
  if (!offers.length) return null;

  return (
    <div className={className ?? "space-y-3"}>
      {offers.map((offer) => (
        <AffiliateOfferCard
          key={offer.offerId}
          offer={offer}
          sessionId={sessionId}
          sourceProductId={sourceProductId}
        />
      ))}
    </div>
  );
}
