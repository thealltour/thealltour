"use client";

import { useCallback, useEffect, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import type {
  AgendaSlateAction,
  AgendaSlateCandidate,
  DailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { MAX_SELECTED_TODAY } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { cn } from "@/lib/cn";

type SlateApiResponse = {
  slate: DailyAgendaSlate | null;
  selectedTodayCount: number;
  maxSelectedToday: number;
  message?: string;
  code?: string;
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

function sourceLabel(item: AgendaSlateCandidate): string {
  const first = item.evidenceSummary[0];
  if (first?.sourceName) return first.sourceName;
  if (first?.url) return first.url;
  return item.researchBriefId ?? item.agendaCandidateId ?? "—";
}

function CandidateCard(props: {
  item: AgendaSlateCandidate;
  busy: boolean;
  onAction: (action: AgendaSlateAction) => void;
}) {
  const { item, busy, onAction } = props;
  const ed = item.editorial;

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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || item.state === "SELECTED_TODAY"}
          onClick={() => onAction("select_today")}
          className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-800 disabled:opacity-50"
        >
          오늘 제작
        </button>
        <button
          type="button"
          disabled={busy || item.state === "DEFERRED"}
          onClick={() => onAction("defer")}
          className="rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
        >
          내일
        </button>
        <button
          type="button"
          disabled={busy || item.state === "REJECTED"}
          onClick={() => onAction("reject")}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
        >
          제외
        </button>
        {item.state !== "AVAILABLE" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction("reset_available")}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] disabled:opacity-50"
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
  const [selectedTodayCount, setSelectedTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/marketing-review/agenda-slate", { cache: "no-store" });
      const data = (await res.json()) as SlateApiResponse;
      if (!res.ok) {
        setMessage(data.message ?? "슬레이트 로드 실패");
        setSlate(null);
        return;
      }
      setSlate(data.slate);
      setSelectedTodayCount(data.selectedTodayCount ?? 0);
    } catch {
      setMessage("슬레이트 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        requests?: unknown[];
        executedProduction?: boolean;
      };
      if (!res.ok) {
        setMessage(data.message ?? "제작 요청 실패");
        return;
      }
      setMessage(
        `제작 요청 ${data.createdCount ?? 0}건 큐에 저장됨 (파이프라인은 실행하지 않음)`,
      );
      await load();
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
            선택만으로는 제작이 시작되지 않습니다. 연구 점수만으로 설명하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            selected {selectedTodayCount} / {MAX_SELECTED_TODAY}
          </span>
          <button
            type="button"
            disabled={busy || selectedTodayCount < 1}
            onClick={() => void requestProduction()}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            선택한 {selectedTodayCount}개 제작 요청
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void load()}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]"
          >
            새로고침
          </button>
        </div>
      </div>

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
            큐레이션: {slate.curation.mode === "manager_curated" ? "Marketing Manager" : "결정론적 폴백"}
            {slate.curation.managerMessage ? ` · ${slate.curation.managerMessage}` : ""}
          </div>
          {slate.candidates.map((item) => (
            <CandidateCard
              key={item.slateItemId}
              item={item}
              busy={busy}
              onAction={(action) => void runAction(item.slateItemId, action)}
            />
          ))}
        </>
      )}
    </AdminCard>
  );
}

type SlateActionResponse = {
  slate: DailyAgendaSlate;
  selectedTodayCount: number;
  message?: string;
};
