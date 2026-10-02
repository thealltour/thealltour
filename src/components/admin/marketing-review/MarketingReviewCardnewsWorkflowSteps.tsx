"use client";

import { useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import { adminToneText } from "@/components/admin/ui/adminStatusTone";
import { cn } from "@/lib/cn";
import type { InstagramCardCopyReviewGateState } from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";

type CardCopyDto = { applicable: boolean; gateState: InstagramCardCopyReviewGateState };

type AstraDto = {
  plan: { status: "not_generated" | "fresh" | "stale" };
  planStaleFromCardCopyOnly: boolean;
  cardCopyBlockReason?: string | null;
  handoff: {
    status: "missing_package" | "missing_handoff" | "ready";
    handoffStale: boolean;
    uploadStatus: { complete: boolean } | null;
  };
};

type StepState = "done" | "current" | "todo" | "optional";

export type CardnewsWorkflowStep = { label: string; state: StepState };

/** Pure step derivation so the guide can be unit-tested without fetching. */
export function deriveCardnewsWorkflowSteps(input: {
  canonicalApproved: boolean;
  cardCopy: CardCopyDto | null;
  astra: AstraDto | null;
}): CardnewsWorkflowStep[] {
  const { canonicalApproved, cardCopy, astra } = input;
  const planUsable =
    astra?.plan.status === "fresh" || (astra?.plan.status === "stale" && astra.planStaleFromCardCopyOnly);
  const done: Array<boolean | null> = [
    canonicalApproved,
    null,
    Boolean(cardCopy?.applicable),
    cardCopy?.gateState === "approved",
    Boolean(planUsable),
    astra?.handoff.status === "ready" && !astra.handoff.handoffStale,
    Boolean(astra?.handoff.uploadStatus?.complete),
    null,
  ];
  const labels = [
    "공통 원문 확정·승인",
    "Research 검증 (선택) — 충돌 반영 후 새 버전 승인",
    "Instagram 카드뉴스 JSON 복사 → ChatGPT 결과 가져오기",
    "카드 문구 검토·저장·승인",
    "Shared Visual Plan 생성 (Instagram 기준)",
    "Astra 요청문 생성",
    "사진 업로드",
    "카드뉴스 렌더",
  ];
  let currentAssigned = false;
  return labels.map((label, index) => {
    const value = done[index];
    if (value === null && index === 1) return { label, state: "optional" };
    if (value === true) return { label, state: "done" };
    if (!currentAssigned) {
      currentAssigned = true;
      return { label, state: "current" };
    }
    return { label, state: "todo" };
  });
}

const STATE_MARK: Record<StepState, string> = {
  done: "✓",
  current: "→",
  todo: "·",
  optional: "○",
};

export function MarketingReviewCardnewsWorkflowSteps(props: {
  candidateId: string;
  canonicalApproved: boolean;
  refreshKey?: number;
}) {
  const { candidateId, canonicalApproved, refreshKey = 0 } = props;
  const [cardCopy, setCardCopy] = useState<CardCopyDto | null>(null);
  const [astra, setAstra] = useState<AstraDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    const base = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}`;
    async function fetchJson<T>(path: string): Promise<T | null> {
      try {
        const res = await fetch(`${base}/${path}`, { cache: "no-store" });
        return res.ok ? ((await res.json()) as T) : null;
      } catch {
        return null;
      }
    }
    void Promise.all([
      fetchJson<CardCopyDto>("instagram-card-copy-review"),
      fetchJson<AstraDto>("astra-handoff"),
    ]).then(([nextCardCopy, nextAstra]) => {
      if (cancelled) return;
      setCardCopy(nextCardCopy);
      setAstra(nextAstra);
    });
    return () => {
      cancelled = true;
    };
  }, [candidateId, refreshKey]);

  const steps = deriveCardnewsWorkflowSteps({ canonicalApproved, cardCopy, astra });
  const blockReason = astra?.cardCopyBlockReason ?? null;

  return (
    <AdminCard className="space-y-2 p-4">
      <h2 className="text-base font-semibold">Instagram 카드뉴스 진행 순서</h2>
      <ol className="space-y-1 text-sm">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              step.state === "done" && adminToneText.success,
              step.state === "current" && "font-medium text-[var(--text-primary)]",
              (step.state === "todo" || step.state === "optional") && "text-[var(--text-secondary)]",
            )}
          >
            {STATE_MARK[step.state]} {index + 1}. {step.label}
          </li>
        ))}
      </ol>
      {blockReason ? <p className={cn("text-xs", adminToneText.warning)}>{blockReason}</p> : null}
      <p className="text-xs text-[var(--text-secondary)]">
        다른 채널의 생성 여부와 관계없이 Instagram 카드 문구를 기준으로 비주얼과 렌더가 진행됩니다.
      </p>
    </AdminCard>
  );
}
