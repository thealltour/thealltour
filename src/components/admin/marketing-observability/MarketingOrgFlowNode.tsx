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
      return "border-[var(--primary)]/50 bg-[var(--primary-soft)]";
    case "ok":
      return "border-[var(--success)]/40 bg-[var(--success-bg)]";
    case "revision_required":
      return "border-[var(--warning)]/50 bg-[var(--warning-bg)]";
    case "blocked":
      return "border-[var(--warning)]/50 bg-[var(--warning-bg)]";
    case "technical_error":
      return "border-[var(--danger)]/50 bg-[var(--danger-bg)]";
    case "stale":
      return "border-[var(--warning)]/40 bg-[var(--warning-bg)]";
    case "waiting":
      return "border-[var(--border)] bg-[var(--surface-muted)]";
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
  const externalManual =
    def.kind === "external_human_operated_ai" || def.executionMode === "manual_external";
  const state = planned || externalManual ? undefined : overlay?.state;
  const badge = planned
    ? "PLANNED"
    : externalManual
      ? "MANUAL"
      : orgExecutionStateLabel(state ?? "idle");

  return (
    <div
      className={cn(
        "min-w-[11.5rem] max-w-[14rem] rounded-md border px-3 py-2 shadow-sm",
        planned
          ? "border-dashed border-[var(--border)] bg-[var(--surface)] opacity-80"
          : externalManual
            ? "border-dashed border-[var(--text-secondary)]/45 bg-[var(--surface-muted)]"
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
            state === "technical_error" && "bg-[var(--danger-bg)] text-[var(--danger)]",
            state === "revision_required" && "bg-[var(--warning-bg)] text-[var(--warning)]",
            state === "running" && "bg-[var(--primary-soft)] text-[var(--primary)]",
            state === "ok" && "bg-[var(--success-bg)] text-[var(--success)]",
            state === "blocked" && "bg-[var(--warning-bg)] text-[var(--warning)]",
            state === "stale" && "bg-[var(--warning-bg)] text-[var(--warning)]",
            externalManual && "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]",
            (!state || state === "idle" || planned) &&
              !externalManual &&
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
