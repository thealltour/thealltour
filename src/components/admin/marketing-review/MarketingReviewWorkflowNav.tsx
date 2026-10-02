"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const REVIEW_WORKFLOW_STEPS = [
  { id: 1, label: "공통 원문", description: "ChatGPT용 원문 복사 → 수정본 가져오기 → Human 수정·저장·승인" },
  { id: 2, label: "Research 검증", description: "검증용 JSON 복사 → 결과 가져오기 → 충돌 확인·반영" },
  { id: 3, label: "카드 문구", description: "Instagram 카드뉴스 JSON 복사 → 결과 가져오기 → Human 문구 수정·저장·승인" },
  { id: 4, label: "공유 비주얼", description: "Shared Visual Plan 작성 → Astra handoff 생성 → 공유 비주얼 슬롯 채우기" },
  { id: 5, label: "카드뉴스 완성", description: "렌더링 시작 → 생성된 카드뉴스 확인·다운로드" },
  { id: 6, label: "기타 채널", description: "완성된 카드뉴스를 바탕으로 Threads·Instagram 캡션·네이버 블로그 등 생성·검토" },
] as const;
export type ReviewWorkflowStepId = (typeof REVIEW_WORKFLOW_STEPS)[number]["id"];

type WorkflowSnapshot = {
  cardCopy: { applicable: boolean; gateState: string } | null;
  astra: {
    plan: { status: string };
    planStaleFromCardCopyOnly: boolean;
    handoff: { status: string; handoffSourceStale?: boolean; assetsStale?: boolean; uploadStatus: { complete: boolean } | null };
  } | null;
  sources: { candidates: Array<{ stale?: boolean; research?: { status?: string | null; conflicts: unknown[] } | null }> } | null;
  assets: { artifacts: Array<{ relativePath: string }> } | null;
};

export function deriveReviewWorkflowStatuses(approved: boolean, snapshot: WorkflowSnapshot): string[] {
  const { cardCopy, astra, sources, assets } = snapshot;
  const research = sources?.candidates.find((candidate) => candidate.research);
  const cardApproved = cardCopy?.gateState === "approved";
  const planUsable = astra?.plan.status === "fresh" || (astra?.plan.status === "stale" && astra.planStaleFromCardCopyOnly);
  const visualStale = astra && ((astra.plan.status === "stale" && !astra.planStaleFromCardCopyOnly) || astra.handoff.handoffSourceStale || astra.handoff.assetsStale);
  return [
    approved ? "승인됨" : "작업 필요",
    !sources ? "확인 불가" : !research ? "결과 없음" : research.stale ? "재검토 필요" : research.research?.status === "blocked" ? "검증 보류" : research.research?.conflicts.length ? "충돌 검토 필요" : "결과 있음",
    !cardCopy ? "확인 불가" : !approved || ["base_changed", "approved_stale"].includes(cardCopy.gateState) ? "재검토 필요" : cardApproved ? "승인됨" : "작업 필요",
    !astra ? "확인 불가" : !approved || !cardApproved || visualStale ? "재검토 필요" : planUsable && astra.handoff.status === "ready" && astra.handoff.uploadStatus?.complete ? "준비 완료" : "작업 필요",
    !assets ? "확인 불가" : assets.artifacts.some((asset) => /^cardnews\/.*\.png$/u.test(asset.relativePath)) ? (!approved || !cardApproved || visualStale ? "재검토 필요" : "결과 있음") : "렌더 전",
  ];
}

export function MarketingReviewWorkflowNav(props: {
  candidateId: string;
  canonicalApproved: boolean;
  refreshKey: number;
  activeStep: ReviewWorkflowStepId;
  onSelect: (step: ReviewWorkflowStepId) => void;
  channelStatus: string;
  cardCopyDirty?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>({ cardCopy: null, astra: null, sources: null, assets: null });
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const queryKey = `${props.candidateId}:${props.refreshKey}`;
  const loading = loadedKey !== queryKey;
  useEffect(() => {
    let cancelled = false;
    const base = `/api/admin/marketing-review/${encodeURIComponent(props.candidateId)}`;
    async function get<T>(path: string): Promise<T | null> {
      try {
        const response = await fetch(`${base}/${path}`, { cache: "no-store" });
        return response.ok ? await response.json() as T : null;
      } catch { return null; }
    }
    void Promise.all([
      get<WorkflowSnapshot["cardCopy"]>("instagram-card-copy-review"),
      get<WorkflowSnapshot["astra"]>("astra-handoff"),
      get<WorkflowSnapshot["sources"]>("channel-source-selection"),
      get<WorkflowSnapshot["assets"]>("assets"),
    ]).then(([cardCopy, astra, sources, assets]) => {
      if (!cancelled) { setSnapshot({ cardCopy, astra, sources, assets }); setLoadedKey(`${props.candidateId}:${props.refreshKey}`); }
    });
    return () => { cancelled = true; };
  }, [props.candidateId, props.refreshKey]);
  const statuses = [...deriveReviewWorkflowStatuses(props.canonicalApproved, snapshot), props.channelStatus];
  if (props.cardCopyDirty) statuses[2] = "저장 필요";
  return (
    <div className="sticky top-0 z-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 shadow-sm">
      <div role="tablist" aria-label="마케팅 제작 단계" className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {REVIEW_WORKFLOW_STEPS.map((step, index) => (
          <button key={step.id} type="button" role="tab" id={`workflow-tab-${step.id}`}
            aria-selected={props.activeStep === step.id} aria-controls={`workflow-stage-${step.id}`}
            tabIndex={props.activeStep === step.id ? 0 : -1}
            onClick={() => props.onSelect(step.id)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % 6 : event.key === "ArrowLeft" ? (index + 5) % 6 : event.key === "Home" ? 0 : event.key === "End" ? 5 : null;
              if (next !== null) { event.preventDefault(); props.onSelect(REVIEW_WORKFLOW_STEPS[next]!.id); document.getElementById(`workflow-tab-${next + 1}`)?.focus(); }
            }}
            className={cn("rounded-md px-2 py-2 text-left text-xs", props.activeStep === step.id ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--surface-muted)]")}
          >
            <span className="block font-semibold">{step.id}. {step.label}</span>
            <span className="mt-1 block opacity-80">{loading && step.id > 1 && step.id < 6 ? "확인 중…" : statuses[index]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Keep editors mounted so switching steps never discards an unsaved draft. */
export function MarketingReviewWorkflowStage({ step, activeStep, children }: { step: ReviewWorkflowStepId; activeStep: ReviewWorkflowStepId; children: ReactNode }) {
  const definition = REVIEW_WORKFLOW_STEPS[step - 1]!;
  return (
    <section role="tabpanel" id={`workflow-stage-${step}`} aria-labelledby={`workflow-tab-${step}`} hidden={step !== activeStep}
      className={step === activeStep ? "space-y-4" : "hidden"}>
      <p className="text-sm text-[var(--text-secondary)]">{definition.description}</p>
      {children}
    </section>
  );
}
