"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import type {
  AgendaSlateAction,
  AgendaSlateCandidate,
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

function productionStatusLabel(status: MarketingProductionRequest["status"]): string {
  switch (status) {
    case "QUEUED":
      return "대기열(QUEUED) — Pi 워커가 곧 수락";
    case "RUNNING":
      return "제작 진행 중(RUNNING)";
    case "COMPLETED":
      return "제작 완료(COMPLETED)";
    case "FAILED":
      return "제작 실패(FAILED)";
    default:
      return status;
  }
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
  const tone =
    counts.failed > 0
      ? "border-red-500/30 bg-red-500/5 text-red-900"
      : counts.running > 0
        ? "border-sky-500/30 bg-sky-500/5 text-sky-950"
        : counts.queued > 0
          ? "border-amber-500/30 bg-amber-500/5 text-amber-950"
          : "border-emerald-500/30 bg-emerald-500/5 text-emerald-950";

  return (
    <div className={cn("space-y-1 border-b px-4 py-3 text-xs", tone)}>
      <div className="font-semibold">
        제작 파이프라인: QUEUED {counts.queued} · RUNNING {counts.running} · COMPLETED{" "}
        {counts.completed} · FAILED {counts.failed}
        {polling ? " · 자동 갱신 중" : ""}
      </div>
      {latest ? (
        <div className="opacity-90">
          최근 요청: {productionStatusLabel(latest.status)}
          {latest.selection?.title ? ` — ${latest.selection.title}` : ""}
          {latest.status === "FAILED" && latest.lastError
            ? ` · 오류 ${latest.lastError}`
            : null}
          {latest.workerId ? ` · worker ${latest.workerId}` : null}
          {" · "}
          갱신 {formatTs(latest.updatedAt)}
        </div>
      ) : null}
      <div className="opacity-80">
        버튼은 대기열 등록만 합니다. hermes-pi 워커(약 1분 주기)가 수락하면 RUNNING → COMPLETED/FAILED로
        바뀝니다.
      </div>
    </div>
  );
}

function CandidateCard(props: {
  item: AgendaSlateCandidate;
  productionRequest?: MarketingProductionRequest | null;
  busy: boolean;
  onAction: (action: AgendaSlateAction) => void;
}) {
  const { item, productionRequest, busy, onAction } = props;
  const ed = item.editorial;
  const pr = productionRequest;

  return (
    <div
      className={cn(
        "space-y-3 border-t border-[var(--border)] px-4 py-4 first:border-t-0",
        item.state === "SELECTED_TODAY" && "bg-emerald-500/5",
        item.state === "DEFERRED" && "bg-amber-500/5",
        item.state === "REJECTED" && "bg-[var(--surface-muted)] opacity-80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
            {item.origin === "deferred_carryover" ? (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-900">
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
            pr.status === "FAILED" && "border-red-500/40 bg-red-500/10 text-red-900",
            pr.status === "RUNNING" && "border-sky-500/40 bg-sky-500/10 text-sky-950",
            pr.status === "QUEUED" && "border-amber-500/40 bg-amber-500/10 text-amber-950",
            pr.status === "COMPLETED" &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-950",
          )}
        >
          <div className="font-semibold">{productionStatusLabel(pr.status)}</div>
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
              완성 후보{" "}
              <Link
                href={`/theall_manager_only/marketing-review/${encodeURIComponent(pr.completedCandidateId)}`}
                className="font-medium underline underline-offset-2"
              >
                {pr.completedCandidateId}
              </Link>
            </p>
          ) : null}
          {pr.status === "FAILED" ? (
            <p className="mt-2 font-medium">
              오류: {pr.lastError ?? pr.errorMessage ?? "알 수 없는 실패"}
            </p>
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
          className="min-h-11 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          오늘 제작
        </button>
        <button
          type="button"
          disabled={busy || item.state === "DEFERRED"}
          onClick={() => onAction("defer")}
          className="min-h-11 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-sm font-medium text-amber-900 disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
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
    </div>
  );
}

export function AgendaSlatePanel() {
  const [slate, setSlate] = useState<DailyAgendaSlate | null>(null);
  const [productionRequests, setProductionRequests] = useState<MarketingProductionRequest[]>([]);
  const [selectedTodayCount, setSelectedTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const applySlatePayload = useCallback((data: SlateApiResponse) => {
    setSlate(data.slate);
    setProductionRequests(data.productionRequests ?? []);
    setSelectedTodayCount(data.selectedTodayCount ?? 0);
  }, []);

  const load = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
        setMessage(null);
      }
      try {
        const res = await fetch("/api/admin/marketing-review/agenda-slate", {
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
    [applySlatePayload],
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

  async function runAction(slateItemId: string, action: AgendaSlateAction) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/agenda-slate/${encodeURIComponent(slateItemId)}/action`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
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
        body: JSON.stringify({}),
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

  return (
    <AdminCard className="overflow-hidden p-0">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">오늘의 Agenda Slate</h2>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            「오늘 제작」= 선택 · 「제작 요청」= Pi 대기열 등록 · 실제 제작은 hermes-pi 워커가 수행
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            selected {selectedTodayCount} / {MAX_SELECTED_TODAY}
          </span>
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

      <ProductionPipelineBanner requests={productionRequests} polling={needsPolling} />

      {message ? (
        <p className="border-b border-[var(--border)] px-4 py-2 text-xs text-amber-900">{message}</p>
      ) : null}

      {loading ? (
        <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">불러오는 중…</p>
      ) : !slate ? (
        <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">
          오늘(KST) Agenda Slate가 아직 없습니다. 09:00 슬레이트 크론 이후 표시됩니다.
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
            />
          ))}
        </>
      )}
    </AdminCard>
  );
}
