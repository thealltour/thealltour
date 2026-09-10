"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { TraceSpan } from "@evilmartians/agent-prism-types";
import { flattenSpans } from "@evilmartians/agent-prism-data";

import { TreeView } from "@/components/vendor/agent-prism/TreeView";
import "@/components/vendor/agent-prism/theme/theme.css";

import { MarketingObservabilityAnalyticsPanel } from "@/components/admin/marketing-observability/MarketingObservabilityAnalyticsPanel";
import { MarketingSpanDetailsPanel } from "@/components/admin/marketing-observability/MarketingSpanDetailsPanel";
import { useMarketingTraceLive } from "@/hooks/useMarketingTraceLive";
import type {
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import { dtoToMarketingTrace } from "@/lib/marketing/observability/viewer/dto";
import {
  marketingTraceToAgentPrismSpans,
  shortId,
} from "@/lib/marketing/observability/viewer/agentPrismBridge";
import {
  assessStaleRunning,
  computeLiveDurationMs,
  formatLiveDurationMs,
  marketingTraceStatusDisplayLabel,
  type MarketingTraceLiveConnectionState,
} from "@/lib/marketing/observability/viewer/live";
import { cn } from "@/lib/cn";

type Props = {
  initialTraces: MarketingTraceListItemDto[];
};

type PageTab = "analytics" | "runs";

export function MarketingObservabilityPageBody({ initialTraces }: Props) {
  const [tab, setTab] = useState<PageTab>("analytics");
  const [selectedId, setSelectedId] = useState<string | null>(initialTraces[0]?.traceId ?? null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | undefined>();
  const [expandedSpansIds, setExpandedSpansIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const { traces, detail, setDetail, connectionState, resync } = useMarketingTraceLive({
    initialTraces,
    selectedTraceId: selectedId,
    enabled: tab === "runs",
  });

  const hasRunning = useMemo(
    () =>
      traces.some((t) => t.status === "running") ||
      detail?.trace.status === "running" ||
      (detail?.spans.some((s) => s.status === "running") ?? false),
    [traces, detail],
  );

  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  const loadDetailInitial = useCallback(async (traceId: string) => {
    setLoadingDetail(true);
    setError(null);
    setSelectedSpan(undefined);
    try {
      const res = await fetch(`/api/admin/marketing-observability/traces/${encodeURIComponent(traceId)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `load_failed_${res.status}`);
      }
      const body = (await res.json()) as MarketingTraceDetailDto;
      setDetail(body);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoadingDetail(false);
    }
  }, [setDetail]);

  // First paint / selection change: REST load once; live transport continues silent merges.
  useEffect(() => {
    if (!selectedId) return;
    void loadDetailInitial(selectedId);
  }, [selectedId, loadDetailInitial]);

  const { trace, spans, tree } = useMemo(() => {
    if (!detail) return { trace: null, spans: [], tree: [] as TraceSpan[] };
    const mapped = dtoToMarketingTrace(detail);
    return {
      trace: mapped.trace,
      spans: mapped.spans,
      tree: marketingTraceToAgentPrismSpans(mapped.trace, mapped.spans),
    };
  }, [detail]);

  const selectedMarketingSpan = useMemo(() => {
    if (!selectedSpan) return null;
    return spans.find((s) => s.spanId === selectedSpan.id) ?? null;
  }, [selectedSpan, spans]);

  // Preserve selection + expand new spans without full tree flicker reset.
  useEffect(() => {
    if (!tree.length) {
      setExpandedSpansIds([]);
      setSelectedSpan(undefined);
      return;
    }
    const flat = flattenSpans(tree);
    const allIds = flat.map((s) => s.id);
    setExpandedSpansIds((prev) => {
      if (prev.length === 0) return allIds;
      const known = new Set(prev);
      const keep = prev.filter((id) => allIds.includes(id));
      const added = allIds.filter((id) => !known.has(id));
      return [...keep, ...added];
    });
    setSelectedSpan((prev) => {
      if (!prev) return tree[0];
      return flat.find((s) => s.id === prev.id) ?? tree[0];
    });
  }, [tree]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            AI 마케팅
          </p>
          <h1 className="text-xl font-semibold text-[var(--text)]">AI 조직 관제</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Marketing workflow trace (read-only · AgentPrism · live)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "runs" ? <ConnectionBadge state={connectionState} /> : null}
          {tab === "runs" ? (
            <button
              type="button"
              onClick={() => void resync().catch(() => undefined)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-muted)]"
            >
              목록 새로고침
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {(
          [
            { id: "analytics" as const, label: "Analytics" },
            { id: "runs" as const, label: "Runs" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              tab === item.id
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "analytics" ? (
        <MarketingObservabilityAnalyticsPanel className="rounded border border-[var(--border)] bg-[var(--surface)] p-4" />
      ) : (
        <div className="min-h-[36rem] flex-1 overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)]">
          <div className="hidden h-full min-h-[36rem] lg:block">
            <PanelGroup direction="horizontal" className="h-full min-h-[36rem]">
              <Panel defaultSize={22} minSize={16} maxSize={36} className="min-h-0">
                <RecentRunsList
                  traces={traces}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  nowMs={nowMs}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-[var(--border)]" />
              <Panel defaultSize={48} minSize={30} className="min-h-0">
                <TreePane
                  loading={loadingDetail && detail?.trace.traceId !== selectedId}
                  error={error}
                  tree={tree}
                  selectedSpan={selectedSpan}
                  setSelectedSpan={setSelectedSpan}
                  expandedSpansIds={expandedSpansIds}
                  setExpandedSpansIds={setExpandedSpansIds}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-[var(--border)]" />
              <Panel defaultSize={30} minSize={22} maxSize={45} className="min-h-0">
                <MarketingSpanDetailsPanel span={selectedMarketingSpan} trace={trace} className="h-full border-0" />
              </Panel>
            </PanelGroup>
          </div>

          <div className="flex h-full min-h-[36rem] flex-col gap-3 overflow-auto p-3 lg:hidden">
            <RecentRunsList
              traces={traces}
              selectedId={selectedId}
              onSelect={setSelectedId}
              nowMs={nowMs}
              compact
            />
            <TreePane
              loading={loadingDetail && detail?.trace.traceId !== selectedId}
              error={error}
              tree={tree}
              selectedSpan={selectedSpan}
              setSelectedSpan={setSelectedSpan}
              expandedSpansIds={expandedSpansIds}
              setExpandedSpansIds={setExpandedSpansIds}
            />
            <MarketingSpanDetailsPanel span={selectedMarketingSpan} trace={trace} className="min-h-64" />
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ state }: { state: MarketingTraceLiveConnectionState }) {
  const label =
    state === "live"
      ? "Live"
      : state === "connecting"
        ? "Connecting"
        : state === "reconnecting"
          ? "Reconnecting"
          : "Offline";
  const tone =
    state === "live"
      ? "border-emerald-600/40 text-emerald-800 dark:text-emerald-300"
      : state === "offline"
        ? "border-red-600/40 text-red-800 dark:text-red-300"
        : "border-[var(--border)] text-[var(--text-secondary)]";
  return (
    <span
      className={cn(
        "rounded border bg-[var(--surface)] px-2.5 py-1 text-xs font-medium tracking-wide",
        tone,
      )}
      title="Realtime transport status (DB remains source of truth)"
    >
      {label}
    </span>
  );
}

function RecentRunsList({
  traces,
  selectedId,
  onSelect,
  nowMs,
  compact,
}: {
  traces: MarketingTraceListItemDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  nowMs: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", compact ? "" : "border-r border-[var(--border)]")}>
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
        최근 실행
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {traces.length === 0 ? (
          <li className="px-3 py-6 text-sm text-[var(--text-secondary)]">저장된 trace가 없습니다</li>
        ) : (
          traces.map((t) => {
            const selected = t.traceId === selectedId;
            const started = new Date(t.startedAt);
            const timeLabel = Number.isFinite(started.getTime())
              ? started.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
              : "—";
            const stale = assessStaleRunning({
              status: t.status,
              startedAt: t.startedAt,
              endedAt: t.endedAt,
              nowMs,
            });
            const duration = formatLiveDurationMs(
              computeLiveDurationMs(t.startedAt, t.endedAt, nowMs) ?? t.durationMs,
            );
            return (
              <li key={t.traceId}>
                <button
                  type="button"
                  onClick={() => onSelect(t.traceId)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2.5 text-left text-sm",
                    selected ? "bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[var(--text)]">{timeLabel}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{duration}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={cn(
                        "font-semibold tracking-wide",
                        stale.isStale ? "text-amber-800 dark:text-amber-300" : "text-[var(--text)]",
                      )}
                      title={stale.isStale ? stale.label ?? undefined : undefined}
                    >
                      {marketingTraceStatusDisplayLabel(t.status, stale)}
                      {stale.isStale ? (
                        <span className="ml-1 font-normal opacity-80">· {stale.label}</span>
                      ) : null}
                    </span>
                    <span className="truncate text-[var(--text-secondary)]">
                      {t.productionRequestId ? shortId(t.productionRequestId, 12) : shortId(t.traceId, 8)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function TreePane({
  loading,
  error,
  tree,
  selectedSpan,
  setSelectedSpan,
  expandedSpansIds,
  setExpandedSpansIds,
}: {
  loading: boolean;
  error: string | null;
  tree: TraceSpan[];
  selectedSpan: TraceSpan | undefined;
  setSelectedSpan: (span: TraceSpan | undefined) => void;
  expandedSpansIds: string[];
  setExpandedSpansIds: (ids: string[]) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
        선택한 실행
      </div>
      <div className="agentprism-scope min-h-0 flex-1 overflow-auto bg-[var(--surface)]">
        {loading ? (
          <p className="p-4 text-sm text-[var(--text-secondary)]">불러오는 중…</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : tree.length === 0 ? (
          <p className="p-4 text-sm text-[var(--text-secondary)]">표시할 span이 없습니다</p>
        ) : (
          <TreeView
            spans={tree}
            selectedSpan={selectedSpan}
            onSpanSelect={setSelectedSpan}
            expandedSpansIds={expandedSpansIds}
            onExpandSpansIdsChange={setExpandedSpansIds}
          />
        )}
      </div>
    </div>
  );
}
