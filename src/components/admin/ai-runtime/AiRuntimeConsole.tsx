"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { RuntimeQuotaSnapshotDto, RuntimeReservationSnapshotDto, RuntimeRoutingPolicyDto, RuntimeRoutingStatusDto, RuntimeSchedulerStatusDto, RuntimeStatusDto } from "@/ai-runtime/observability/types";
import type { QuotaHealth } from "@/ai-runtime/domain/quota";
import { cn } from "@/lib/cn";

type StatusTone = "success" | "warning" | "muted" | "danger";

function StatusBadge({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: StatusTone;
}) {
  const toneClass: Record<StatusTone, string> = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  };

  return (
    <span
      className={cn(
        "inline-flex min-h-[28px] items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        toneClass[tone],
      )}
    >
      {label}
    </span>
  );
}

function quotaHealthLabel(health: QuotaHealth): string {
  return health.toUpperCase();
}

function quotaHealthTone(health: QuotaHealth): StatusTone {
  switch (health) {
    case "green":
      return "success";
    case "yellow":
      return "warning";
    case "red":
    case "blocked":
      return "danger";
    default:
      return "muted";
  }
}

function formatTokenCount(value: number | undefined): string {
  if (value == null) return "Unknown";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function QuotaPanel({
  enabled,
  quota,
}: {
  enabled: boolean;
  quota?: RuntimeQuotaSnapshotDto;
}) {
  if (!enabled) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
        Provider disabled — quota health not evaluated.
      </div>
    );
  }

  if (!quota) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
        Quota data unavailable.
      </div>
    );
  }

  const minuteLimit =
    quota.configured?.rpm != null
      ? `${quota.minuteRequests} / ${quota.configured.rpm} RPM`
      : quota.observed?.limitRequests != null
        ? `${quota.observed.remainingRequests ?? "?"} / ${quota.observed.limitRequests} RPM (observed)`
        : `Requests: ${quota.minuteRequests} · Limit: Unknown`;

  const minuteTokens = quota.minuteTokensKnown
    ? quota.configured?.tpm != null
      ? `${formatTokenCount(quota.minuteTokens)} / ${formatTokenCount(quota.configured.tpm)} TPM`
      : quota.observed?.limitTokens != null
        ? `${formatTokenCount(quota.observed.remainingTokens)} / ${formatTokenCount(quota.observed.limitTokens)} TPM (observed)`
        : `Tokens: ${formatTokenCount(quota.minuteTokens)}`
    : "Tokens: Unknown";

  const dayLimit =
    quota.configured?.rpd != null
      ? `${quota.dayRequests} / ${quota.configured.rpd} RPD`
      : `Requests: ${quota.dayRequests} · Limit: Unknown`;

  const dayTokens = quota.dayTokensKnown
    ? quota.configured?.tpd != null
      ? `${formatTokenCount(quota.dayTokens)} / ${formatTokenCount(quota.configured.tpd)} TPD`
      : `Tokens: ${formatTokenCount(quota.dayTokens)}`
    : "Tokens: Unknown";

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Quota Health
        </p>
        <StatusBadge label={quotaHealthLabel(quota.health)} tone={quotaHealthTone(quota.health)} />
        {quota.blockedUntil ? (
          <span className="text-xs text-[var(--text-secondary)]">
            blocked until {new Date(quota.blockedUntil).toLocaleTimeString("ko-KR")}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-[var(--text-muted)]">Last 60s</p>
          <p className="break-words text-sm text-[var(--text-primary)]">{minuteLimit}</p>
          <p className="break-words text-sm text-[var(--text-secondary)]">{minuteTokens}</p>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-[var(--text-muted)]">Today (Asia/Seoul)</p>
          <p className="break-words text-sm text-[var(--text-primary)]">{dayLimit}</p>
          <p className="break-words text-sm text-[var(--text-secondary)]">{dayTokens}</p>
        </div>
      </div>
    </div>
  );
}

