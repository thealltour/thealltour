"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AffiliateOfferSlot } from "@/components/planner/AffiliateOfferSlot";
import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";

type PlannerAffiliateOffersProps = {
  sessionId: string;
  sourceProductId: string | null;
  children: (offers: PlannerAffiliateOffersDto) => ReactNode;
};

const EMPTY: PlannerAffiliateOffersDto = {
  summary: [],
  preparation: [],
  days: {},
  disclosure: null,
};

/**
 * Loads affiliate offers once per Result view (progressive enhancement).
 */
export function PlannerAffiliateOffersProvider({
  sessionId,
  sourceProductId: _ignoredSourceProductId,
  children,
}: PlannerAffiliateOffersProps) {
  void _ignoredSourceProductId;
  const [offers, setOffers] = useState<PlannerAffiliateOffersDto>(EMPTY);
  const loaded = useRef(false);

  useEffect(() => {
    if (!ENABLE_PLANNER_AFFILIATE_ROUTER || loaded.current) return;
    loaded.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const anonymousKey = getOrCreatePlannerAnonymousKey();
        const res = await fetch(
          `/api/planner/sessions/${encodeURIComponent(sessionId)}/affiliate-offers`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ anonymousKey }),
          },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json().catch(() => null)) as {
          offers?: PlannerAffiliateOffersDto;
        } | null;
        if (!cancelled && data?.offers) {
          setOffers(data.offers);
        }
      } catch {
        /* soft fail */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!ENABLE_PLANNER_AFFILIATE_ROUTER) {
    return <>{children(EMPTY)}</>;
  }

  return <>{children(offers)}</>;
}

export function PlannerAffiliateSummarySlot(props: {
  offers: PlannerAffiliateOffersDto;
  sessionId: string;
  sourceProductId: string | null;
}) {
  if (!props.offers.summary.length) return null;
  return (
    <div className="space-y-3">
      <AffiliateOfferSlot
        offers={props.offers.summary}
        sessionId={props.sessionId}
        sourceProductId={props.sourceProductId}
      />
      {props.offers.disclosure ? (
        <p className="type-caption text-[var(--text-muted)]">{props.offers.disclosure}</p>
      ) : null}
    </div>
  );
}

export function PlannerAffiliatePreparationSlot(props: {
  offers: PlannerAffiliateOffersDto;
  sessionId: string;
  sourceProductId: string | null;
}) {
  return (
    <AffiliateOfferSlot
      offers={props.offers.preparation}
      sessionId={props.sessionId}
      sourceProductId={props.sourceProductId}
    />
  );
}

export function PlannerAffiliateDaySlot(props: {
  offers: PlannerAffiliateOffersDto;
  dayNumber: number;
  sessionId: string;
  sourceProductId: string | null;
}) {
  const dayOffers = props.offers.days[String(props.dayNumber)] ?? [];
  return (
    <AffiliateOfferSlot
      offers={dayOffers}
      sessionId={props.sessionId}
      sourceProductId={props.sourceProductId}
    />
  );
}
