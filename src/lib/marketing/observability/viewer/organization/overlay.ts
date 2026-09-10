import type { MarketingSpanDto, MarketingTraceDetailDto } from "@/lib/marketing/observability/viewer/dto";
import { presentBusinessStatus } from "@/lib/marketing/observability/viewer/businessStatus";
import { computeLiveDurationMs } from "@/lib/marketing/observability/viewer/live/duration";
import { assessStaleRunning } from "@/lib/marketing/observability/viewer/live/staleRunning";
import type { SampledRate } from "@/lib/marketing/observability/viewer/analytics/stats";
import type { MarketingObservabilityAnalyticsDto } from "@/lib/marketing/observability/viewer/analytics/types";
import type {
  MarketingOrgEdgeKind,
  MarketingOrganizationEdgeDef,
  MarketingOrganizationNodeDef,
} from "@/lib/marketing/observability/viewer/organization/topology";
import {
  getDefaultVisibleEdges,
  getDefaultVisibleNodes,
} from "@/lib/marketing/observability/viewer/organization/topology";

export type MarketingOrgExecutionState =
  | "idle"
  | "waiting"
  | "running"
  | "ok"
  | "revision_required"
  | "blocked"
  | "technical_error"
  | "skipped"
  | "stale";

export type MarketingOrgEdgeVisitState = "not_yet" | "visited" | "active";

export type MarketingOrgNodeOverlay = {
  nodeId: string;
  state: MarketingOrgExecutionState;
  attemptMax: number | null;
  attemptLabels: string[];
  /** Terminal / snapshot duration. For RUNNING use activeStartedAt + browser timer. */
  durationMs: number | null;
  /** When set, UI computes live duration locally without rebuilding the graph model. */
  activeStartedAt: string | null;
  spanIds: string[];
  spanCount: number;
  technicalError: boolean;
  summary: string | null;
};

export type MarketingOrgEdgeOverlay = {
  edgeId: string;
  visit: MarketingOrgEdgeVisitState;
};

export type MarketingOrgStageAnalyticsSnippet = {
  runCount: number;
  medianMs: number | null;
  revisionRate: SampledRate | null;
  technicalErrorRate: SampledRate | null;
  insufficient: boolean;
};

export type MarketingOrganizationGraphModel = {
  nodes: MarketingOrganizationNodeDef[];
  edges: MarketingOrganizationEdgeDef[];
  nodeOverlays: Record<string, MarketingOrgNodeOverlay>;
  edgeOverlays: Record<string, MarketingOrgEdgeOverlay>;
  stageAnalytics: Record<string, MarketingOrgStageAnalyticsSnippet>;
};

function spanMatchesNode(span: MarketingSpanDto, node: MarketingOrganizationNodeDef): boolean {
  if (node.spanStages.includes(span.stage)) return true;
  if (node.spanNames?.some((n) => span.name === n || span.name.startsWith(`${n}.`))) return true;
  return false;
}

function executionStateForSpans(
  spans: MarketingSpanDto[],
  nowMs: number,
): Omit<MarketingOrgNodeOverlay, "nodeId" | "spanIds" | "spanCount" | "attemptLabels" | "attemptMax"> {
  if (spans.length === 0) {
    return {
      state: "idle",
      durationMs: null,
      activeStartedAt: null,
      technicalError: false,
      summary: null,
    };
  }

  const technical = spans.some((s) => s.otelStatusCode === "ERROR" || s.status === "error");
  if (technical) {
    const err = spans.find((s) => s.otelStatusCode === "ERROR" || s.status === "error");
    return {
      state: "technical_error",
      durationMs: err ? computeLiveDurationMs(err.startedAt, err.endedAt, nowMs) : null,
      activeStartedAt: null,
      technicalError: true,
      summary: err?.error?.message ?? err?.error?.class ?? "technical_error",
    };
  }

  const running = spans.filter((s) => s.status === "running" && !s.endedAt);
  if (running.length > 0) {
    const latest = running[running.length - 1]!;
    const stale = assessStaleRunning({
      status: "running",
      startedAt: latest.startedAt,
      endedAt: latest.endedAt,
      nowMs,
    });
    return {
      state: stale.isStale ? "stale" : "running",
      durationMs: null,
      activeStartedAt: latest.startedAt,
      technicalError: false,
      summary: stale.isStale ? stale.label : "running",
    };
  }

  // Prefer most recent terminal business outcome
  const terminal = [...spans].reverse().find((s) => s.status !== "running");
  if (!terminal) {
    return {
      state: "waiting",
      durationMs: null,
      activeStartedAt: null,
      technicalError: false,
      summary: null,
    };
  }

  const terminalDuration = computeLiveDurationMs(terminal.startedAt, terminal.endedAt, nowMs);
  if (terminal.status === "revision_required") {
    return {
      state: "revision_required",
      durationMs: terminalDuration,
      activeStartedAt: null,
      technicalError: false,
      summary: presentBusinessStatus(terminal.status, terminal.otelStatusCode).label,
    };
  }
  if (terminal.status === "blocked") {
    return {
      state: "blocked",
      durationMs: terminalDuration,
      activeStartedAt: null,
      technicalError: false,
      summary: presentBusinessStatus(terminal.status, terminal.otelStatusCode).label,
    };
  }
  if (terminal.status === "skipped") {
    return {
      state: "skipped",
      durationMs: terminalDuration,
      activeStartedAt: null,
      technicalError: false,
      summary: "skipped",
    };
  }
  if (terminal.status === "ok") {
    return {
      state: "ok",
      durationMs: terminalDuration,
      activeStartedAt: null,
      technicalError: false,
      summary: presentBusinessStatus(terminal.status, terminal.otelStatusCode).label,
    };
  }

  const presented = presentBusinessStatus(terminal.status, terminal.otelStatusCode);
  return {
    state: presented.isTechnicalError ? "technical_error" : "ok",
    durationMs: terminalDuration,
    activeStartedAt: null,
    technicalError: presented.isTechnicalError,
    summary: presented.label,
  };
}

