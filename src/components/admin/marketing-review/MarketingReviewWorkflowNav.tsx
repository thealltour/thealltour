"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const REVIEW_WORKFLOW_STEPS = [
  { id: 1, label: "공통 원문", description: "ChatGPT용 원문 복사 → 수정본 가져오기 → Human 수정·저장·승인" },
  { id: 2, label: "Research 검증", description: "검증용 JSON 복사 → 결과 가져오기 → 충돌 확인·반영" },
  { id: 7, label: "Narration", description: "문장별 이야기 작성 → 순서 검토 → 저장·revision 승인" },
  { id: 8, label: "문장 비주얼", description: "완료된 음성 불러오기 → 문장별 계획·승인 → Astra 요청문·이미지 업로드" },
  { id: 10, label: "Shortform", description: "최신 문장·음성·이미지로 영상 작업 요청 → 완료 결과 확인·다운로드" },
  { id: 9, label: "Instagram 파생", description: "문장별 장면에서 4~10장 선택 → 카드 문구 검토·승인 → 카드뉴스 렌더" },
  { id: 3, label: "카드 문구", description: "Instagram 카드뉴스 JSON 복사 → 결과 가져오기 → Human 문구 수정·저장·승인" },
  { id: 4, label: "공유 비주얼", description: "Shared Visual Plan 작성 → Astra handoff 생성 → 공유 비주얼 슬롯 채우기" },
  { id: 5, label: "카드뉴스 완성", description: "렌더링 시작 → 생성된 카드뉴스 확인·다운로드" },
  { id: 6, label: "기타 채널", description: "완성된 카드뉴스를 바탕으로 Threads·Instagram 캡션·네이버 블로그 등 생성·검토" },
] as const;
export type ReviewWorkflowStepId = (typeof REVIEW_WORKFLOW_STEPS)[number]["id"];

type WorkflowSnapshot = {
  narration?: { gateState: string } | null;
  narrationScenes?: { gateState: string; uploads: { complete: boolean } | null } | null;
  narrationInstagram?: { gateState: string; rendered: unknown | null } | null;
  narrationShortform?: { ready: boolean } | null;
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
    !snapshot.narration ? "확인 불가" : snapshot.narration.gateState === "approved" ? "승인됨" : snapshot.narration.gateState === "stale" ? "재검토 필요" : "작업 필요",
    !snapshot.narrationScenes ? "확인 불가" : snapshot.narrationScenes.gateState === "stale" ? "재검토 필요" : snapshot.narrationScenes.uploads?.complete ? "준비 완료" : snapshot.narrationScenes.gateState === "approved" ? "이미지 필요" : "작업 필요",
    !snapshot.narrationShortform ? "확인 불가" : snapshot.narrationShortform.ready ? "렌더 준비됨" : "입력 준비 필요",
    !snapshot.narrationInstagram ? "확인 불가" : snapshot.narrationInstagram.gateState === "stale" ? "재검토 필요" : snapshot.narrationInstagram.rendered ? "결과 있음" : snapshot.narrationInstagram.gateState === "approved" ? "렌더 전" : "작업 필요",
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
      get<WorkflowSnapshot["narration"]>("narration"),
      get<WorkflowSnapshot["narrationScenes"]>("narration-scenes"),
      get<WorkflowSnapshot["narrationInstagram"]>("narration-instagram"),
      get<WorkflowSnapshot["narrationShortform"]>("narration-shortform"),
    ]).then(([cardCopy, astra, sources, assets, narration, narrationScenes, narrationInstagram, narrationShortform]) => {
      if (!cancelled) { setSnapshot({ cardCopy, astra, sources, assets, narration, narrationScenes, narrationInstagram, narrationShortform }); setLoadedKey(`${props.candidateId}:${props.refreshKey}`); }
    });
    return () => { cancelled = true; };
  }, [props.candidateId, props.refreshKey]);
  const statuses = [...deriveReviewWorkflowStatuses(props.canonicalApproved, snapshot), props.channelStatus];
  if (props.cardCopyDirty) statuses[6] = "저장 필요";
  return (
    <div className="sticky top-0 z-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 shadow-sm">
      <div role="tablist" aria-label="마케팅 제작 단계" className="grid grid-cols-3 gap-1 md:grid-cols-5">
        {REVIEW_WORKFLOW_STEPS.map((step, index) => (
          <button key={step.id} type="button" role="tab" id={`workflow-tab-${step.id}`}
            aria-selected={props.activeStep === step.id} aria-controls={`workflow-stage-${step.id}`}
            tabIndex={props.activeStep === step.id ? 0 : -1}
            onClick={() => props.onSelect(step.id)}
            onKeyDown={(event) => {
              const count = REVIEW_WORKFLOW_STEPS.length;
              const next = event.key === "ArrowRight" ? (index + 1) % count : event.key === "ArrowLeft" ? (index + count - 1) % count : event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
              if (next !== null) { event.preventDefault(); const id = REVIEW_WORKFLOW_STEPS[next]!.id; props.onSelect(id); document.getElementById(`workflow-tab-${id}`)?.focus(); }
            }}
            className={cn("rounded-md px-2 py-2 text-left text-xs", props.activeStep === step.id ? "bg-[var(--primary)] text-white" : "hover:bg-[var(--surface-muted)]")}
          >
            <span className="block font-semibold">{index + 1}. {step.label}</span>
            <span className="mt-1 block opacity-80">{loading && step.id !== 1 && step.id !== 6 ? "확인 중…" : statuses[index]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Keep editors mounted so switching steps never discards an unsaved draft. */
export function MarketingReviewWorkflowStage({ step, activeStep, children }: { step: ReviewWorkflowStepId; activeStep: ReviewWorkflowStepId; children: ReactNode }) {
  const definition = REVIEW_WORKFLOW_STEPS.find(definition => definition.id === step)!;
  return (
    <section role="tabpanel" id={`workflow-stage-${step}`} aria-labelledby={`workflow-tab-${step}`} hidden={step !== activeStep}
      className={step === activeStep ? "space-y-4" : "hidden"}>
      <p className="text-sm text-[var(--text-secondary)]">{definition.description}</p>
      {children}
    </section>
  );
}
