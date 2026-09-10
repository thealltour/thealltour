"use client";

import { useMemo } from "react";
import type { MarketingSpan, MarketingTrace } from "@/lib/marketing/observability/types";
import { buildSpanDetailGroups } from "@/lib/marketing/observability/viewer/detailsGroups";
import { presentBusinessStatus } from "@/lib/marketing/observability/viewer/businessStatus";
import { marketingSpanDisplayName } from "@/lib/marketing/observability/viewer/displayLabels";
import { cn } from "@/lib/cn";

export function MarketingSpanDetailsPanel({
  span,
  trace,
  className,
}: {
  span: MarketingSpan | null;
  trace: MarketingTrace | null;
  className?: string;
}) {
  const groups = useMemo(
    () => (span ? buildSpanDetailGroups(span, trace) : []),
    [span, trace],
  );

  if (!span) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-secondary)]",
          className,
        )}
      >
        span을 선택하면 상세가 표시됩니다
      </div>
    );
  }

  const biz = presentBusinessStatus(span.status, span.otelStatusCode);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--text)]">
          {marketingSpanDisplayName(span.name, span.attempt)}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <StatusChip
            label={biz.label}
            tone={biz.visual === "error" ? "danger" : biz.visual === "warning" ? "warning" : biz.visual === "success" ? "success" : "muted"}
          />
          {biz.isTechnicalError ? <StatusChip label="Technical ERROR" tone="danger" /> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {groups.map((group) => (
          <section key={group.id} className="mb-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
              {group.title}
            </h3>
            <dl className="space-y-1.5">
              {group.rows.map((row) => (
                <div key={`${group.id}:${row.label}`} className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
                  <dt className="text-[var(--text-secondary)]">{row.label}</dt>
                  <dd className="break-all text-[var(--text)]">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "muted";
}) {
  const toneClass = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    danger: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  }[tone];
  return (
    <span className={cn("rounded border px-2 py-0.5 font-medium", toneClass)}>{label}</span>
  );
}
