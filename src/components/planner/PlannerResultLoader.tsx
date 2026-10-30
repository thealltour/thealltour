"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import AlertCard from "@/components/ui/AlertCard";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import { postPlannerSessionClaim } from "@/lib/planner/claimClient";
import {
  fetchPlannerMemberAuthenticated,
  postPlannerSessionSave,
} from "@/lib/planner/saveClient";
import {
  trackPlannerEnrichmentFailed,
  trackPlannerEnrichmentLoaded,
  trackPlannerGuestPlanClaimed,
  trackPlannerGuestPlanClaimFailed,
  trackPlannerRoutesFailed,
  trackPlannerRoutesLoaded,
  trackPlannerSaved,
} from "@/lib/analytics/trackPlannerEvents";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import type { PlannerEnrichmentDto } from "@/lib/planner/enrichmentTypes";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { PLANNER_PACES } from "@/lib/planner/schemas";
import type { PlannerPace } from "@/types/planner";
import {
  clearPlannerContinuationIntent,
  consumeMatchingPlannerContinuationIntent,
} from "@/lib/planner/continuationIntent";
import {
  clearPlannerSaveIntent,
  consumeMatchingPlannerSaveIntent,
} from "@/lib/planner/saveIntent";

type ReadResponse = {
  message?: string;
  session?: {
    id: string;
    status: string;
    plan: PlannerPlan | null;
    sourceProductId?: string | null;
    isSaved?: boolean;
    isOwner?: boolean;
    updatedAt?: string;
    input?: {
      origin?: { text?: string } | null;
      destination?: { text?: string };
      pace?: string;
    };
  };
};

type EnrichResponse = {
  enrichment?: PlannerEnrichmentDto;
  message?: string;
};

type PlannerResultLoaderProps = {
  sessionId: string;
};

