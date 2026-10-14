"use client";

import { ArrowUpRight } from "lucide-react";
import { useAffiliateOfferTracking } from "@/components/planner/useAffiliateOfferTracking";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";

type AffiliateItemCtaProps = {
  offer: AffiliateOffer;
  sessionId: string;
  sourceProductId?: string | null;
};

/** Compact itinerary-item CTA (contextual activity offer for one plan item). */
export function AffiliateItemCta({ offer, sessionId, sourceProductId }: AffiliateItemCtaProps) {
  const { href, onClick } = useAffiliateOfferTracking({ offer, sessionId, sourceProductId });

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"
      data-testid={`planner-item-affiliate-${offer.metadata?.dayNumber ?? "x"}-${offer.metadata?.itemOrder ?? "x"}`}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 type-caption font-medium text-[var(--primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        {offer.ctaLabel}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden={true} />
      </a>
      <span className="type-caption text-[var(--text-muted)]">제휴 링크</span>
    </div>
  );
}