const WORKFLOW_EDGE_ORDER = [
  "ri_to_mm",
  "mm_to_req",
  "req_to_ev",
  "ev_to_cs",
  "cs_to_cv",
  "cv_to_ga",
  "ga_to_hmr",
] as const;

function visitStateForEdge(
  edge: MarketingOrganizationEdgeDef,
  overlays: Record<string, MarketingOrgNodeOverlay>,
): MarketingOrgEdgeVisitState {
  if (
    edge.kind === "reports_to" ||
    edge.kind === "optional_handoff" ||
    edge.kind === "performance_feedback" ||
    edge.planned
  ) {
    return "not_yet";
  }
  const src = overlays[edge.source];
  const tgt = overlays[edge.target];
  if (!src || src.state === "idle") return "not_yet";
  if (src.state === "running" || src.state === "stale") return "active";
  if (
    src.state === "ok" ||
    src.state === "revision_required" ||
    src.state === "blocked" ||
    src.state === "technical_error" ||
    src.state === "skipped"
  ) {
    if (!tgt || tgt.state === "idle" || tgt.state === "waiting") return "active";
    return "visited";
  }
  return "not_yet";
}

function analyticsSnippetForNode(
  node: MarketingOrganizationNodeDef,
  analytics: MarketingObservabilityAnalyticsDto | null,
): MarketingOrgStageAnalyticsSnippet | null {
  if (!analytics || node.spanStages.length === 0) return null;
  const stage = analytics.stages.find((s) => node.spanStages.includes(s.stage));
  if (!stage) return null;
  return {
    runCount: stage.runCount,
    medianMs: stage.duration.medianMs,
    revisionRate: stage.revisionRate,
    technicalErrorRate: stage.technicalErrorRate,
    insufficient: stage.duration.insufficient || stage.runCount < 3,
  };
}

/**
 * Pure builder: Org topology + optional trace overlay + optional OBS-6 analytics snippets.
 */
