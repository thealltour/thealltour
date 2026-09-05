"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import AlertCard from "@/components/ui/AlertCard";
import { PlannerSavedPlanCard } from "@/components/planner/PlannerSavedPlanCard";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import { trackPlannerSavedListViewed } from "@/lib/analytics/trackPlannerEvents";
import { PLANNER_SAVED_LIST_PATH } from "@/lib/planner/memberAccountNav";
import type { SavedPlannerListItem } from "@/lib/planner/savedPlanDto";

type ListPhase =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string }
  | { kind: "empty" }
  | { kind: "results"; plans: SavedPlannerListItem[] };

type ListResponse = {
  message?: string;
  code?: string;
  plans?: SavedPlannerListItem[];
  count?: number;
};

async function fetchSavedPlans(): Promise<ListPhase> {
  try {
    const res = await fetch("/api/planner/saved", {
      method: "GET",
      credentials: "include",
    });
    const data = (await res.json().catch(() => null)) as ListResponse | null;

    if (res.status === 401) {
      return { kind: "unauthenticated" };
    }
    if (!res.ok) {
      return {
        kind: "error",
        message: data?.message ?? "저장한 플랜을 불러오지 못했습니다.",
      };
    }

    const plans = Array.isArray(data?.plans) ? data!.plans! : [];
    if (plans.length === 0) return { kind: "empty" };
    return { kind: "results", plans };
  } catch {
    return { kind: "error", message: "네트워크 오류가 발생했습니다." };
  }
}

export function PlannerSavedListView() {
  const [phase, setPhase] = useState<ListPhase>({ kind: "loading" });
  const trackedView = useRef(false);

  const applyPhase = useCallback((next: ListPhase) => {
    setPhase(next);
    if (next.kind === "empty" || next.kind === "results") {
      if (!trackedView.current) {
        trackedView.current = true;
        trackPlannerSavedListViewed({
          savedPlanCount: next.kind === "results" ? next.plans.length : 0,
        });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSavedPlans().then((next) => {
      if (!cancelled) applyPhase(next);
    });
    return () => {
      cancelled = true;
    };
  }, [applyPhase]);

  const retry = useCallback(() => {
    setPhase({ kind: "loading" });
    void fetchSavedPlans().then(applyPhase);
  }, [applyPhase]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-0 sm:py-12">
      <header className="space-y-2">
        <h1 className="type-h2 text-[var(--foreground)]">내 여행 플랜</h1>
        <p className="type-small text-[var(--text-secondary)]">
          저장한 여행 계획을 언제든 다시 확인해보세요.
        </p>
      </header>

      {phase.kind === "loading" ? (
        <p className="py-10 text-center type-body text-[var(--text-muted)]">불러오는 중…</p>
      ) : null}

      {phase.kind === "unauthenticated" ? (
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="type-body text-[var(--foreground)]">
            저장한 여행 플랜을 확인하려면 로그인해 주세요.
          </p>
          <p className="type-small text-[var(--text-secondary)]">
            카카오로 로그인하면 다른 기기에 저장해 둔 플랜도 이어서 볼 수 있어요.
          </p>
          <Button
            type="button"
            variant="kakao"
            className="w-full sm:w-auto"
            onClick={() => startOAuthLogin("kakao", { nextPath: PLANNER_SAVED_LIST_PATH })}
          >
            카카오로 로그인
          </Button>
        </div>
      ) : null}

      {phase.kind === "error" ? (
        <div className="space-y-4">
          <AlertCard variant="warning" title="불러오기 실패">
            <p className="type-small text-[var(--text-secondary)]">{phase.message}</p>
          </AlertCard>
          <Button type="button" variant="outline" onClick={retry}>
            다시 시도
          </Button>
        </div>
      ) : null}

      {phase.kind === "empty" ? (
        <div className="space-y-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/40 p-6 text-center">
          <p className="type-body font-medium text-[var(--foreground)]">
            아직 저장한 여행 플랜이 없어요.
          </p>
          <p className="type-small text-[var(--text-secondary)]">
            가고 싶은 곳을 알려주시면 AI가 여행 계획을 만들어드려요.
          </p>
          <Link href="/planner">
            <Button type="button" variant="primary">
              새 여행 플랜 만들기
            </Button>
          </Link>
        </div>
      ) : null}

      {phase.kind === "results" ? (
        <div className="space-y-3">
          {phase.plans.map((plan) => (
            <PlannerSavedPlanCard key={plan.id} plan={plan} />
          ))}
          <div className="pt-2">
            <Link href="/planner">
              <Button type="button" variant="outline" size="sm">
                새 여행 플랜 만들기
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
