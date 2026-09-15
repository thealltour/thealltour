"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import type {
  AgendaSlateAction,
  AgendaSlateCandidate,
  AgendaSlateDaySummary,
  DailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import { cn } from "@/lib/cn";

type SlateApiResponse = {
  slate: DailyAgendaSlate | null;
  productionRequests?: MarketingProductionRequest[];
  selectedTodayCount: number;
  maxSelectedToday: number;
  todayBusinessDateKst?: string;
  recentDays?: AgendaSlateDaySummary[];
  message?: string;
  code?: string;
};

type SlateActionResponse = {
  slate: DailyAgendaSlate;
  selectedTodayCount: number;
  message?: string;
};

function stateLabel(state: AgendaSlateCandidate["state"]): string {
  switch (state) {
    case "SELECTED_TODAY":
      return "오늘 제작";
    case "DEFERRED":
      return "내일";
    case "REJECTED":
      return "제외";
    default:
      return "대기";
  }
}

function productionStatusLabel(
  status: MarketingProductionRequest["status"],
  outcome?: string | null,
): string {
  if (status === "COMPLETED" && outcome === "awaiting_story_selection") {
    return "Story 선택 대기";
  }
  if (status === "COMPLETED" && outcome === "awaiting_asset_approval") {
    return "공통 원문 승인 대기";
  }
  if (status === "COMPLETED" && outcome === "story_point_skip") {
    return "Story Miner skip (완료)";
  }
  if (status === "COMPLETED" && outcome === "story_research_skip") {
    return "Story 연구 skip (완료)";
  }
  switch (status) {
    case "QUEUED":
      return "대기열 — Pi 워커가 곧 수락";
    case "RUNNING":
      return "제작 진행 중";
    case "COMPLETED":
      return "제작 완료";
    case "FAILED":
      return "제작 실패";
    default:
      return status;
  }
}

type PassStoryCandidateView = {
  pointId: string;
  storyQuestion: string | null;
  storyClaim: string | null;
  whyInteresting: string | null;
  audienceTension: string | null;
  curiosityGap: string | null;
  readerPayoff: string | null;
  mechanisms: string[];
  researchQuestions: string[];
  genericRisk: string | null;
  channelPotential: Record<string, unknown> | null;
  gateScore: number | null;
  gateRanking: number | null;
  researchRejected: boolean;
  sourceLabel: string;
};

function extractPassStoryCandidates(
  request: MarketingProductionRequest | null | undefined,
): PassStoryCandidateView[] {
  if (!request?.metadata) return [];
  const raw =
    request.metadata.storyPointCandidateSet ??
    (request.metadata.storyPointCandidateSetFull as unknown);
  if (!raw || typeof raw !== "object") return [];
  const set = raw as {
    outcome?: string;
    candidates?: Array<Record<string, unknown>>;
    gateResults?: Array<Record<string, unknown>>;
    selectedPointIds?: string[];
  };
  if (set.outcome !== "pass" || !Array.isArray(set.candidates)) return [];
  const human = request.metadata.humanStorySelection as
    | { researchRejectedStoryPointIds?: string[] }
    | undefined;
  const rejected = new Set(human?.researchRejectedStoryPointIds ?? []);
  const provenance = (request.metadata.externalStoryProvenance ?? {}) as Record<
    string,
    { source?: string; provider?: string; storyTitleKo?: string | null }
  >;
  const gateById = new Map(
    (set.gateResults ?? [])
      .filter((g) => typeof g.pointId === "string")
      .map((g) => [String(g.pointId), g]),
  );
  const passIds = new Set(
    (set.gateResults ?? [])
      .filter((g) => g.verdict === "pass")
      .map((g) => String(g.pointId)),
  );
  const ordered =
    Array.isArray(set.selectedPointIds) && set.selectedPointIds.length > 0
      ? set.selectedPointIds.filter((id) => passIds.has(id))
      : [...passIds];
  const out: PassStoryCandidateView[] = [];
  for (const id of ordered) {
    const point = set.candidates.find((c) => c.pointId === id);
    if (!point) continue;
    const gate = gateById.get(id);
    const prov = provenance[id];
    const isExternal = prov?.source === "external_editorial_director" || String(id).startsWith("sp_ext_");
    out.push({
      pointId: id,
      storyQuestion: typeof point.storyQuestion === "string" ? point.storyQuestion : null,
      storyClaim: typeof point.storyClaim === "string" ? point.storyClaim : null,
      whyInteresting: typeof point.whyInteresting === "string" ? point.whyInteresting : null,
      audienceTension: typeof point.audienceTension === "string" ? point.audienceTension : null,
      curiosityGap: typeof point.curiosityGap === "string" ? point.curiosityGap : null,
      readerPayoff: typeof point.readerPayoff === "string" ? point.readerPayoff : null,
      mechanisms: Array.isArray(point.mechanisms)
        ? point.mechanisms.filter((m): m is string => typeof m === "string")
        : [],
      researchQuestions: Array.isArray(point.researchQuestions)
        ? point.researchQuestions.filter((m): m is string => typeof m === "string")
        : [],
      genericRisk: typeof point.genericRisk === "string" ? point.genericRisk : null,
      channelPotential:
        point.channelPotential && typeof point.channelPotential === "object"
          ? (point.channelPotential as Record<string, unknown>)
          : null,
      gateScore: typeof gate?.scores === "object" && gate.scores && typeof (gate.scores as { composite?: unknown }).composite === "number"
        ? (gate.scores as { composite: number }).composite
        : typeof gate?.score === "number"
          ? gate.score
          : null,
      gateRanking: typeof gate?.rank === "number" ? gate.rank : null,
      researchRejected: rejected.has(id),
      sourceLabel: isExternal
        ? "ChatGPT 수동 Editorial Director"
        : "내부 Story Miner",
    });
  }
  return out;
}

