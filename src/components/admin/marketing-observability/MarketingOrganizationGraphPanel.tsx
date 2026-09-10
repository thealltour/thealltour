"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { MarketingOrgFlowNode } from "@/components/admin/marketing-observability/MarketingOrgFlowNode";
import type {
  MarketingTraceDetailDto,
  MarketingTraceListItemDto,
} from "@/lib/marketing/observability/viewer/dto";
import type { MarketingObservabilityAnalyticsDto } from "@/lib/marketing/observability/viewer/analytics/types";
import {
  buildMarketingOrganizationGraphModel,
  MARKETING_ORG_GROUP_CHAT_META,
  MARKETING_ORG_LATER_ROLES,
  orgExecutionStateLabel,
  orgNodeKindLabel,
  toReactFlowElements,
} from "@/lib/marketing/observability/viewer/organization";
import {
  computeLiveDurationMs,
  formatLiveDurationMs,
} from "@/lib/marketing/observability/viewer/live/duration";
import { shortId } from "@/lib/marketing/observability/viewer/agentPrismBridge";
import { cn } from "@/lib/cn";

const nodeTypes: NodeTypes = {
  marketingOrg: MarketingOrgFlowNode,
};

type Props = {
  traces: MarketingTraceListItemDto[];
  selectedTraceId: string | null;
  onSelectTrace: (traceId: string | null) => void;
  detail: MarketingTraceDetailDto | null;
  connectionState?: string;
  onOpenRunsTab: () => void;
  className?: string;
};

function formatPct(
  rate: { rate: number | null; numerator: number; denominator: number; insufficient: boolean } | null | undefined,
): string {
  if (!rate || rate.rate == null || rate.denominator <= 0) return "—";
  const pct = `${(rate.rate * 100).toFixed(rate.insufficient ? 0 : 1)}%`;
  return rate.insufficient ? `${pct} · 데이터 부족` : pct;
}

export function MarketingOrganizationGraphPanel(props: Props) {
  return (
    <ReactFlowProvider>
      <OrganizationGraphInner {...props} />
    </ReactFlowProvider>
  );
}

