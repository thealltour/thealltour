"use client";

import { useCallback, useEffect, useState } from "react";

import type { MarketingObservabilityAnalyticsDto } from "@/lib/marketing/observability/viewer/analytics/types";
import type { MarketingObsAnalyticsRange } from "@/lib/marketing/observability/viewer/analytics/range";
import { formatLiveDurationMs } from "@/lib/marketing/observability/viewer/live/duration";
import type { SampledRate } from "@/lib/marketing/observability/viewer/analytics/stats";
import { cn } from "@/lib/cn";

type Props = {
  className?: string;
};

function formatPct(rate: SampledRate | null | undefined): string {
  if (!rate || rate.rate == null || rate.denominator <= 0) return "—";
  if (rate.insufficient) return `${(rate.rate * 100).toFixed(0)}% · 데이터 부족`;
  return `${(rate.rate * 100).toFixed(1)}%`;
}

function formatSample(rate: SampledRate | null | undefined): string {
  if (!rate || rate.denominator <= 0) return "n=0";
  return `${rate.numerator} / ${rate.denominator}`;
}

function formatDuration(ms: number | null | undefined, sampleSize?: number, insufficient?: boolean): string {
  if (ms == null) return "—";
  const base = formatLiveDurationMs(ms);
  if (sampleSize != null && sampleSize > 0) {
    return insufficient ? `${base} · 데이터 부족 (n=${sampleSize})` : `${base} (n=${sampleSize})`;
  }
  return base;
}

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function MarketingObservabilityAnalyticsPanel({ className }: Props) {
  const [range, setRange] = useState<MarketingObsAnalyticsRange>("7d");
  const [data, setData] = useState<MarketingObservabilityAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextRange: MarketingObsAnalyticsRange) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-observability/analytics?range=${encodeURIComponent(nextRange)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `analytics_failed_${res.status}`);
      }
      setData((await res.json()) as MarketingObservabilityAnalyticsDto);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "analytics_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">누적 분석</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            OBS-6 · production traces only (fixture 제외) · DB 집계는 새로고침/기간 변경 시만
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-medium",
                range === r
                  ? "border-[var(--text)] bg-[var(--surface-muted)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
              )}
            >
              {r === "24h" ? "24시간" : r === "7d" ? "7일" : "30일"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load(range)}
            className="rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text)] hover:bg-[var(--surface-muted)]"
          >
            새로고침
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-[var(--text-secondary)]">분석 불러오는 중…</p>
      ) : error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : !data ? (
        <p className="text-sm text-[var(--text-secondary)]">분석 데이터가 없습니다</p>
      ) : (
        <>
          <OverviewSection data={data} />
          <BottleneckSection data={data} />
          <QualitySection data={data} />
          <ReliabilitySection data={data} />
          <DecisionSignalsSection data={data} />
          {data.excludedFixtureTraceCount > 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">
              fixture/smoke traces excluded: {data.excludedFixtureTraceCount}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{sub}</div> : null}
    </div>
  );
}

function OverviewSection({ data }: { data: MarketingObservabilityAnalyticsDto }) {
  const o = data.overview;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Overview</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Runs" value={String(o.totalRuns)} sub={`완 ${o.completed} · 실 ${o.failed} · 진 ${o.running}`} />
        <KpiCard label="Completion" value={formatPct(o.completionRate)} sub={formatSample(o.completionRate)} />
        <KpiCard
          label="Technical Failures"
          value={formatPct(o.technicalFailureRate)}
          sub={formatSample(o.technicalFailureRate)}
        />
        <KpiCard
          label="Median Duration"
          value={formatDuration(o.endToEndDuration.medianMs, o.endToEndDuration.sampleSize, o.endToEndDuration.insufficient)}
        />
        <KpiCard label="Revision Rate" value={formatPct(o.revisionRate)} sub={formatSample(o.revisionRate)} />
        <KpiCard
          label="First-pass Completeness"
          value={formatPct(o.firstPassCompleteness)}
          sub={formatSample(o.firstPassCompleteness)}
        />
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Partial {o.partial} · Stale running {o.staleRunning} · P95{" "}
        {formatDuration(o.endToEndDuration.p95Ms)}
      </p>
    </section>
  );
}