function formatTs(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function sourceLabel(item: AgendaSlateCandidate): string {
  const first = item.evidenceSummary[0];
  if (first?.sourceName) return first.sourceName;
  if (first?.url) return first.url;
  return item.researchBriefId ?? item.agendaCandidateId ?? "—";
}

function countByStatus(requests: MarketingProductionRequest[]) {
  return {
    queued: requests.filter((r) => r.status === "QUEUED").length,
    running: requests.filter((r) => r.status === "RUNNING").length,
    completed: requests.filter((r) => r.status === "COMPLETED").length,
    failed: requests.filter((r) => r.status === "FAILED").length,
  };
}

function slateStatusLabel(status: DailyAgendaSlate["status"] | undefined): string {
  switch (status) {
    case "ready_for_human_selection":
      return "선택 대기";
    case "empty_deferred":
      return "후보 없음";
    case "superseded":
      return "대체됨";
    default:
      return status ?? "";
  }
}

function ProductionPipelineBanner(props: {
  requests: MarketingProductionRequest[];
  polling: boolean;
}) {
  const { requests, polling } = props;
  if (requests.length === 0) {
    return (
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-xs text-[var(--text-secondary)]">
        제작 요청 없음. 「오늘 제작」선택 후 「제작 요청」을 누르면 Pi 워커 대기열에 들어갑니다.
        브라우저에서 AI 파이프라인을 직접 실행하지 않습니다.
      </div>
    );
  }

  const counts = countByStatus(requests);
  const latest = [...requests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const outcomeOf = (pr: MarketingProductionRequest) =>
    typeof pr.metadata?.productionOutcome === "string" ? pr.metadata.productionOutcome : null;
  const completedWithReview = requests.filter(
    (pr) => pr.status === "COMPLETED" && Boolean(pr.completedCandidateId),
  );
  const tone =
    counts.failed > 0
      ? "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]"
      : counts.running > 0
        ? "border-[var(--primary)]/40 bg-[var(--primary-soft)] text-[var(--primary)]"
        : counts.queued > 0
          ? "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]"
          : "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]";

  return (
    <div className={cn("space-y-1 border-b px-4 py-3 text-xs", tone)}>
      <div className="font-semibold">
        제작 파이프라인: QUEUED {counts.queued} · RUNNING {counts.running} · COMPLETED{" "}
        {counts.completed} · FAILED {counts.failed}
        {polling ? " · 자동 갱신 중" : ""}
      </div>
      {latest ? (
        <div className="opacity-90">
          최근 요청: {productionStatusLabel(latest.status, outcomeOf(latest))}
          {latest.selection?.title ? ` — ${latest.selection.title}` : ""}
          {latest.status === "FAILED" && latest.lastError
            ? ` · 오류 ${latest.lastError}`
            : null}
          {latest.workerId ? ` · worker ${latest.workerId}` : null}
          {" · "}
          갱신 {formatTs(latest.updatedAt)}
        </div>
      ) : null}
      {completedWithReview.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
          <span className="font-medium">수정·승인:</span>
          {completedWithReview.map((pr) => (
            <Link
              key={pr.requestId}
              href={`/theall_manager_only/marketing-review/${encodeURIComponent(pr.completedCandidateId!)}`}
              className="font-medium underline underline-offset-2"
            >
              {pr.selection?.title?.trim() || pr.completedCandidateId}
              {outcomeOf(pr) === "awaiting_asset_approval" ? " (원문 승인)" : ""}
              {" →"}
            </Link>
          ))}
        </div>
      ) : counts.completed > 0 ? (
        <div className="opacity-80">
          COMPLETED {counts.completed}건 — 아래 후보 카드에서 완성 후보 링크를 확인하세요.
        </div>
      ) : null}
      <div className="opacity-80">
        버튼은 대기열 등록만 합니다. hermes-pi 워커(약 1분 주기)가 수락하면 RUNNING → COMPLETED/FAILED로
        바뀝니다.
        {counts.running > 0 || counts.failed > 0 ? (
          <>
            {" "}
            <Link
              href="/theall_manager_only/marketing-observability"
              className="font-medium underline-offset-2 hover:underline"
            >
              조직 관제에서 실행 보기 →
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CandidateCard(props: {
  item: AgendaSlateCandidate;
  productionRequest?: MarketingProductionRequest | null;
  busy: boolean;
  onAction: (action: AgendaSlateAction) => void;
  onRetryProduction?: () => void;
  onSelectStory?: (storyPointId: string) => void;
  onImportExternalStory?: () => void;
}) {
  const { item, productionRequest, busy, onAction, onRetryProduction, onSelectStory, onImportExternalStory } =
    props;
  const ed = item.editorial;
  const pr = productionRequest;
  const outcome =
    typeof pr?.metadata?.productionOutcome === "string" ? pr.metadata.productionOutcome : null;
  const awaitingStory = outcome === "awaiting_story_selection";
  const storyCandidates = awaitingStory ? extractPassStoryCandidates(pr) : [];
  const rejectReason =
    typeof pr?.metadata?.lastStoryResearchRejectReason === "string"
      ? pr.metadata.lastStoryResearchRejectReason
      : typeof (pr?.metadata?.humanStorySelection as { lastResearchRejectReason?: string } | undefined)
            ?.lastResearchRejectReason === "string"
        ? (pr?.metadata?.humanStorySelection as { lastResearchRejectReason: string })
            .lastResearchRejectReason
        : null;

  return (
    <div
      className={cn(
        "space-y-3 border-t border-[var(--border)] px-4 py-4 first:border-t-0",
        item.state === "SELECTED_TODAY" && "bg-[var(--success-bg)]",
        item.state === "DEFERRED" && "bg-[var(--warning-bg)]",
        item.state === "REJECTED" && "bg-[var(--surface-muted)] opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
            {item.origin === "deferred_carryover" ? (
              <span className="rounded border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-1.5 py-0.5 text-[11px] text-[var(--warning)]">
                어제 미룸
              </span>
            ) : null}
            <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
              {stateLabel(item.state)}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.summary}</p>
        </div>
        <div className="text-right text-xs text-[var(--text-secondary)]">
          <div>연구 점수 {item.score != null ? item.score.toFixed(2) : "—"}</div>
          <div className="mt-0.5">출처 {sourceLabel(item)}</div>
        </div>
      </div>

      {pr ? (
        <div
          className={cn(
            "rounded border px-3 py-2 text-xs",
            pr.status === "FAILED" && "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]",
            pr.status === "RUNNING" && "border-[var(--primary)]/40 bg-[var(--primary-soft)] text-[var(--primary)]",
            pr.status === "QUEUED" && "border-[var(--warning)]/40 bg-[var(--warning-bg)] text-[var(--warning)]",
            pr.status === "COMPLETED" &&
              awaitingStory &&
              "border-violet-500/40 bg-violet-500/10 text-violet-950",
            pr.status === "COMPLETED" &&
              !awaitingStory &&
              "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]",
          )}
        >
          <div className="font-semibold">{productionStatusLabel(pr.status, outcome)}</div>
          <dl className="mt-1 grid gap-0.5 sm:grid-cols-2">
            <div>
              <dt className="inline text-[var(--text-secondary)]">요청 </dt>
              <dd className="inline font-mono text-[11px]">{pr.requestId}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--text-secondary)]">워커 </dt>
              <dd className="inline">{pr.workerId ?? "아직 미할당"}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--text-secondary)]">생성 </dt>
              <dd className="inline">{formatTs(pr.createdAt)}</dd>
            </div>
            <div>
              <dt className="inline text-[var(--text-secondary)]">수락 </dt>
              <dd className="inline">{formatTs(pr.claimedAt ?? pr.startedAt)}</dd>
            </div>
            {pr.status === "COMPLETED" ? (
              <div>
                <dt className="inline text-[var(--text-secondary)]">완료 </dt>
                <dd className="inline">{formatTs(pr.completedAt)}</dd>
              </div>
            ) : null}
            {pr.status === "FAILED" ? (
              <div>
                <dt className="inline text-[var(--text-secondary)]">실패 </dt>
                <dd className="inline">{formatTs(pr.failedAt)}</dd>
              </div>
            ) : null}
          </dl>
          {pr.status === "COMPLETED" && pr.completedCandidateId ? (
            <p className="mt-2">
              <Link
                href={`/theall_manager_only/marketing-review/${encodeURIComponent(pr.completedCandidateId)}`}
                className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]"
              >
                {outcome === "awaiting_asset_approval"
                  ? "공통 원문 수정·승인 열기 →"
                  : "후보 수정·승인 열기 →"}
              </Link>
            </p>
          ) : null}
          {awaitingStory ? (
            <div className="mt-3 space-y-3 border-t border-[var(--success)]/30 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--success)]">
                  Story 후보 — 연구/콘텐츠 전에 하나를 선택하세요.
                </p>
                {onImportExternalStory ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onImportExternalStory()}
                    className="min-h-11 rounded-lg border border-violet-700/40 bg-violet-700/10 px-3 py-2 text-sm font-medium text-violet-950 disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
                  >
                    외부 Story 가져오기
                  </button>
                ) : null}
              </div>
              {rejectReason ? (
                <p className="rounded border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-1.5 text-[var(--warning)]">
                  이전 선택 Story 연구 거부: {rejectReason}. 다른 PASS 후보를 고르세요.
                </p>
              ) : null}
              {storyCandidates.length === 0 ? (
                <p className="text-[var(--text-secondary)]">
                  PASS 후보 메타데이터가 없습니다. 「외부 Story 가져오기」또는 내부 Story Miner 재실행을
                  확인하세요.
                </p>
              ) : (
                storyCandidates.map((c, index) => {
                  const headline =
                    c.storyQuestion?.trim() ||
                    c.storyClaim?.trim() ||
                    c.curiosityGap?.trim() ||
                    `Story 후보 #${index + 1}`;
                  const hasDetails =
                    Boolean(c.whyInteresting?.trim()) ||
                    c.mechanisms.length > 0 ||
                    c.researchQuestions.length > 0;
                  return (
                  <div
                    key={c.pointId}
                    className={cn(
                      "rounded border border-[var(--success)]/30 bg-white/60 px-2.5 py-2",
                      c.researchRejected && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          후보 #{index + 1}
                          {c.researchRejected ? " · 연구 거부됨" : ""}
                          {" · "}
                          <span className="font-medium text-[var(--text-primary)]">{c.sourceLabel}</span>
                        </div>
                        <p className="mt-0.5 font-medium text-[var(--text-primary)]">{headline}</p>
                      </div>
                      {onSelectStory && !c.researchRejected ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSelectStory(c.pointId)}
                          className="min-h-11 shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
                        >
                          이 Story로 제작
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1 text-[12px] text-[var(--text-secondary)]">
                      {c.audienceTension ? (
                        <p>
                          <span className="font-medium text-[var(--text-primary)]">긴장 </span>
                          {c.audienceTension}
                        </p>
                      ) : null}
                      {c.readerPayoff ? (
                        <p>
                          <span className="font-medium text-[var(--text-primary)]">얻는 것 </span>
                          {c.readerPayoff}
                        </p>
                      ) : null}
                      {c.genericRisk ? (
                        <p className="rounded border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-1 text-[var(--warning)]">
                          <span className="font-medium">주의 </span>
                          {c.genericRisk}
                        </p>
                      ) : null}
                    </div>
                    {hasDetails ? (
                      <details className="mt-2 text-[11px] text-[var(--text-secondary)]">
                        <summary className="cursor-pointer text-[var(--primary)]">상세 보기</summary>
                        <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
                          {c.whyInteresting ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-[var(--text-primary)]">왜 흥미로운가 </dt>
                              <dd className="inline">{c.whyInteresting}</dd>
                            </div>
                          ) : null}
                          {c.mechanisms.length > 0 ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-[var(--text-primary)]">메커니즘 </dt>
                              <dd className="inline">{c.mechanisms.join(", ")}</dd>
                            </div>
                          ) : null}
                          {c.researchQuestions.length > 0 ? (
                            <div className="sm:col-span-2">
                              <dt className="inline font-medium text-[var(--text-primary)]">연구 질문 </dt>
                              <dd className="inline">{c.researchQuestions.join(" · ")}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </details>
                    ) : null}
                  </div>
                  );
                })
              )}
            </div>
          ) : null}
          {pr.status === "FAILED" ? (
            <p className="mt-2 font-medium">
              오류: {pr.lastError ?? pr.errorMessage ?? "알 수 없는 실패"}
            </p>
          ) : null}
          {pr.status === "FAILED" && onRetryProduction ? (
            <div className="mt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onRetryProduction()}
                className="min-h-11 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm font-medium text-[var(--danger)] disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
              >
                재시도 (대기열 재등록)
              </button>
            </div>
          ) : null}
          {pr.status === "QUEUED" ? (
            <p className="mt-2">
              Pi 워커가 약 1분 안에 수락합니다. 이 화면은 자동으로 상태를 갱신합니다.
            </p>
          ) : null}
          {pr.status === "RUNNING" ? (
            <p className="mt-2">
              Content Strategist → Governance 경로가 진행 중입니다. 완료될 때까지 기다려 주세요.
            </p>
          ) : null}
        </div>
      ) : item.state === "SELECTED_TODAY" ? (
        <div className="rounded border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          오늘은 선택됨. 아직 제작 요청이 없습니다. 상단 「제작 요청」을 눌러야 Pi 대기열에
          등록됩니다.
        </div>
      ) : null}

      {awaitingStory ? (
        <details className="text-xs text-[var(--text-secondary)]">
          <summary className="cursor-pointer text-[var(--primary)]">Agenda / MM 근거 (접힘)</summary>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-[var(--text-primary)]">왜 지금</dt>
              <dd>{ed.freshnessWhyNow ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">한국 여행자 관련성</dt>
              <dd>{ed.koreanTravelerRelevance ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">실무 가치</dt>
              <dd>{ed.practicalTravelValue ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-[var(--text-primary)]">TheAllTour 관련성</dt>
              <dd>{ed.theAllTourBusinessRelevance ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-2">
            <p className="font-medium text-[var(--text-primary)]">MM 추천 근거</p>
            {item.rationale.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {item.rationale.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">—</p>
            )}
          </div>
        </details>
      ) : (
        <>
      <dl className="grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
        <div>
          <dt className="font-medium text-[var(--text-primary)]">왜 지금</dt>
          <dd>{ed.freshnessWhyNow ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text-primary)]">한국 여행자 관련성</dt>
          <dd>{ed.koreanTravelerRelevance ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text-primary)]">실무 가치</dt>
          <dd>{ed.practicalTravelValue ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-[var(--text-primary)]">TheAllTour 관련성</dt>
          <dd>{ed.theAllTourBusinessRelevance ?? "—"}</dd>
        </div>
      </dl>

      <div className="text-xs text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)]">MM 추천 근거</p>
        {item.rationale.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {item.rationale.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">—</p>
        )}
        <p className="mt-2">
          추천 채널/형식: {item.recommendedChannel ?? "—"}
          {item.recommendedFormats.length ? ` / ${item.recommendedFormats.join(", ")}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy || item.state === "SELECTED_TODAY"}
          onClick={() => onAction("select_today")}
          className="min-h-11 rounded-lg border border-[var(--success)]/40 bg-[var(--success-bg)] px-3 py-2 text-sm font-medium text-[var(--success)] disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          오늘 제작
        </button>
        <button
          type="button"
          disabled={busy || item.state === "DEFERRED"}
          onClick={() => onAction("defer")}
          className="min-h-11 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-3 py-2 text-sm font-medium text-[var(--warning)] disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          내일
        </button>
        <button
          type="button"
          disabled={busy || item.state === "REJECTED"}
          onClick={() => onAction("reject")}
          className="min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          제외
        </button>
        {item.state !== "AVAILABLE" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("reset_available")}
            className="min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
          >
            대기로
          </button>
        ) : null}
      </div>
        </>
      )}
    </div>
  );
}

export function AgendaSlatePanel({
  businessDateKst: initialBusinessDateKst,
}: {
  businessDateKst?: string;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedDate, setSelectedDate] = useState<string | null>(
    initialBusinessDateKst ?? null,
  );
  const [todayBusinessDateKst, setTodayBusinessDateKst] = useState<string | null>(null);
  const [recentDays, setRecentDays] = useState<AgendaSlateDaySummary[]>([]);
  const [slate, setSlate] = useState<DailyAgendaSlate | null>(null);
  const [productionRequests, setProductionRequests] = useState<MarketingProductionRequest[]>([]);
  const [selectedTodayCount, setSelectedTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [importPreview, setImportPreview] = useState<{
    agendaId: string;
    agendaTitle: string;
    storyCountAccepted: number;
    storyTitles: string[];
    rejectedCount: number;
    selectedAgendaReasonKo: string | null;
  } | null>(null);

  useEffect(() => {
    setSelectedDate(initialBusinessDateKst ?? null);
  }, [initialBusinessDateKst]);

  const effectiveDate = selectedDate ?? todayBusinessDateKst;
  const isHistorical = Boolean(
    effectiveDate && todayBusinessDateKst && effectiveDate !== todayBusinessDateKst,
  );

  const dateBody = useMemo(
    () => (effectiveDate ? { businessDateKst: effectiveDate } : {}),
    [effectiveDate],
  );

  const requestBySlateItemId = useMemo(() => {
    const map = new Map<string, MarketingProductionRequest>();
    for (const req of productionRequests) {
      map.set(req.slateItemId, req);
    }
    return map;
  }, [productionRequests]);

  const needsPolling = useMemo(
    () =>
      productionRequests.some((r) => r.status === "QUEUED" || r.status === "RUNNING"),
    [productionRequests],
  );

  const dayOptions = useMemo(() => {
    const byDate = new Map<string, AgendaSlateDaySummary>();
    for (const day of recentDays) byDate.set(day.businessDateKst, day);
    if (todayBusinessDateKst && !byDate.has(todayBusinessDateKst)) {
      byDate.set(todayBusinessDateKst, {
        businessDateKst: todayBusinessDateKst,
        status: "ready_for_human_selection",
        candidateCount: 0,
        selectedTodayCount: 0,
        slateId: "",
      });
    }
    if (selectedDate && !byDate.has(selectedDate)) {
      byDate.set(selectedDate, {
        businessDateKst: selectedDate,
        status: "ready_for_human_selection",
        candidateCount: 0,
        selectedTodayCount: 0,
        slateId: "",
      });
    }
    return [...byDate.values()].sort((a, b) =>
      b.businessDateKst.localeCompare(a.businessDateKst),
    );
  }, [recentDays, todayBusinessDateKst, selectedDate]);

  const applySlatePayload = useCallback((data: SlateApiResponse) => {
    setSlate(data.slate);
    setProductionRequests(data.productionRequests ?? []);
    setSelectedTodayCount(data.selectedTodayCount ?? 0);
    if (data.todayBusinessDateKst) setTodayBusinessDateKst(data.todayBusinessDateKst);
    if (data.recentDays) setRecentDays(data.recentDays);
  }, []);

  const syncUrl = useCallback(
    (nextDate: string | null, today: string | null) => {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      if (!nextDate || (today && nextDate === today)) {
        params.delete("businessDateKst");
      } else {
        params.set("businessDateKst", nextDate);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const load = useCallback(
    async (options: { silent?: boolean; date?: string | null } = {}) => {
      if (!options.silent) {
        setLoading(true);
        setMessage(null);
      }
      const date = options.date === undefined ? selectedDate : options.date;
      const query =
        date != null && date.length > 0
          ? `?businessDateKst=${encodeURIComponent(date)}`
          : "";
      try {
        const res = await fetch(`/api/admin/marketing-review/agenda-slate${query}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as SlateApiResponse;
        if (!res.ok) {
          if (!options.silent) {
            setMessage(data.message ?? "슬레이트 로드 실패");
            setSlate(null);
            setProductionRequests([]);
          }
          return;
        }
        applySlatePayload(data);
      } catch {
        if (!options.silent) setMessage("슬레이트 로드 실패");
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [applySlatePayload, selectedDate],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!needsPolling) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 8_000);
    return () => window.clearInterval(id);
  }, [needsPolling, load]);

  function onSelectDate(next: string) {
    const today = todayBusinessDateKst;
    const normalized = today && next === today ? null : next;
    setSelectedDate(normalized);
    syncUrl(normalized, today);
  }

  async function runAction(slateItemId: string, action: AgendaSlateAction) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/agenda-slate/${encodeURIComponent(slateItemId)}/action`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...dateBody }),
        },
      );
      const data = (await res.json()) as SlateActionResponse;
      if (!res.ok) {
        setMessage(data.message ?? "액션 실패");
        return;
      }
      setSlate(data.slate);
      setSelectedTodayCount(data.selectedTodayCount ?? 0);
    } catch {
      setMessage("액션 실패");
    } finally {
      setBusy(false);
    }
  }

  async function requestProduction() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/request-production", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        createdCount?: number;
        requests?: MarketingProductionRequest[];
        executedProduction?: boolean;
        slate?: DailyAgendaSlate;
      };
      if (!res.ok) {
        setMessage(data.message ?? "제작 요청 실패");
        return;
      }
      const created = data.createdCount ?? 0;
      if (data.requests) setProductionRequests(data.requests);
      if (data.slate) setSlate(data.slate);
      setMessage(
        created > 0
          ? `제작 요청 ${created}건이 Pi 대기열(QUEUED)에 등록되었습니다. 워커가 수락하면 RUNNING으로 바뀌며, 이 화면이 자동 갱신됩니다.`
          : "새로 등록된 요청이 없습니다(이미 대기열에 있거나 선택이 비어 있음).",
      );
      await load({ silent: true });
    } catch {
      setMessage("제작 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  async function retryFailedProduction(slateItemId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/retry-production", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slateItemId, ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        request?: MarketingProductionRequest;
        slate?: DailyAgendaSlate | null;
        selectedTodayCount?: number;
      };
      if (!res.ok) {
        setMessage(data.message ?? "재시도 등록 실패");
        return;
      }
      if (data.slate) setSlate(data.slate);
      if (typeof data.selectedTodayCount === "number") {
        setSelectedTodayCount(data.selectedTodayCount);
      }
      setMessage(
        "실패 요청을 Pi 대기열(QUEUED)에 다시 등록했습니다. 워커가 수락하면 RUNNING으로 바뀝니다.",
      );
      await load({ silent: true });
    } catch {
      setMessage("재시도 등록 실패");
    } finally {
      setBusy(false);
    }
  }

  async function selectStory(slateItemId: string, storyPointId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/select-story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slateItemId, storyPointId, ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        request?: MarketingProductionRequest;
        slate?: DailyAgendaSlate | null;
        selectedTodayCount?: number;
      };
      if (!res.ok) {
        setMessage(data.message ?? "Story 선택 실패");
        return;
      }
      if (data.slate) setSlate(data.slate);
      if (typeof data.selectedTodayCount === "number") {
        setSelectedTodayCount(data.selectedTodayCount);
      }
      setMessage(
        "Story가 선택되었습니다. 제작이 Pi 대기열(QUEUED)에 재등록되어 타깃 연구부터 재개됩니다.",
      );
      await load({ silent: true });
    } catch {
      setMessage("Story 선택 실패");
    } finally {
      setBusy(false);
    }
  }

  async function copyChatGptSlate() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/export-chatgpt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        text?: string;
        agendaCount?: number;
      };
      if (!res.ok || !data.text) {
        setMessage(data.message ?? "Slate 내보내기 실패");
        return;
      }
      await navigator.clipboard.writeText(data.text);
      setMessage(`복사 완료 — 오늘 Slate ${data.agendaCount ?? 0}건이 포함되었습니다.`);
    } catch {
      setMessage("클립보드 복사 실패");
    } finally {
      setBusy(false);
    }
  }

  async function validateExternalImport() {
    setBusy(true);
    setMessage(null);
    setImportPreview(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/import-external-story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawJson: importRaw, dryRun: true, ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        preview?: {
          agendaId: string;
          agendaTitle: string;
          storyCountAccepted: number;
          storyTitles: string[];
          rejectedCount: number;
          selectedAgendaReasonKo: string | null;
        };
      };
      if (!res.ok || !data.preview) {
        setMessage(data.message ?? "검증 실패");
        return;
      }
      setImportPreview(data.preview);
      setMessage(data.message ?? "검증 OK");
    } catch {
      setMessage("검증 실패");
    } finally {
      setBusy(false);
    }
  }

  async function commitExternalImport() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate/import-external-story", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawJson: importRaw, dryRun: false, ...dateBody }),
      });
      const data = (await res.json()) as {
        message?: string;
        preview?: {
          agendaId: string;
          agendaTitle: string;
          storyCountAccepted: number;
          storyTitles: string[];
          rejectedCount: number;
          selectedAgendaReasonKo: string | null;
        };
        request?: MarketingProductionRequest;
      };
      if (!res.ok) {
        setMessage(data.message ?? "가져오기 실패");
        return;
      }
      setImportOpen(false);
      setImportRaw("");
      setImportPreview(null);
      setMessage(
        data.message ??
          `외부 Story ${data.preview?.storyCountAccepted ?? 0}개를 가져왔습니다. 자동 선택은 하지 않았습니다.`,
      );
      await load({ silent: true });
    } catch {
      setMessage("가져오기 실패");
    } finally {
      setBusy(false);
    }
  }

  const selectValue = effectiveDate ?? "";
  const selectedSummary = dayOptions.find((d) => d.businessDateKst === effectiveDate);

  return (
    <AdminCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agenda Slate</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              DB에 저장된 날짜별 슬레이트를 불러옵니다. 「오늘 제작」= 선택 · 「제작 요청」= Pi
              대기열 등록.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[16rem]">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]" htmlFor="slate-date">
              영업일 (KST)
            </label>
            <select
              id="slate-date"
              value={selectValue}
              disabled={busy || loading || dayOptions.length === 0}
              onChange={(e) => onSelectDate(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-50 sm:min-h-0"
            >
              {dayOptions.length === 0 ? (
                <option value="">불러오는 중…</option>
              ) : (
                dayOptions.map((day) => {
                  const isToday = day.businessDateKst === todayBusinessDateKst;
                  const label = [
                    day.businessDateKst,
                    isToday ? "오늘" : null,
                    day.slateId
                      ? `${day.candidateCount}후보 · ${slateStatusLabel(day.status)}`
                      : "슬레이트 없음",
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <option key={day.businessDateKst} value={day.businessDateKst}>
                      {label}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="text-xs text-[var(--text-secondary)]">
            {effectiveDate ? (
              <>
                표시 중: <span className="font-medium text-[var(--text-primary)]">{effectiveDate}</span>
                {isHistorical ? " (과거 날짜)" : " (오늘)"}
                {selectedSummary?.slateId
                  ? ` · ${selectedSummary.candidateCount}후보 · selected ${selectedTodayCount}/${MAX_SELECTED_TODAY}`
                  : null}
              </>
            ) : (
              <span>날짜를 선택하세요</span>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={busy || !slate || (slate.candidates.length ?? 0) < 1}
              onClick={() => void copyChatGptSlate()}
              className="min-h-11 w-full rounded-lg border border-violet-700/40 bg-violet-700/10 px-3 py-2 text-sm font-medium text-violet-950 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-xs"
            >
              ChatGPT용 전체 Slate 복사
            </button>
            <button
              type="button"
              disabled={busy || !slate}
              onClick={() => {
                setImportOpen(true);
                setImportPreview(null);
              }}
              className="min-h-11 w-full rounded-lg border border-violet-700/40 px-3 py-2 text-sm text-violet-950 disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-xs"
            >
              외부 Story 가져오기
            </button>
            <button
              type="button"
              disabled={busy || selectedTodayCount < 1}
              onClick={() => void requestProduction()}
              className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-xs"
            >
              선택한 {selectedTodayCount}개 제작 요청
            </button>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void load()}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] sm:min-h-0 sm:w-auto sm:py-1.5 sm:text-xs"
            >
              새로고침
            </button>
          </div>
        </div>
        {isHistorical ? (
          <p className="text-[11px] text-[var(--warning)]">
            과거 날짜 모드입니다. 선택/제작 요청은 해당 날짜 슬레이트와 대기열을 변경합니다.
          </p>
        ) : null}
      </div>

      <ProductionPipelineBanner requests={productionRequests} polling={needsPolling} />

      {importOpen ? (
        <div className="border-b border-[var(--border)] bg-violet-500/5 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">외부 Story 가져오기</h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                JSON을 붙여넣은 뒤 제목·개수를 확인하고 가져오세요. 「이 Story로 제작」선택은 별도로
                필요합니다.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setImportOpen(false);
                setImportPreview(null);
              }}
              className="text-xs text-[var(--text-secondary)] underline"
            >
              닫기
            </button>
          </div>
          <textarea
            value={importRaw}
            onChange={(e) => setImportRaw(e.target.value)}
            rows={10}
            placeholder="외부 Story JSON을 붙여넣으세요"
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
          />
          <details className="mt-2 text-[11px] text-[var(--text-secondary)]">
            <summary className="cursor-pointer text-[var(--primary)]">고급</summary>
            <p className="mt-1">
              contract: <span className="font-mono">external-editorial-director-v1</span>
            </p>
          </details>
          {importPreview ? (
            <div className="mt-2 rounded border border-violet-500/30 bg-white/70 px-3 py-2 text-xs text-[var(--text-secondary)]">
              <p>
                선정 Agenda:{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {importPreview.agendaTitle}
                </span>
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-[var(--primary)]">고급 · agendaId</summary>
                <p className="mt-0.5 font-mono text-[11px]">{importPreview.agendaId}</p>
              </details>
              {importPreview.selectedAgendaReasonKo ? (
                <p className="mt-1">이유: {importPreview.selectedAgendaReasonKo}</p>
              ) : null}
              <p className="mt-1">
                PASS 예상 {importPreview.storyCountAccepted}개
                {importPreview.rejectedCount > 0
                  ? ` · 거부 ${importPreview.rejectedCount}개`
                  : ""}
              </p>
              <ul className="mt-1 list-disc pl-4">
                {importPreview.storyTitles.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || importRaw.trim().length < 2}
              onClick={() => void validateExternalImport()}
              className="min-h-11 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
            >
              검증
            </button>
            <button
              type="button"
              disabled={busy || importRaw.trim().length < 2}
              onClick={() => void commitExternalImport()}
              className="min-h-11 rounded-lg bg-violet-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
            >
              가져오기
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--warning)]">{message}</p>
      ) : null}

      {loading ? (
        <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">불러오는 중…</p>
      ) : !slate ? (
        <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">
          {effectiveDate
            ? `${effectiveDate} Agenda Slate가 없습니다.`
            : "오늘(KST) Agenda Slate가 아직 없습니다. 09:00 슬레이트 크론 이후 표시됩니다."}
        </p>
      ) : (
        <>
          <div className="px-4 py-2 text-xs text-[var(--text-secondary)]">
            큐레이션:{" "}
            {slate.curation.mode === "manager_curated" ? "Marketing Manager" : "결정론적 폴백"}
            {slate.curation.managerMessage ? ` · ${slate.curation.managerMessage}` : ""}
          </div>
          {slate.candidates.map((item) => (
            <CandidateCard
              key={item.slateItemId}
              item={item}
              productionRequest={requestBySlateItemId.get(item.slateItemId) ?? null}
              busy={busy}
              onAction={(action) => void runAction(item.slateItemId, action)}
              onRetryProduction={() => void retryFailedProduction(item.slateItemId)}
              onSelectStory={(storyPointId) => void selectStory(item.slateItemId, storyPointId)}
              onImportExternalStory={() => {
                setImportOpen(true);
                setImportPreview(null);
              }}
            />
          ))}
        </>
      )}
    </AdminCard>
  );
}
