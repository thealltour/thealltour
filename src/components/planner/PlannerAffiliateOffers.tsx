"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AffiliateOfferSlot } from "@/components/planner/AffiliateOfferSlot";
import { getUnattachedDayOffers } from "@/lib/affiliate/planner/contextualOffers";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import type { PlannerAffiliateOffersDto } from "@/lib/affiliate/planner/types";

type PlannerAffiliateOffersProps = {
  sessionId: string;
  sourceProductId: string | null;
  /** Bumped when the plan changes (e.g. AI edit); triggers one re-fetch per change. */
  planRevision?: number;
  children: (offers: PlannerAffiliateOffersDto) => ReactNode;
};

const EMPTY: PlannerAffiliateOffersDto = {
  summary: [],
  preparation: [],
  days: {},
  disclosure: null,
};

/**
 * Loads affiliate offers once per Result view and once per plan revision (progressive enhancement).
 * Always soft-fetches; server master/rollout gates visibility.
 * Client compile-time flag must not block local/dev env override QA.
 */
export function PlannerAffiliateOffersProvider({
  sessionId,
  sourceProductId: _ignoredSourceProductId,
  planRevision = 0,
  children,
}: PlannerAffiliateOffersProps) {
  void _ignoredSourceProductId;
  const requestKey = `${sessionId}:${planRevision}`;
  const [loaded, setLoaded] = useState<{ key: string; offers: PlannerAffiliateOffersDto } | null>(
    null,
  );
  const offers = loaded?.key === requestKey ? loaded.offers : EMPTY;

  useEffect(() => {
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
          setLoaded({ key: requestKey, offers: data.offers });
        }
      } catch {
        /* soft fail */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, requestKey]);

  return <>{children(offers)}</>;
}

/** @deprecated Prefer PlannerBookingSurface for global offers. Kept for Day contextual only. */
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

/** @deprecated Prefer PlannerBookingSurface for preparation categories. */
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

/** Day-level offers not tied to a specific item (item offers render inside PlannerDaySection). */
export function PlannerAffiliateDaySlot(props: {
  offers: PlannerAffiliateOffersDto;
  dayNumber: number;
  sessionId: string;
  sourceProductId: string | null;
}) {
  const dayOffers = getUnattachedDayOffers(props.offers, props.dayNumber);
  return (
    <AffiliateOfferSlot
      offers={dayOffers}
      sessionId={props.sessionId}
      sourceProductId={props.sourceProductId}
    />
  );
}