export function buildMarketingOrganizationGraphModel(input: {
  showPlanned?: boolean;
  detail?: MarketingTraceDetailDto | null;
  analytics?: MarketingObservabilityAnalyticsDto | null;
  nowMs?: number;
}): MarketingOrganizationGraphModel {
  const showPlanned = input.showPlanned ?? false;
  const nowMs = input.nowMs ?? Date.now();
  const nodes = getDefaultVisibleNodes(showPlanned);
  const edges = getDefaultVisibleEdges(showPlanned);
  const spans = input.detail?.spans ?? [];

  const nodeOverlays: Record<string, MarketingOrgNodeOverlay> = {};
  for (const node of nodes) {
    const matched = spans.filter((s) => spanMatchesNode(s, node));
    const base = executionStateForSpans(matched, nowMs);
    // If any prior workflow node has started and this has no spans yet → waiting
    let state = base.state;
    if (state === "idle" && spans.length > 0 && node.tier === "workflow") {
      const idx = WORKFLOW_EDGE_ORDER.findIndex((id) => {
        const e = edges.find((x) => x.id === id);
        return e?.target === node.id;
      });
      if (idx >= 0) {
        const priorEdge = edges.find((e) => e.id === WORKFLOW_EDGE_ORDER[idx]);
        const prior = priorEdge ? nodeOverlays[priorEdge.source] : null;
        // prior may not be filled yet — compute after first pass
      }
    }
    const attempts = matched.map((s) => s.attempt).filter((a) => typeof a === "number");
    const attemptMax = attempts.length ? Math.max(...attempts) : null;
    const attemptLabels =
      attemptMax != null && attemptMax > 1
        ? Array.from(new Set(attempts.filter((a) => a >= 1))).sort((a, b) => a - b).map((a) => `#${a}`)
        : attemptMax === 1 && matched.some((s) => s.status === "revision_required" || attempts.some((a) => a > 1))
          ? ["#1"]
          : [];

    nodeOverlays[node.id] = {
      nodeId: node.id,
      ...base,
      state,
      attemptMax,
      attemptLabels:
        attemptMax != null && (attemptMax > 1 || matched.some((s) => s.status === "revision_required"))
          ? Array.from(new Set(attempts)).sort((a, b) => a - b).map((a) => `#${a}`)
          : [],
      spanIds: matched.map((s) => s.spanId),
      spanCount: matched.length,
    };
  }

  // Second pass: mark waiting for not-yet-visited workflow nodes after a visited predecessor
  for (const edgeId of WORKFLOW_EDGE_ORDER) {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) continue;
    const src = nodeOverlays[edge.source];
    const tgt = nodeOverlays[edge.target];
    if (!src || !tgt) continue;
    if (tgt.state !== "idle") continue;
    if (
      src.state === "ok" ||
      src.state === "running" ||
      src.state === "revision_required" ||
      src.state === "blocked" ||
      src.state === "technical_error" ||
      src.state === "stale"
    ) {
      tgt.state = "waiting";
    }
  }

  // Completeness → CS revision feedback: if completeness has revision_required and CS has attempt>=2
  const cv = nodeOverlays.completeness_validator;
  const cs = nodeOverlays.content_strategist;
  if (cv && cs && cv.state === "revision_required" && (cs.attemptMax ?? 1) >= 2) {
    // keep both; attempt labels already set
  }

  const edgeOverlays: Record<string, MarketingOrgEdgeOverlay> = {};
  for (const edge of edges) {
    edgeOverlays[edge.id] = {
      edgeId: edge.id,
      visit: visitStateForEdge(edge, nodeOverlays),
    };
  }

  // Temporary revision loop edge visit when CV revision_required and CS attempt 2 exists
  if (cv?.state === "revision_required" || (cs?.attemptMax ?? 0) >= 2) {
    // synthetic handled in UI via attempt badges; edge cs_to_cv marked active if revising
    if (edgeOverlays.cs_to_cv && (cv?.state === "revision_required" || cs?.state === "running")) {
      edgeOverlays.cs_to_cv.visit = "active";
    }
  }

  const stageAnalytics: Record<string, MarketingOrgStageAnalyticsSnippet> = {};
  for (const node of nodes) {
    const snip = analyticsSnippetForNode(node, input.analytics ?? null);
    if (snip) stageAnalytics[node.id] = snip;
  }

  return { nodes, edges, nodeOverlays, edgeOverlays, stageAnalytics };
}

export function orgNodeKindLabel(kind: MarketingOrganizationNodeDef["kind"]): string {
  switch (kind) {
    case "human":
      return "HUMAN";
    case "core_agent":
      return "CORE AGENT";
    case "shared_service":
      return "SHARED SERVICE";
    case "deterministic":
      return "DETERMINISTIC";
    case "validation":
      return "VALIDATION";
    case "human_boundary":
      return "HUMAN BOUNDARY";
    case "planned_agent":
      return "PLANNED";
    default:
      return String(kind).toUpperCase();
  }
}

export function orgExecutionStateLabel(state: MarketingOrgExecutionState): string {
  switch (state) {
    case "idle":
      return "IDLE";
    case "waiting":
      return "WAITING";
    case "running":
      return "RUNNING";
    case "ok":
      return "OK";
    case "revision_required":
      return "REVISION";
    case "blocked":
      return "BLOCKED";
    case "technical_error":
      return "ERROR";
    case "skipped":
      return "SKIPPED";
    case "stale":
      return "STALE";
    default:
      return String(state).toUpperCase();
  }
}

export function orgEdgeKindLabel(kind: MarketingOrgEdgeKind): string {
  switch (kind) {
    case "reports_to":
      return "reports to";
    case "mandatory_handoff":
      return "handoff";
    case "optional_handoff":
      return "optional";
    case "service_input":
      return "service";
    case "performance_feedback":
      return "feedback";
    case "human_approval":
      return "approval";
    default:
      return kind;
  }
}
