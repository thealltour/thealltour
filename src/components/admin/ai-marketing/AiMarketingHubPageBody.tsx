"use client";

import Link from "next/link";
import { MarketingTeamSubnav } from "@/components/admin/ai-marketing/MarketingTeamSubnav";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";
import { AI_MARKETING_TEAM_NAV } from "@/lib/adminNav/aiMarketingTeam";
import type { DailyMarketingOperatingCycle } from "@/lib/marketing/operations/types";
import type { MorningReviewQueueSummary } from "@/lib/marketing/review/morningReview/types";
import { cn } from "@/lib/cn";

export type AiMarketingHubSnapshot = {
  businessDateKst: string;
  trendNewCount: number | null;
  reviewPendingCount: number | null;
  todayCandidateTitle: string | null;
  todayCandidateId: string | null;
  operationsOverall: DailyMarketingOperatingCycle["overallStatus"] | null;
  operationsAction: string | null;
  runningTraceCount: number;
  recentFailedTraceCount: number;
  loadErrors: string[];
};

type Props = {
  snapshot: AiMarketingHubSnapshot;
};

function overallLabel(status: DailyMarketingOperatingCycle["overallStatus"] | null): string {
  if (!status) return "—";
  switch (status) {
    case "healthy":
      return "정상";
    case "degraded":
      return "주의";
    case "action_required":
      return "조치 필요";
    case "failed":
      return "실패";
    default:
      return status;
  }
}

function overallTone(
  status: DailyMarketingOperatingCycle["overallStatus"] | null,
): "success" | "warning" | "danger" | "muted" {
  if (status === "healthy") return "success";
  if (status === "failed") return "danger";
  if (status === "degraded" || status === "action_required") return "warning";
  return "muted";
}

export function AiMarketingHubPageBody({ snapshot }: Props) {
  const toneClass = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    danger: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  }[overallTone(snapshot.operationsOverall)];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          AI Marketing Team
        </p>
        <h1 className="text-xl font-semibold text-[var(--text)]">오늘</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          KST {snapshot.businessDateKst} · 트렌드 → 제작·검토 → 운영 점검 순으로 진행하세요
        </p>
      </div>

      <MarketingTeamSubnav />

      {snapshot.loadErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          일부 요약 로드 실패: {snapshot.loadErrors.join(" · ")}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminSummaryCard
          title="트렌드 NEW"
          value={snapshot.trendNewCount == null ? "—" : String(snapshot.trendNewCount)}
        />
        <AdminSummaryCard
          title="검토 대기"
          value={snapshot.reviewPendingCount == null ? "—" : String(snapshot.reviewPendingCount)}
        />
        <AdminSummaryCard title="오늘 운영" value={overallLabel(snapshot.operationsOverall)} />
        <AdminSummaryCard
          title="실행 중 / 최근 실패"
          value={`${snapshot.runningTraceCount} / ${snapshot.recentFailedTraceCount}`}
        />
      </div>

      <AdminCard className="p-4">
        <h2 className="text-base font-semibold text-[var(--text)]">오늘 할 일</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-[var(--text-secondary)]">
          <li>
            <Link href={AI_MARKETING_TEAM_NAV[1]!.href} className="font-medium text-[var(--text)] hover:underline">
              트렌드 인입
            </Link>
            {snapshot.trendNewCount != null && snapshot.trendNewCount > 0
              ? ` — NEW ${snapshot.trendNewCount}건 대기`
              : " — 새 신호 확인"}
          </li>
          <li>
            <Link href={AI_MARKETING_TEAM_NAV[2]!.href} className="font-medium text-[var(--text)] hover:underline">
              제작·검토
            </Link>
            {snapshot.todayCandidateTitle
              ? ` — 오늘 후보: ${snapshot.todayCandidateTitle}`
              : snapshot.reviewPendingCount
                ? ` — 검토 대기 ${snapshot.reviewPendingCount}건`
                : " — 아젠다 선택 · 제작 요청 · 승인"}
            {snapshot.todayCandidateId ? (
              <>
                {" "}
                <Link
                  href={`/theall_manager_only/marketing-review/${snapshot.todayCandidateId}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  상세
                </Link>
              </>
            ) : null}
          </li>
          <li>
            <Link href={AI_MARKETING_TEAM_NAV[3]!.href} className="font-medium text-[var(--text)] hover:underline">
              오늘 운영
            </Link>
            <span className={cn("ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", toneClass)}>
              {overallLabel(snapshot.operationsOverall)}
            </span>
            {snapshot.operationsAction ? ` — ${snapshot.operationsAction}` : null}
          </li>
          {(snapshot.runningTraceCount > 0 || snapshot.recentFailedTraceCount > 0) && (
            <li>
              <Link
                href={AI_MARKETING_TEAM_NAV[4]!.href}
                className="font-medium text-[var(--text)] hover:underline"
              >
                조직 관제
              </Link>
              {" — "}
              {snapshot.runningTraceCount > 0
                ? `RUNNING ${snapshot.runningTraceCount}`
                : `최근 실패 ${snapshot.recentFailedTraceCount}`}
            </li>
          )}
        </ol>
      </AdminCard>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {AI_MARKETING_TEAM_NAV.filter((item) => item.id !== "hub").map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-muted)]"
          >
            <div className="text-sm font-semibold text-[var(--text)]">{item.label}</div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Helper for server page to shape morning queue into hub fields. */
export function hubFieldsFromReviewQueue(queue: MorningReviewQueueSummary | null): {
  reviewPendingCount: number | null;
  todayCandidateTitle: string | null;
  todayCandidateId: string | null;
} {
  if (!queue) {
    return { reviewPendingCount: null, todayCandidateTitle: null, todayCandidateId: null };
  }
  return {
    reviewPendingCount: queue.pendingCount,
    todayCandidateTitle: queue.todayCandidate?.title ?? null,
    todayCandidateId: queue.todayCandidate?.candidateId ?? null,
  };
}
