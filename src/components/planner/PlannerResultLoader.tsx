"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import AlertCard from "@/components/ui/AlertCard";
import { PlannerResultView } from "@/components/planner/PlannerResultView";
import {
  fetchPlannerMemberAuthenticated,
  postPlannerSessionSave,
} from "@/lib/planner/saveClient";
import { trackPlannerSaved } from "@/lib/analytics/trackPlannerEvents";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
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
  };
};

type PlannerResultLoaderProps = {
  sessionId: string;
};

export function PlannerResultLoader({ sessionId }: PlannerResultLoaderProps) {
  const [plan, setPlan] = useState<PlannerPlan | null>(null);
  const [sourceProductId, setSourceProductId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const autoSaveAttempted = useRef(false);

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
      setSourceProductId(data!.session!.sourceProductId ?? null);
      setIsSaved(Boolean(data!.session!.isSaved) || status === "saved");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // After Kakao OAuth return: auto-claim only when explicit save intent matches.
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
        return;
      }
      // Keep intent for retry; surface soft error via reload path if needed
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

  if (error || !plan) {
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
    <PlannerResultView
      plan={plan}
      sessionId={sessionId}
      sourceProductId={sourceProductId}
      isSaved={isSaved}
      onSaved={() => setIsSaved(true)}
    />
  );
}
