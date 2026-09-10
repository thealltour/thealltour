"use client";

import { memo, useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import type { MarketingOrgFlowNodeData } from "@/lib/marketing/observability/viewer/organization/layout";
import {
  orgExecutionStateLabel,
  orgNodeKindLabel,
  type MarketingOrgExecutionState,
} from "@/lib/marketing/observability/viewer/organization/overlay";
import { computeLiveDurationMs, formatLiveDurationMs } from "@/lib/marketing/observability/viewer/live/duration";
import { cn } from "@/lib/cn";

type OrgNode = Node<MarketingOrgFlowNodeData, "marketingOrg">;

function stateTone(state: MarketingOrgExecutionState | undefined): string {
  switch (state) {
    case "running":
      return "border-sky-600/50 bg-sky-500/10";
    case "ok":
      return "border-emerald-600/40 bg-emerald-500/10";
    case "revision_required":
      return "border-amber-600/50 bg-amber-500/10";
    case "blocked":
      return "border-orange-600/50 bg-orange-500/10";
    case "technical_error":
      return "border-red-600/50 bg-red-500/10";
    case "stale":
      return "border-amber-700/40 bg-amber-500/5";
    case "waiting":
      return "border-slate-500/40 bg-[var(--surface-muted)]";
    default:
      return "border-[var(--border)] bg-[var(--surface)]";
  }
}

function LiveDuration({ startedAt }: { startedAt: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const ms = computeLiveDurationMs(startedAt, null, nowMs);
  if (ms == null) return null;
  return (
    <span className="tabular-nums text-[10px] text-[var(--text-secondary)] motion-safe:animate-pulse">
      {formatLiveDurationMs(ms)}
    </span>
  );
}

function MarketingOrgNodeInner({ data }: NodeProps<OrgNode>) {
  const { def, overlay, selected } = data;
  const planned = def.kind === "planned_agent";
  const state = planned ? undefined : overlay?.state;
  const badge = planned ? "PLANNED" : orgExecutionStateLabel(state ?? "idle");

  return (
    <div
      className={cn(
        "min-w-[11.5rem] max-w-[14rem] rounded-md border px-3 py-2 shadow-sm",
        planned
          ? "border-dashed border-[var(--border)] bg-[var(--surface)] opacity-80"
          : stateTone(state),
        selected && "ring-2 ring-[var(--text)] ring-offset-1 ring-offset-[var(--surface)]",
      )}
      aria-label={`${def.label} ${orgNodeKindLabel(def.kind)} ${badge}`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-[var(--text-secondary)]" />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {orgNodeKindLabel(def.kind)}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-[var(--text)]">{def.label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
            state === "technical_error" && "bg-red-600/15 text-red-800 dark:text-red-300",
            state === "revision_required" && "bg-amber-600/15 text-amber-900 dark:text-amber-200",
            state === "running" && "bg-sky-600/15 text-sky-900 dark:text-sky-200",
            state === "ok" && "bg-emerald-600/15 text-emerald-900 dark:text-emerald-200",
            (!state || state === "idle" || planned) &&
              "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
          )}
        >
          {badge}
        </span>
        {overlay?.attemptLabels?.map((a) => (
          <span
            key={a}
            className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
          >
            {a}
          </span>
        ))}
        {(state === "running" || state === "stale") && overlay?.activeStartedAt ? (
          <LiveDuration startedAt={overlay.activeStartedAt} />
        ) : null}
        {state === "ok" && overlay?.durationMs != null ? (
          <span className="tabular-nums text-[10px] text-[var(--text-secondary)]">
            {formatLiveDurationMs(overlay.durationMs)}
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-[var(--text-secondary)]" />
    </div>
  );
}

export const MarketingOrgFlowNode = memo(MarketingOrgNodeInner);