function ReservationPanel({
  enabled,
  reservation,
}: {
  enabled: boolean;
  reservation?: RuntimeReservationSnapshotDto;
}) {
  if (!enabled || !reservation) return null;

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Active Reservations
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <p className="text-sm text-[var(--text-primary)]">
          Count: {reservation.activeReservations}
        </p>
        <p className="text-sm text-[var(--text-primary)]">
          Reserved Requests: {reservation.reservedRequests}
        </p>
        <p className="break-words text-sm text-[var(--text-secondary)] sm:col-span-2">
          Reserved Tokens: {formatTokenCount(reservation.reservedTotalTokens)} · Limit: Unknown
        </p>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
}: {
  provider: RuntimeStatusDto["providers"][number];
}) {
  return (
    <AdminCard className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">
              {provider.displayName}
            </h3>
            <p className="break-all font-mono text-xs text-[var(--text-muted)]">{provider.id}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
              {provider.kind}
            </p>
          </div>
          <div className="flex max-w-full flex-wrap gap-2">
            <StatusBadge
              label={provider.enabled ? "Enabled" : "Disabled"}
              tone={provider.enabled ? "success" : "muted"}
            />
            <StatusBadge
              label={
                provider.adapterReadiness === "ready"
                  ? "Adapter Ready"
                  : "Adapter Unavailable"
              }
              tone={provider.adapterReadiness === "ready" ? "success" : "warning"}
            />
            <StatusBadge
              label={
                provider.credentialConfigured
                  ? "Credential Configured"
                  : "Credential Missing"
              }
              tone={provider.credentialConfigured ? "success" : "danger"}
            />
          </div>
        </div>

        {provider.disabledReason ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
            {provider.disabledReason}
          </p>
        ) : null}
      </div>

      <QuotaPanel enabled={provider.enabled} quota={provider.quota} />
      <ReservationPanel enabled={provider.enabled} reservation={provider.reservation} />

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Models ({provider.registeredModelCount})
        </p>

        {provider.models.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">등록된 모델 없음</p>
        ) : (
          <ul className="space-y-3">
            {provider.models.map((model) => (
              <li
                key={model.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
              >
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {model.displayName}
                    </p>
                    <p className="break-all font-mono text-xs text-[var(--text-muted)]">
                      {model.modelSlug}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={model.eligible ? "Eligible" : "Not eligible"}
                      tone={model.eligible ? "success" : "muted"}
                    />
                    {model.providerManaged ? (
                      <StatusBadge label="Provider-managed free routing" tone="warning" />
                    ) : null}
                    {model.quota ? (
                      <StatusBadge
                        label={quotaHealthLabel(model.quota.health)}
                        tone={quotaHealthTone(model.quota.health)}
                      />
                    ) : null}
                  </div>
                </div>

                {model.quota ? (
                  <div className="mt-3 space-y-1 text-xs text-[var(--text-secondary)]">
                    <p>
                      60s: {model.quota.minuteRequests} req
                      {model.quota.minuteTokensKnown
                        ? ` · ${formatTokenCount(model.quota.minuteTokens)} tok`
                        : " · tokens unknown"}
                    </p>
                    <p>
                      Today: {model.quota.dayRequests} req
                      {model.quota.dayTokensKnown
                        ? ` · ${formatTokenCount(model.quota.dayTokens)} tok`
                        : " · tokens unknown"}
                    </p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {model.workloads.map((workload) => (
                    <span
                      key={workload}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]"
                    >
                      {workload}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminCard>
  );
}

function providerLabel(providerId: string | undefined): string {
  if (!providerId) return "—";
  if (providerId.includes("gemini")) return "Gemini";
  if (providerId.includes("openrouter")) return "OpenRouter";
  if (providerId.includes("nvidia")) return "NVIDIA";
  return providerId;
}

function RoutingSummarySection({ routing }: { routing: RuntimeRoutingStatusDto }) {
  const fallbackPercent = Math.round(routing.fallbackRate * 100);

  return (
    <AdminCard className="space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Routing</h2>
        <p className="text-xs text-[var(--text-secondary)]">Last 1h · bounded in-memory ledger</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminSummaryCard title="Requests routed" value={routing.lastHourRequests} />
        <AdminSummaryCard title="Fallbacks" value={routing.fallbackCount} />
        <AdminSummaryCard title="Fallback rate" value={`${fallbackPercent}%`} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Provider Selection
        </p>
        {Object.keys(routing.providerSelections).length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">No successful routes in the last hour.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {Object.entries(routing.providerSelections).map(([label, count]) => (
              <li key={label}>
                <StatusBadge label={`${label} ${count}`} tone="success" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminCard>
  );
}

function RoutingPolicySection({ policies }: { policies: RuntimeRoutingPolicyDto[] }) {
  return (
    <AdminCard className="space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Routing Policy</h2>
        <p className="text-xs text-[var(--text-secondary)]">Default model order per workload</p>
      </div>
      <ul className="space-y-3">
        {policies.map((policy) => (
          <li
            key={policy.workload}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3"
          >
            <p className="font-mono text-xs font-medium uppercase text-[var(--text-muted)]">
              {policy.workload}
            </p>
            <p className="mt-1 text-sm text-[var(--text-primary)]">
              {policy.orderLabels.join(" → ")}
            </p>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function RecentRoutingSection({ routing }: { routing: RuntimeRoutingStatusDto }) {
  if (routing.recent.length === 0) {
    return (
      <AdminCard className="p-4 md:p-5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Routing</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">No routing events recorded yet.</p>
      </AdminCard>
    );
  }

  return (
    <>
      <section className="hidden overflow-x-auto lg:block">
        <AdminCard className="min-w-0 overflow-hidden">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Routing</h2>
          </div>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-4 py-3">Workload</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Fallback</th>
              </tr>
            </thead>
            <tbody>
              {routing.recent.map((entry, index) => (
                <tr key={`${entry.timestamp}-${index}`} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs">{entry.workload}</td>
                  <td className="px-4 py-3">{providerLabel(entry.selectedProviderId)}</td>
                  <td className="break-all px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {entry.selectedModelId ?? "—"}
                  </td>
                  <td className="px-4 py-3">{entry.attemptCount}</td>
                  <td className="px-4 py-3">{entry.fallbackUsed ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      </section>

      <section className="space-y-3 lg:hidden">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Routing</h2>
        {routing.recent.map((entry, index) => (
          <AdminCard key={`${entry.timestamp}-${index}`} className="space-y-2 p-4">
            <p className="font-mono text-xs uppercase text-[var(--text-muted)]">{entry.workload}</p>
            <p className="text-sm text-[var(--text-primary)]">
              Selected: {providerLabel(entry.selectedProviderId)}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Fallback: {entry.fallbackUsed ? "Yes" : "No"}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Attempts: {entry.attemptCount}</p>
          </AdminCard>
        ))}
      </section>
    </>
  );
}

function formatDeferReason(reason: string | undefined): string {
  switch (reason) {
    case "quota":
      return "Quota";
    case "rate_limit":
      return "Rate limit";
    case "provider_unavailable":
      return "Provider unavailable";
    case "timeout":
      return "Timeout";
    default:
      return reason ?? "—";
  }
}

function secondsUntil(iso: string | undefined, nowMs: number): number | undefined {
  if (!iso) return undefined;
  const diff = Date.parse(iso) - nowMs;
  return diff > 0 ? Math.ceil(diff / 1000) : undefined;
}

function SchedulerSummarySection({
  scheduler,
  generatedAt,
}: {
  scheduler: RuntimeSchedulerStatusDto;
  generatedAt: string;
}) {
  const nowMs = Date.parse(generatedAt);

  return (
    <AdminCard className="space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Scheduler</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Live (this process) · Priority queue · in-memory job store
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminSummaryCard title="Queued" value={scheduler.queued} />
        <AdminSummaryCard title="Running" value={scheduler.running} />
        <AdminSummaryCard title="Deferred" value={scheduler.deferred} />
        <AdminSummaryCard title="Failed (1h)" value={scheduler.failedLastHour} />
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        Runnable now: {scheduler.runnable} · Completed (1h): {scheduler.completedLastHour} · Cancelled:{" "}
        {scheduler.cancelled}
      </p>

      <RecentJobsSection scheduler={scheduler} nowMs={nowMs} />
    </AdminCard>
  );
}

function RecentJobsSection({
  scheduler,
  nowMs,
}: {
  scheduler: RuntimeSchedulerStatusDto;
  nowMs: number;
}) {
  if (scheduler.recent.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">No scheduler jobs recorded yet.</p>
    );
  }

  return (
    <>
      <section className="hidden overflow-x-auto lg:block">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Recent Jobs
          </p>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Workload</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Defer</th>
              </tr>
            </thead>
            <tbody>
              {scheduler.recent.map((job) => {
                const retryIn = secondsUntil(job.availableAt, nowMs);
                return (
                  <tr key={job.jobId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{job.agentId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{job.workload}</td>
                    <td className="px-3 py-2">{job.priority}</td>
                    <td className="px-3 py-2 uppercase">{job.status}</td>
                    <td className="px-3 py-2">{job.attempts}</td>
                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {job.deferReason ? formatDeferReason(job.deferReason) : "—"}
                      {retryIn != null ? ` · ${retryIn}s` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 lg:hidden">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Recent Jobs
        </p>
        {scheduler.recent.map((job) => {
          const retryIn = secondsUntil(job.availableAt, nowMs);
          const isDeferred = job.status === "queued" && retryIn != null;
          return (
            <AdminCard key={job.jobId} className="space-y-2 p-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">{job.agentId}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {job.workload} · {job.priority}
              </p>
              <p className="text-sm text-[var(--text-primary)]">
                {isDeferred ? "Deferred" : job.status}
              </p>
              {retryIn != null ? (
                <p className="text-sm text-[var(--text-secondary)]">Retry in {retryIn}s</p>
              ) : null}
              {job.deferReason ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Reason: {formatDeferReason(job.deferReason)}
                </p>
              ) : null}
              <p className="text-sm text-[var(--text-secondary)]">Attempts: {job.attempts}</p>
            </AdminCard>
          );
        })}
      </section>
    </>
  );
}

function SharedTelemetrySection({
  shared,
}: {
  shared: NonNullable<RuntimeStatusDto["shared"]>;
}) {
  if (!shared.available) {
    return (
      <AdminCard className="space-y-2 p-4 md:p-5">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Last 1h Runtime Activity
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Shared telemetry unavailable. Set{" "}
          <span className="font-mono text-xs">AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED=true</span> after
          applying the observability migration.
        </p>
      </AdminCard>
    );
  }

  const { lastHour, providerUsage, recentJobs } = shared;

  return (
    <AdminCard className="space-y-4 p-4 md:p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Last 1h Runtime Activity
        </h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Historical / Shared · PostgreSQL (cross-process Cron + Admin)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AdminSummaryCard title="Runtime Requests" value={lastHour.requests} />
        <AdminSummaryCard title="Completed" value={lastHour.completed} />
        <AdminSummaryCard title="Failed" value={lastHour.failed} />
        <AdminSummaryCard title="Fallbacks" value={lastHour.fallbacks} />
        <AdminSummaryCard title="Provider Calls" value={lastHour.providerCalls} />
      </div>

      {providerUsage.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Provider Usage
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {providerUsage.map((row) => (
              <AdminCard key={row.providerId} className="space-y-1 p-3">
                <p className="text-sm font-medium text-[var(--text-primary)]">{row.displayName}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  requests {row.requests} · tokens{" "}
                  {row.tokensKnown ? formatTokenCount(row.tokens) : "Unknown"} · errors {row.errors}
                  {row.usageMissingCount > 0 ? ` · usageMissing ${row.usageMissingCount}` : ""}
                </p>
              </AdminCard>
            ))}
          </div>
        </section>
      ) : null}

      {recentJobs.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">No shared runtime jobs in the last hour.</p>
      ) : (
        <>
          <section className="hidden overflow-x-auto lg:block">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Recent Runtime Jobs
            </p>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">Workload</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Provider/Model</th>
                  <th className="px-3 py-2">Fallback</th>
                  <th className="px-3 py-2">Correlation</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job, index) => (
                  <tr
                    key={`${job.jobId ?? job.requestId ?? "job"}-${index}`}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                      {new Date(job.occurredAt).toLocaleTimeString("ko-KR")}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {job.source ?? "—"}
                      {job.cronJobId ? (
                        <span className="block text-[10px] text-[var(--text-muted)]">
                          {job.cronJobId}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{job.agentId ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{job.workload ?? "—"}</td>
                    <td className="px-3 py-2 uppercase">{job.status ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {[job.providerId, job.modelId].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-3 py-2">{job.fallbackUsed ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-[var(--text-muted)]">
                      {job.correlationShort ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="space-y-3 lg:hidden">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Recent Runtime Jobs
            </p>
            {recentJobs.map((job, index) => (
              <AdminCard key={`${job.jobId ?? job.requestId ?? "m"}-${index}`} className="space-y-1 p-4">
                <p className="text-xs text-[var(--text-muted)]">
                  {job.source === "cron" ? "Marketing Cron" : job.source ?? "Runtime"}
                  {job.cronJobId ? ` · ${job.cronJobId}` : ""}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {job.agentId ?? "unknown-agent"}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {job.status ?? "—"}
                  {job.providerId ? ` · ${job.providerId}` : ""}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fallback: {job.fallbackUsed ? "Yes" : "No"}
                  {job.totalTokens != null ? ` · Tokens: ${job.totalTokens}` : ""}
                </p>
                {job.correlationShort ? (
                  <p className="font-mono text-[10px] text-[var(--text-muted)]">
                    {job.correlationShort}
                  </p>
                ) : null}
              </AdminCard>
            ))}
          </section>
        </>
      )}
    </AdminCard>
  );
}

export default function AiRuntimeConsole() {
  const [status, setStatus] = useState<RuntimeStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ai-runtime/status", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `상태 조회 실패 (${res.status})`);
      }
      const data = (await res.json()) as RuntimeStatusDto;
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 조회 중 오류가 발생했습니다.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text-primary)] sm:px-6 md:px-10 md:py-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">AI Runtime</h1>
          <p className="max-w-3xl text-sm text-[var(--text-secondary)]">
            Registry, Adapter, Credential 상태와 Usage Ledger 기반 quota snapshot을 확인합니다.
            Provider live 호출은 이 화면에서 수행하지 않으며, capacity unknown 시 health는 UNKNOWN으로
            표시됩니다.
          </p>
          {status?.generatedAt ? (
            <p className="text-xs text-[var(--text-muted)]">
              Snapshot: {new Date(status.generatedAt).toLocaleString("ko-KR")}
            </p>
          ) : null}
        </header>

        {loading ? (
          <AdminCard className="p-6 text-sm text-[var(--text-secondary)]">불러오는 중…</AdminCard>
        ) : null}

        {error ? (
          <AdminCard className="space-y-3 border-red-500/30 p-6">
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="min-h-[44px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
            >
              다시 시도
            </button>
          </AdminCard>
        ) : null}

        {status ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <AdminSummaryCard title="Enabled providers" value={status.summary.enabledProviders} />
              <AdminSummaryCard title="Disabled providers" value={status.summary.disabledProviders} />
              <AdminSummaryCard title="Registered models" value={status.summary.registeredModels} />
              <AdminSummaryCard title="Adapters ready" value={status.summary.adaptersReady} />
              <AdminSummaryCard
                title="Active reservations"
                value={status.summary.activeReservations}
              />
            </section>

            {status.shared ? <SharedTelemetrySection shared={status.shared} /> : null}

            {status.scheduler ? (
              <SchedulerSummarySection scheduler={status.scheduler} generatedAt={status.generatedAt} />
            ) : null}

            {status.routing ? (
              <>
                <RoutingSummarySection routing={status.routing} />
                {status.routingPolicies ? (
                  <RoutingPolicySection policies={status.routingPolicies} />
                ) : null}
                <RecentRoutingSection routing={status.routing} />
              </>
            ) : null}

            <section className="hidden overflow-x-auto lg:block">
              <AdminCard className="min-w-0 overflow-hidden">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Kind</th>
                      <th className="px-4 py-3">Enabled</th>
                      <th className="px-4 py-3">Adapter</th>
                      <th className="px-4 py-3">Credential</th>
                      <th className="px-4 py-3">Quota</th>
                      <th className="px-4 py-3">Models</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.providers.map((provider) => (
                      <tr key={provider.id} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">{provider.displayName}</div>
                          <div className="break-all font-mono text-xs text-[var(--text-muted)]">
                            {provider.id}
                          </div>
                          {provider.disabledReason ? (
                            <div className="mt-1 text-xs text-[var(--text-secondary)]">
                              {provider.disabledReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top uppercase">{provider.kind}</td>
                        <td className="px-4 py-3 align-top">
                          {provider.enabled ? "Enabled" : "Disabled"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {provider.adapterReadiness === "ready"
                            ? "Adapter Ready"
                            : "Adapter Unavailable"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {provider.credentialConfigured
                            ? "Configured"
                            : "Missing"}
                        </td>
                        <td className="px-4 py-3 align-top uppercase">
                          {!provider.enabled
                            ? "DISABLED"
                            : provider.quota?.health ?? "UNKNOWN"}
                        </td>
                        <td className="px-4 py-3 align-top">{provider.registeredModelCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminCard>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
              {status.providers.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