export function PlannerResultLoader({ sessionId }: PlannerResultLoaderProps) {
  const [plan, setPlan] = useState<PlannerPlan | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [planRevision, setPlanRevision] = useState(0);
  const [originText, setOriginText] = useState<string | null>(null);
  const [pace, setPace] = useState<PlannerPace | null>(null);
  const [sourceProductId, setSourceProductId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isMemberLinked, setIsMemberLinked] = useState(false);
  const [enrichment, setEnrichment] = useState<PlannerEnrichmentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const autoSaveAttempted = useRef(false);
  const autoClaimAttempted = useRef(false);
  const enrichTracked = useRef(false);

  const loadEnrichment = useCallback(async () => {
    try {
      const anonymousKey = getOrCreatePlannerAnonymousKey();
      const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ anonymousKey }),
      });
      const data = (await res.json().catch(() => null)) as EnrichResponse | null;
      if (!res.ok || !data?.enrichment) {
        trackPlannerEnrichmentFailed({ sessionId });
        return;
      }
      setEnrichment(data.enrichment);
      if (!enrichTracked.current) {
        enrichTracked.current = true;
        const places = data.enrichment.places;
        const routes = data.enrichment.routes ?? [];
        trackPlannerEnrichmentLoaded({
          sessionId,
          resolvedPlaceCount: places.filter((p) => p.place.status === "resolved").length,
          ambiguousPlaceCount: places.filter((p) => p.place.status === "ambiguous").length,
          unresolvedPlaceCount: places.filter((p) => p.place.status === "unresolved").length,
          weatherAvailability: data.enrichment.weather.availability,
        });
        const resolvedRouteCount = routes.filter((r) => r.status === "resolved").length;
        const fallbackRouteCount = routes.filter((r) => r.status !== "resolved").length;
        if (routes.length > 0 && resolvedRouteCount === 0 && fallbackRouteCount > 0) {
          trackPlannerRoutesFailed({ sessionId });
        } else {
          trackPlannerRoutesLoaded({
            sessionId,
            resolvedRouteCount,
            fallbackRouteCount,
          });
        }
      }
    } catch {
      trackPlannerEnrichmentFailed({ sessionId });
    }
  }, [sessionId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const anonymousKey = getOrCreatePlannerAnonymousKey();
      const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ anonymousKey }),
      });
      const data = (await res.json().catch(() => null)) as ReadResponse | null;
      if (!res.ok) {
        setError(data?.message ?? "플랜을 불러오지 못했습니다.");
        setPlan(null);
        return;
      }
      const status = data?.session?.status;
      const hasPlan = Boolean(data?.session?.plan);
      if (!hasPlan || (status !== "generated" && status !== "saved")) {
        setError("아직 생성된 여행 플랜이 없습니다.");
        setPlan(null);
        return;
      }
      setPlan(data!.session!.plan);
      setUpdatedAt(data!.session!.updatedAt ?? new Date().toISOString());
      const rawOrigin = data!.session!.input?.origin?.text?.trim() || "";
      setOriginText(rawOrigin || null);
      const rawPace = data!.session!.input?.pace;
      setPace(
        rawPace && (PLANNER_PACES as readonly string[]).includes(rawPace)
          ? (rawPace as PlannerPace)
          : null,
      );
      setSourceProductId(data!.session!.sourceProductId ?? null);
      setIsSaved(Boolean(data!.session!.isSaved) || status === "saved");
      setIsMemberLinked(Boolean(data!.session!.isOwner));
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPlan(null);
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const applyPlanUpdate = useCallback(
    (nextPlan: PlannerPlan, nextUpdatedAt: string) => {
      setPlan(nextPlan);
      setUpdatedAt(nextUpdatedAt);
      setPlanRevision((revision) => revision + 1);
      setEnrichment(null);
      enrichTracked.current = false;
      void loadEnrichment();
    },
    [loadEnrichment],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Enrich after plan is visible (does not block first paint)
  useEffect(() => {
    if (loading || !plan) return;
    void loadEnrichment();
  }, [loading, plan, loadEnrichment]);

  // Login continuation: ownership attach only (no auto-save / no auto-generate)
  useEffect(() => {
    if (loading || !plan || isSaved || isMemberLinked || autoClaimAttempted.current) return;

    const intent = consumeMatchingPlannerContinuationIntent(sessionId);
    if (!intent) return;

    autoClaimAttempted.current = true;
    let cancelled = false;

    void (async () => {
      const loggedIn = await fetchPlannerMemberAuthenticated();
      if (!loggedIn || cancelled) return;

      const result = await postPlannerSessionClaim(sessionId);
      if (cancelled) return;

      if (result.ok) {
        clearPlannerContinuationIntent();
        trackPlannerGuestPlanClaimed({ sessionId, source: "continuation_intent" });
        setIsMemberLinked(true);
        setUpdatedAt(result.session.updatedAt);
        setIsSaved(result.session.isSaved);
        setClaimError(null);
        return;
      }

      trackPlannerGuestPlanClaimFailed({ sessionId, source: "continuation_intent" });
      if (result.status === 401) {
        setClaimError("로그인이 필요합니다. 다시 로그인해 주세요.");
        return;
      }
      setClaimError(
        "이 플랜을 계정에 연결하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isMemberLinked, isSaved, loading, plan, sessionId]);

  // Explicit save after OAuth (saveIntent) — may attach+save for guest
  useEffect(() => {
    if (loading || !plan || isSaved || autoSaveAttempted.current) return;

    const intent = consumeMatchingPlannerSaveIntent(sessionId);
    if (!intent) return;

    autoSaveAttempted.current = true;
    let cancelled = false;

    void (async () => {
      const loggedIn = await fetchPlannerMemberAuthenticated();
      if (!loggedIn || cancelled) return;

      const result = await postPlannerSessionSave(sessionId);
      if (cancelled) return;

      if (result.ok) {
        clearPlannerSaveIntent();
        trackPlannerSaved({
          sessionId,
          destination: plan.destination.name,
          sourceProductId,
          wasAlreadyLoggedIn: false,
          saveMethod: "kakao",
        });
        setIsSaved(true);
        setIsMemberLinked(true);
        setUpdatedAt(result.session.updatedAt);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSaved, loading, plan, sessionId, sourceProductId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center type-body text-[var(--text-muted)]">
        여행 플랜을 불러오는 중…
      </div>
    );
  }

  if (error || !plan || !updatedAt) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12">
        <AlertCard variant="warning" title="플랜을 열 수 없습니다">
          <p className="type-small text-[var(--text-secondary)]">
            {error ?? "권한이 없거나 플랜이 없습니다."}
          </p>
        </AlertCard>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void load()}>
            다시 시도
          </Button>
          <Link href="/planner">
            <Button type="button" variant="primary">
              새 플랜 시작
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {claimError ? (
        <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-0">
          <AlertCard variant="warning" title="계정 연결">
            <p className="type-small text-[var(--text-secondary)]">{claimError}</p>
          </AlertCard>
        </div>
      ) : null}
      <PlannerResultView
        plan={plan}
        updatedAt={updatedAt}
        sessionId={sessionId}
        sourceProductId={sourceProductId}
        isSaved={isSaved}
        isMemberLinked={isMemberLinked}
        enrichment={enrichment}
        originText={originText}
        pace={pace}
        onSaved={(meta) => {
          setIsSaved(true);
          setIsMemberLinked(true);
          if (meta?.updatedAt) setUpdatedAt(meta.updatedAt);
        }}
        onMemberLinked={(meta) => {
          setIsMemberLinked(true);
          setUpdatedAt(meta.updatedAt);
          setClaimError(null);
          clearPlannerContinuationIntent();
        }}
        planRevision={planRevision}
        onReloadLatest={() => void load()}
        onPlanUpdated={(payload) => {
          applyPlanUpdate(payload.plan, payload.updatedAt);
        }}
      />
    </>
  );
}
