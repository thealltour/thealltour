"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MarketingTeamSubnav } from "@/components/admin/ai-marketing/MarketingTeamSubnav";
import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";
import AdminCard from "@/components/admin/ui/AdminCard";
import type {
  DailyMarketingOperatingCycle,
  DailyMarketingOverallStatus,
  MarketingOperationsSummary,
} from "@/lib/marketing/operations/types";
import { cn } from "@/lib/cn";

type StatusTone = "success" | "warning" | "muted" | "danger";

function overallTone(status: DailyMarketingOverallStatus): StatusTone {
  switch (status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "action_required":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "muted";
  }
}

function StatusBadge({ label, tone = "muted" }: { label: string; tone?: StatusTone }) {
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

function StageRow({
  title,
  status,
  message,
}: {
  title: string;
  status: string;
  message: string;
}) {
  const tone: StatusTone =
    status === "healthy"
      ? "success"
      : status === "failed"
        ? "danger"
        : status === "action_required"
          ? "warning"
          : status === "pending"
            ? "muted"
            : "warning";

  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        <StatusBadge label={status} tone={tone} />
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}

export function MarketingOperationsPageBody({
  initialStatus,
  initialRecent,
  businessDateKst,
  initialLoadError = null,
}: {
  initialStatus: DailyMarketingOperatingCycle | null;
  initialRecent: MarketingOperationsSummary[];
  businessDateKst: string;
  initialLoadError?: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [recent, setRecent] = useState(initialRecent);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, recentRes] = await Promise.all([
        fetch(`/api/admin/marketing-operations?businessDate=${businessDateKst}`, { cache: "no-store" }),
        fetch("/api/admin/marketing-operations?days=7", { cache: "no-store" }),
      ]);
      if (!statusRes.ok || !recentRes.ok) {
        throw new Error("운영 상태를 불러오지 못했습니다.");
      }
      const statusJson = (await statusRes.json()) as { status: DailyMarketingOperatingCycle };
      const recentJson = (await recentRes.json()) as { summaries: MarketingOperationsSummary[] };
      setStatus(statusJson.status);
      setRecent(recentJson.summaries);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "refresh_failed");
    } finally {
      setLoading(false);
    }
  }, [businessDateKst]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            AI Marketing Team
          </p>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">오늘 운영</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            KST 영업일 {businessDateKst} · 읽기 전용 파이프라인 헬스
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          {loading ? "새로고침 중…" : "새로고침"}
        </button>
      </div>

      <MarketingTeamSubnav />

      {error ? (
        <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-red-500/40 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10"
          >
            다시 시도
          </button>
        </div>
      ) : null}

      {!status && !error ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--text-secondary)]">
          운영 상태를 불러오는 중…
        </div>
      ) : null}

      {status ? (
        <>
          <AdminSummaryCard title="오늘 전체 상태" value={status.overallStatus.toUpperCase()} />
          <p className="text-sm text-[var(--text-secondary)]">
            {status.actionRequiredReasons[0] ??
              "각 단계 메시지를 확인해 실패 지점과 다음 조치를 파악하세요."}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <StageRow
              title="08:30 Performance Analyst"
              status={status.performanceBrief.status}
              message={status.performanceBrief.message}
            />
            <StageRow title="Research" status={status.research.status} message={status.research.message} />
            <StageRow
              title="09:00 Marketing Run"
              status={status.marketingRun.status}
              message={status.marketingRun.message}
            />
            <StageRow
              title="Candidate"
              status={
                status.candidate.status
                  ? status.candidate.duplicateCount > 0
                    ? "failed"
                    : "healthy"
                  : "pending"
              }
              message={status.candidate.message}
            />
            <StageRow
              title="Governance"
              status={status.candidate.governanceDecision ? "healthy" : "pending"}
              message={
                status.candidate.governanceDecision
                  ? `Decision: ${status.candidate.governanceDecision}`
                  : "No governance decision recorded."
              }
            />
            <StageRow
              title="Human Review"
              status={status.humanReview.status ?? "not_applicable"}
              message={status.humanReview.message}
            />
            <StageRow
              title="Performance Feedback"
              status={status.feedback.performanceSignalsAvailable ? "healthy" : "degraded"}
              message={status.feedback.message}
            />
          </div>

          {status.actionRequiredReasons.length > 0 ? (
            <AdminCard className="p-4">
              <h2 className="mb-2 text-base font-semibold">조치 필요</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
                {status.actionRequiredReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/theall_manager_only/marketing-review"
                  className="text-[var(--accent)] hover:underline"
                >
                  제작·검토로 이동
                </Link>
                <Link
                  href="/theall_manager_only/marketing-observability"
                  className="text-[var(--accent)] hover:underline"
                >
                  조직 관제에서 실행 확인
                </Link>
              </div>
            </AdminCard>
          ) : null}

          {status.incident ? (
            <AdminCard className="p-4">
              <h2 className="mb-2 text-base font-semibold">Governance / 인시던트 트리아지</h2>
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <dt className="text-[var(--text-secondary)]">incidentClass</dt>
                  <dd className="font-mono text-xs">{status.incident.incidentClass}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">recoveryDisposition</dt>
                  <dd className="font-mono text-xs">{status.incident.recoveryDisposition}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">governanceDecision</dt>
                  <dd className="font-mono text-xs">{status.incident.governanceDecision ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-secondary)]">revisionAttempted</dt>
                  <dd className="font-mono text-xs">{status.incident.revisionAttempted ? "yes" : "no"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-[var(--text-secondary)]">concernSummary</dt>
                  <dd>{status.incident.concernSummary}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-[var(--text-secondary)]">recommendedOperatorAction</dt>
                  <dd>{status.incident.recommendedOperatorAction}</dd>
                </div>
                {status.incident.revisionOutcome ? (
                  <div>
                    <dt className="text-[var(--text-secondary)]">revisionOutcome</dt>
                    <dd className="font-mono text-xs">{status.incident.revisionOutcome}</dd>
                  </div>
                ) : null}
                {status.incident.priorIncidentCount > 0 ? (
                  <div>
                    <dt className="text-[var(--text-secondary)]">priorIncidentCount</dt>
                    <dd className="font-mono text-xs">{status.incident.priorIncidentCount}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {status.candidate.candidateId ? (
                  <Link
                    href={`/theall_manager_only/marketing-review/${status.candidate.candidateId}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    제작·검토 상세
                  </Link>
                ) : null}
                <Link
                  href="/theall_manager_only/marketing-observability"
                  className="text-[var(--accent)] hover:underline"
                >
                  조직 관제 Runs
                </Link>
              </div>
            </AdminCard>
          ) : null}

          <AdminCard className="p-4">
            <h2 className="mb-2 text-base font-semibold">추적 ID</h2>
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(status.trace).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-[var(--text-secondary)]">{key}</dt>
                  <dd className="break-all font-mono text-xs text-[var(--text-primary)]">
                    {Array.isArray(value) ? (value.length ? value.join(", ") : "—") : (value ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {status.candidate.candidateId ? (
                <Link
                  href={`/theall_manager_only/marketing-review/${status.candidate.candidateId}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  Human Review 상세 보기
                </Link>
              ) : null}
              <Link
                href="/theall_manager_only/marketing-observability"
                className="text-[var(--accent)] hover:underline"
              >
                조직 관제 열기
              </Link>
            </div>
          </AdminCard>

          <AdminCard className="p-4">
            <h2 className="mb-2 text-base font-semibold">최근 7일</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                    <th className="px-2 py-2">날짜</th>
                    <th className="px-2 py-2">전체</th>
                    <th className="px-2 py-2">Run</th>
                    <th className="px-2 py-2">Candidate</th>
                    <th className="px-2 py-2">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.businessDateKst} className="border-b border-[var(--border)]">
                      <td className="px-2 py-2">{row.businessDateKst}</td>
                      <td className="px-2 py-2">
                        <StatusBadge label={row.overallStatus} tone={overallTone(row.overallStatus)} />
                      </td>
                      <td className="px-2 py-2">{row.marketingRunStatus ?? "—"}</td>
                      <td className="px-2 py-2">{row.candidateStatus ?? "—"}</td>
                      <td className="px-2 py-2">{row.humanReviewStatus ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AdminCard>
        </>
      ) : null}
    </div>
  );
}
