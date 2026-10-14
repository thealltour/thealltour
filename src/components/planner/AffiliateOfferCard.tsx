"use client";

import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAffiliateOfferTracking } from "@/components/planner/useAffiliateOfferTracking";
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
  const { href, onClick } = useAffiliateOfferTracking({ offer, sessionId, sourceProductId });

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
          onClick={onClick}
        >
          {offer.ctaLabel}
        </a>
      </div>
    </Card>
  );
}