function BottleneckSection({ data }: { data: MarketingObservabilityAnalyticsDto }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Bottlenecks</h3>
      <div className="overflow-x-auto rounded border border-[var(--border)]">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Runs</th>
              <th className="px-3 py-2 font-medium">Median</th>
              <th className="px-3 py-2 font-medium">P95</th>
              <th className="px-3 py-2 font-medium">Error</th>
              <th className="px-3 py-2 font-medium">Revision</th>
              <th className="px-3 py-2 font-medium">Time %</th>
            </tr>
          </thead>
          <tbody>
            {data.stages.map((row) => (
              <tr key={row.stage} className="border-b border-[var(--border)] last:border-0">
                <td className="px-3 py-2 font-medium text-[var(--text)]">{row.label}</td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">{row.runCount}</td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">
                  {formatDuration(row.duration.medianMs, row.duration.sampleSize, row.duration.insufficient)}
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">
                  {formatDuration(row.duration.p95Ms)}
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">
                  {formatPct(row.technicalErrorRate)}
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">
                  {row.revisionRate ? formatPct(row.revisionRate) : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-[var(--text)]">
                  {row.timeContributionPct == null ? "—" : `${row.timeContributionPct.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">
        Time % = stage duration sum / sum of bottleneck stage durations (orchestration/nested tool spans 제외).
      </p>
    </section>
  );
}

function QualitySection({ data }: { data: MarketingObservabilityAnalyticsDto }) {
  const q = data.quality;
  const r = data.revision;
  const e = data.evidence;
  const g = data.governance;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Quality · Revision · Governance</h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded border border-[var(--border)] p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Completeness
          </h4>
          <MetricLine label="First-pass" value={formatPct(q.firstPassCompleteness)} sample={formatSample(q.firstPassCompleteness)} />
          <MetricLine label="Pass rate" value={formatPct(q.completenessPassRate)} sample={formatSample(q.completenessPassRate)} />
          <MetricLine label="Revision rate" value={formatPct(q.completenessRevisionRate)} sample={formatSample(q.completenessRevisionRate)} />
          <MetricLine
            label="Destination coverage"
            value={formatPct(q.destinationCoverageRatio)}
            sample={
              q.destinationCoverageSampleSize > 0
                ? `avg req ${formatNum(q.avgRequiredDestinations)} · covered ${formatNum(q.avgCoveredDestinations)} · n=${q.destinationCoverageSampleSize}`
                : "—"
            }
          />
          <MetricLine label="Missing destination incidents" value={String(q.missingDestinationIncidents)} />
          <MetricLine label="Required output failures" value={String(q.requiredOutputFailures)} />
          <MetricLine label="Source reference failures" value={String(q.sourceReferenceFailures)} />
        </div>
        <div className="space-y-2 rounded border border-[var(--border)] p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Revision
          </h4>
          <MetricLine label="Runs with revision" value={String(r.runsWithRevision)} sample={formatSample(r.revisionRate)} />
          <MetricLine label="Revision rate" value={formatPct(r.revisionRate)} />
          <MetricLine label="Completeness-triggered" value={String(r.completenessTriggered)} />
          <MetricLine label="Governance-triggered" value={String(r.governanceTriggered)} />
          <MetricLine label="CS attempt #2 rate" value={formatPct(r.csAttempt2Rate)} sample={formatSample(r.csAttempt2Rate)} />
          <MetricLine label="Revision exhausted" value={String(r.revisionExhausted)} />
          {r.topReasons.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
              {r.topReasons.slice(0, 5).map((row) => (
                <li key={row.key}>
                  {row.key}: {row.count}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Top reasons: —</p>
          )}
        </div>
        <div className="space-y-2 rounded border border-[var(--border)] p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Evidence · Governance
          </h4>
          <MetricLine
            label="Evidence metrics n"
            value={String(e.runsWithEvidenceMetrics)}
            sample={`avail=0: ${e.evidenceAvailableZero} · avail>0: ${e.evidenceAvailablePositive}`}
          />
          <MetricLine label="Avg available" value={formatNum(e.avgAvailable)} />
          <MetricLine label="Avg allowed" value={formatNum(e.avgAllowed)} />
          <MetricLine
            label="Avg coverage ratio"
            value={e.avgCoverageRatio == null ? "—" : formatNum(e.avgCoverageRatio, 3)}
            sample={e.coverageRatioSampleSize > 0 ? `n=${e.coverageRatioSampleSize}` : "—"}
          />
          <MetricLine label="No usable evidence" value={String(e.runsWithNoUsableEvidence)} />
          <MetricLine
            label="GA ALLOW / REVIEW / BLOCK"
            value={`${g.allow} / ${g.review} / ${g.block}`}
            sample={g.distributionSampleSize > 0 ? `n=${g.distributionSampleSize}` : "—"}
          />
          <MetricLine
            label="Avg risk score"
            value={formatNum(g.avgRiskScore, 2)}
            sample={g.riskScoreSampleSize > 0 ? `n=${g.riskScoreSampleSize}` : "—"}
          />
          <MetricLine label="GA technical failures" value={String(g.technicalGaFailures)} />
        </div>
      </div>
      <div className="rounded border border-[var(--border)] p-3 text-xs text-[var(--text-secondary)]">
        <div className="font-semibold text-[var(--text)]">Observed trace token usage</div>
        <p className="mt-1">{data.runtimeUsage.note}</p>
        <p className="mt-1 tabular-nums">
          input {data.runtimeUsage.totalInputTokens ?? "—"} · output{" "}
          {data.runtimeUsage.totalOutputTokens ?? "—"} · per completed{" "}
          {data.runtimeUsage.tokensPerCompletedRun == null
            ? "—"
            : formatNum(data.runtimeUsage.tokensPerCompletedRun, 0)}{" "}
          · spans {data.runtimeUsage.spansWithTokenUsage}
        </p>
        {!data.channel.available ? (
          <p className="mt-2">{data.channel.note}</p>
        ) : (
          <p className="mt-2">
            Channel:{" "}
            {data.channel.breakdown.map((c) => `${c.key}=${c.count}`).join(" · ") || "—"}
          </p>
        )}
      </div>
    </section>
  );
}

function ReliabilitySection({ data }: { data: MarketingObservabilityAnalyticsDto }) {
  const r = data.reliability;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Reliability</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Technical Failure Rate" value={formatPct(r.technicalFailureRate)} sub={formatSample(r.technicalFailureRate)} />
        <KpiCard label="Stale Running" value={String(r.staleRunning)} />
      </div>
      <div className="overflow-x-auto rounded border border-[var(--border)]">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-3 py-2 font-medium">Error class</th>
              <th className="px-3 py-2 font-medium">Count</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Last</th>
              <th className="px-3 py-2 font-medium">Summary</th>
            </tr>
          </thead>
          <tbody>
            {r.topErrors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-[var(--text-secondary)]">
                  기술 오류 없음
                </td>
              </tr>
            ) : (
              r.topErrors.map((row) => (
                <tr key={row.errorClass} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2 font-medium text-[var(--text)]">{row.errorClass}</td>
                  <td className="px-3 py-2 tabular-nums">{row.count}</td>
                  <td className="px-3 py-2">{row.affectedStage ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.lastOccurrenceAt
                      ? new Date(row.lastOccurrenceAt).toLocaleString("ko-KR", { hour12: false })
                      : "—"}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-[var(--text-secondary)]">
                    {row.sampleMessage ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DecisionSignalsSection({ data }: { data: MarketingObservabilityAnalyticsDto }) {
  const d = data.decisionSignals;
  return (
    <section className="space-y-2 rounded border border-[var(--border)] p-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Organization decision signals</h3>
      <p className="text-xs text-[var(--text-secondary)]">
        자동 추천이 아닙니다. 조직 개편 논의용 raw signals입니다.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <MetricLine label="CS revision rate" value={formatPct(d.csRevisionRate)} sample={formatSample(d.csRevisionRate)} />
        <MetricLine label="CS median duration" value={formatDuration(d.csMedianDurationMs)} />
        <MetricLine
          label="CS time share"
          value={d.csTimeSharePct == null ? "—" : `${d.csTimeSharePct.toFixed(1)}%`}
        />
        <MetricLine label="Completeness failure" value={formatPct(d.completenessFailureRate)} />
        <MetricLine label="No usable evidence" value={formatPct(d.evidenceNoUsableRate)} />
        <MetricLine label="GA review rate" value={formatPct(d.gaReviewRate)} />
        <MetricLine label="GA block rate" value={formatPct(d.gaBlockRate)} />
      </div>
    </section>
  );
}

function MetricLine({
  label,
  value,
  sample,
}: {
  label: string;
  value: string;
  sample?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-right">
        <span className="font-medium tabular-nums text-[var(--text)]">{value}</span>
        {sample ? <span className="ml-1 text-[var(--text-secondary)]">{sample}</span> : null}
      </span>
    </div>
  );
}