function OrganizationGraphInner({
  traces,
  selectedTraceId,
  onSelectTrace,
  detail,
  connectionState,
  onOpenRunsTab,
  className,
}: Props) {
  const [showPlanned, setShowPlanned] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<MarketingObservabilityAnalyticsDto | null>(null);
  /** Slow clock for stale re-assessment only — live duration ticks inside nodes. */
  const [staleClockMs, setStaleClockMs] = useState(() => Date.now());
  const [sidebarNowMs, setSidebarNowMs] = useState(() => Date.now());
  const { fitView } = useReactFlow();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/marketing-observability/analytics?range=7d", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        setAnalytics((await res.json()) as MarketingObservabilityAnalyticsDto);
      } catch {
        /* keep null */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasRunningOverlay = useMemo(() => {
    if (!detail) return false;
    return detail.spans.some((s) => s.status === "running" && !s.endedAt);
  }, [detail]);

  useEffect(() => {
    if (!hasRunningOverlay) return;
    const id = window.setInterval(() => setStaleClockMs(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, [hasRunningOverlay]);

  useEffect(() => {
    if (!hasRunningOverlay) return;
    const id = window.setInterval(() => setSidebarNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [hasRunningOverlay]);

  const model = useMemo(
    () =>
      buildMarketingOrganizationGraphModel({
        showPlanned,
        detail,
        analytics,
        nowMs: staleClockMs,
      }),
    [showPlanned, detail, analytics, staleClockMs],
  );

  const { nodes, edges } = useMemo(
    () => toReactFlowElements(model, selectedNodeId),
    [model, selectedNodeId],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fitView({ padding: 0.18, duration: 200 });
    }, 50);
    return () => window.clearTimeout(t);
  }, [showPlanned, fitView, selectedTraceId]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedDef = model.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedOverlay = selectedNodeId ? model.nodeOverlays[selectedNodeId] : undefined;
  const selectedAnalytics = selectedNodeId ? model.stageAnalytics[selectedNodeId] : undefined;

  return (
    <div className={cn("flex min-h-[36rem] flex-col gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Organization</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Org v2.1 topology + execution overlay (read-only)
            {connectionState ? ` · ${connectionState}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <span>Trace</span>
            <select
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text)]"
              value={selectedTraceId ?? ""}
              onChange={(e) => onSelectTrace(e.target.value || null)}
            >
              <option value="">Static topology</option>
              {traces.map((t) => (
                <option key={t.traceId} value={t.traceId}>
                  {t.status.toUpperCase()} ·{" "}
                  {t.productionRequestId ? shortId(t.productionRequestId, 12) : shortId(t.traceId, 8)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--text)]">
            <input
              type="checkbox"
              checked={showPlanned}
              onChange={(e) => setShowPlanned(e.target.checked)}
            />
            Show planned roles
          </label>
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.18, duration: 200 })}
            className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            Fit view
          </button>
        </div>
      </div>

      <div className="grid min-h-[32rem] flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded border border-[var(--border)] bg-[var(--surface)]">
          <div className="h-[32rem] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              minZoom={0.4}
              maxZoom={1.4}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnScroll
            >
              <Background gap={18} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                className="!hidden md:!block"
                pannable
                zoomable
                maskColor="color-mix(in srgb, var(--surface) 70%, transparent)"
              />
            </ReactFlow>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
          <section>
            <h3 className="text-sm font-semibold text-[var(--text)]">Selected node</h3>
            {!selectedDef ? (
              <p className="mt-2 text-[var(--text-secondary)]">노드를 선택하세요</p>
            ) : (
              <div className="mt-2 space-y-2">
                <div>
                  <div className="font-semibold text-[var(--text)]">{selectedDef.label}</div>
                  <div className="text-[var(--text-secondary)]">{orgNodeKindLabel(selectedDef.kind)}</div>
                </div>
                {selectedDef.description ? (
                  <p className="text-[var(--text-secondary)]">{selectedDef.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-semibold">
                    {selectedDef.kind === "planned_agent"
                      ? "PLANNED"
                      : orgExecutionStateLabel(selectedOverlay?.state ?? "idle")}
                  </span>
                  {selectedOverlay?.attemptLabels.map((a) => (
                    <span key={a} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">
                      Attempt {a}
                    </span>
                  ))}
                  {selectedOverlay?.activeStartedAt ? (
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      {formatLiveDurationMs(
                        computeLiveDurationMs(
                          selectedOverlay.activeStartedAt,
                          null,
                          sidebarNowMs,
                        ) ?? 0,
                      )}
                    </span>
                  ) : selectedOverlay?.durationMs != null ? (
                    <span className="tabular-nums text-[var(--text-secondary)]">
                      {formatLiveDurationMs(selectedOverlay.durationMs)}
                    </span>
                  ) : null}
                </div>
                {selectedOverlay?.summary ? (
                  <p className="text-[var(--text-secondary)]">{selectedOverlay.summary}</p>
                ) : null}
                {selectedOverlay && selectedOverlay.spanCount > 0 ? (
                  <p className="text-[var(--text-secondary)]">
                    spans in trace: {selectedOverlay.spanCount}
                  </p>
                ) : null}
                {selectedAnalytics ? (
                  <div className="rounded border border-[var(--border)] p-2">
                    <div className="font-semibold text-[var(--text)]">7d analytics</div>
                    <div className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
                      <div>Runs {selectedAnalytics.runCount}</div>
                      <div>
                        Median{" "}
                        {selectedAnalytics.medianMs == null
                          ? "—"
                          : formatLiveDurationMs(selectedAnalytics.medianMs)}
                        {selectedAnalytics.insufficient ? " · 데이터 부족" : ""}
                      </div>
                      <div>Revision {formatPct(selectedAnalytics.revisionRate)}</div>
                      <div>Technical errors {formatPct(selectedAnalytics.technicalErrorRate)}</div>
                    </div>
                  </div>
                ) : null}
                {selectedOverlay && selectedOverlay.spanCount > 0 ? (
                  <button
                    type="button"
                    onClick={onOpenRunsTab}
                    className="rounded border border-[var(--border)] px-2 py-1.5 text-[var(--text)] hover:bg-[var(--surface-muted)]"
                  >
                    View Trace Details
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text)]">Group Chat</h3>
            <ul className="mt-2 space-y-2 text-[var(--text-secondary)]">
              {MARKETING_ORG_GROUP_CHAT_META.map((g) => (
                <li key={g.id}>
                  <div className="font-medium text-[var(--text)]">{g.name}</div>
                  <div>
                    {g.status === "prepare" ? "PREPARE" : "Planned / Not created"} · lead {g.lead}
                  </div>
                  <div>{g.members.join(", ")}</div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text)]">LATER</h3>
            <p className="mt-1 text-[var(--text-secondary)]">{MARKETING_ORG_LATER_ROLES.join(" · ")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
