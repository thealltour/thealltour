"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { TraceSpan } from "@evilmartians/agent-prism-types";
import { flattenSpans } from "@evilmartians/agent-prism-data";

import { TreeView } from "@/components/vendor/agent-prism/TreeView";
import "@/components/vendor/agent-prism/theme/theme.css";

import { MarketingObservabilityAnalyticsPanel } from "@/components/admin/marketing-observability/MarketingObservabilityAnalyticsPanel";
import { MarketingOrganizationGraphPanel } from "@/components/admin/marketing-observability/MarketingOrganizationGraphPanel";
import { MarketingSpanDetailsPanel } from "@/components/admin/marketing-observability/MarketingSpanDetailsPanel";
import { MarketingTeamSubnav } from "@/components/admin/ai-marketing/MarketingTeamSubnav";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminBadge from "@/components/admin/ui/AdminBadge";
import AdminButton from "@/components/admin/ui/AdminButton";
import { adminToneText } from "@/components/admin/ui/adminStatusTone";
import { Tabs, TabsTrigger } from "@/components/ui/Tabs";
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

type PageTab = "organization" | "analytics" | "runs";

export function MarketingObservabilityPageBody({ initialTraces }: Props) {
  const [tab, setTab] = useState<PageTab>("organization");
  const [selectedId, setSelectedId] = useState<string | null>(initialTraces[0]?.traceId ?? null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<TraceSpan | undefined>();
  const [expandedSpansIds, setExpandedSpansIds] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const { traces, detail, setDetail, connectionState, resync } = useMarketingTraceLive({
    initialTraces,
    selectedTraceId: selectedId,
    enabled: tab === "runs" || tab === "organization",
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
            AI Marketing Team
          </p>
          <h1 className="text-xl font-semibold text-[var(--text)]">조직 관제</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            조직 토폴로지 + 실행 overlay (읽기 전용)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "runs" || tab === "organization" ? (
            <ConnectionBadge state={connectionState} />
          ) : null}
          {tab === "runs" ? (
            <AdminButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void resync().catch(() => undefined)}
            >
              목록 새로고침
            </AdminButton>
          ) : null}
        </div>
      </header>

      <MarketingTeamSubnav />

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as PageTab)}
        className="w-full max-w-md"
      >
        <TabsTrigger value="organization">Organization</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="runs">Runs</TabsTrigger>
      </Tabs>

      {tab === "organization" ? (
        <AdminCard className="p-4">
          <MarketingOrganizationGraphPanel
            className="border-0 bg-transparent p-0 shadow-none"
            traces={traces}
            selectedTraceId={selectedId}
            onSelectTrace={setSelectedId}
            detail={detail}
            connectionState={connectionState}
            onOpenRunsTab={() => setTab("runs")}
          />
        </AdminCard>
      ) : tab === "analytics" ? (
        <AdminCard className="p-4">
          <MarketingObservabilityAnalyticsPanel className="border-0 bg-transparent p-0 shadow-none" />
        </AdminCard>
      ) : (
        <AdminCard className="min-h-[36rem] flex-1 overflow-hidden p-0">
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
        </AdminCard>
      )}
    </div>
  );
}

function ConnectionBadge({ state }: { state: MarketingTraceLiveConnectionState }) {
  const variant =
    state === "live" ? ("success" as const) : state === "offline" ? ("danger" as const) : ("muted" as const);
  const label =
    state === "live"
      ? "Live"
      : state === "connecting"
        ? "Connecting"
        : state === "reconnecting"
          ? "Reconnecting"
          : "Offline";
  return (
    <span title="Realtime transport status (DB remains source of truth)">
      <AdminBadge variant={variant} showDot={variant !== "muted"}>
        {label}
      </AdminBadge>
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
  const partitioned = traces.reduce(
    (acc, t) => {
      const stale = assessStaleRunning({
        status: t.status,
        startedAt: t.startedAt,
        endedAt: t.endedAt,
        nowMs,
      });
      if (stale.isStale) acc.stale.push(t);
      else acc.active.push(t);
      return acc;
    },
    { active: [] as MarketingTraceListItemDto[], stale: [] as MarketingTraceListItemDto[] },
  );

  function renderRow(t: MarketingTraceListItemDto) {
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
                stale.isStale ? adminToneText.warning : "text-[var(--text)]",
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
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", compact ? "" : "border-r border-[var(--border)]")}>
      <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
        최근 실행
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {traces.length === 0 ? (
          <li className="px-3 py-6 text-sm text-[var(--text-secondary)]">저장된 trace가 없습니다</li>
        ) : (
          <>
            {partitioned.active.map(renderRow)}
            {partitioned.stale.length > 0 ? (
              <li className="border-b border-[var(--border)]">
                <details className="group">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60">
                    오래된 실행 {partitioned.stale.length}건
                    <span className="ml-1 opacity-70">(접힘 · 워커가 주기적으로 정리)</span>
                  </summary>
                  <ul>{partitioned.stale.map(renderRow)}</ul>
                </details>
              </li>
            ) : null}
          </>
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
          <p className={cn("p-4 text-sm", adminToneText.danger)}>{error}</p>
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
