"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSummaryCard from "@/components/admin/ui/AdminSummaryCard";
import AdminCard from "@/components/admin/ui/AdminCard";
import type { HumanReviewQueueFilter } from "@/lib/marketing/review/types";
import type {
  MorningReviewQueueRow,
  MorningReviewQueueSummary,
  MorningReviewWorkflowState,
} from "@/lib/marketing/review/morningReview/types";
import { cn } from "@/lib/cn";

const FILTERS: Array<{ id: HumanReviewQueueFilter; label: string }> = [
  { id: "today", label: "오늘" },
  { id: "pending", label: "검토 대기" },
  { id: "needs_review", label: "거버넌스 주의" },
  { id: "approved", label: "수동 게시 승인" },
  { id: "deferred", label: "보류" },
  { id: "manually_published", label: "수동 게시 완료" },
  { id: "blocked_failed", label: "차단/실패" },
  { id: "all", label: "전체" },
];

function statusBadge(label: string, tone: "success" | "warning" | "danger" | "muted") {
  const toneClass = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-800",
    danger: "border-red-500/30 bg-red-500/10 text-red-700",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  }[tone];
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", toneClass)}>
      {label}
    </span>
  );
}

function candidateTone(status: MorningReviewQueueRow["candidateStatus"]) {
  if (status === "ready_for_human_review") return "success" as const;
  if (status === "needs_human_review") return "warning" as const;
  if (status === "blocked" || status === "failed") return "danger" as const;
  return "muted" as const;
}

function workflowTone(state: MorningReviewWorkflowState) {
  if (state === "missing") return "danger" as const;
  if (state === "pending" || state === "editing") return "warning" as const;
  if (state === "approved" || state === "published") return "success" as const;
  return "muted" as const;
}

function governanceTone(decision: string | null) {
  if (decision === "REVIEW") return "warning" as const;
  if (decision === "BLOCK") return "danger" as const;
  return "muted" as const;
}

type Props = {
  initialSummary: MorningReviewQueueSummary;
  unreadNotificationCount: number;
};

export function MarketingReviewPageBody({ initialSummary, unreadNotificationCount }: Props) {
  const [filter, setFilter] = useState<HumanReviewQueueFilter>("today");
  const [summary, setSummary] = useState(initialSummary);
  const { items, todayCandidate, pendingCount } = summary;

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    const todayKst = todayCandidate?.businessDateKst;
    return items.filter((item) => {
      switch (filter) {
        case "today":
          return todayKst ? item.businessDateKst === todayKst : false;
        case "pending":
          return (
            item.reviewWorkflowState === "pending" ||
            item.reviewWorkflowState === "editing" ||
            item.reviewWorkflowState === "missing"
          );
        case "needs_review":
          return item.candidateStatus === "needs_human_review" || item.governanceDecision === "REVIEW";
        case "approved":
          return item.reviewWorkflowState === "approved";
        case "deferred":
          return item.reviewWorkflowState === "deferred";
        case "manually_published":
          return item.reviewWorkflowState === "published";
        case "blocked_failed":
          return item.candidateStatus === "blocked" || item.candidateStatus === "failed";
        default:
          return true;
      }
    });
  }, [filter, items, todayCandidate?.businessDateKst]);

  async function reload() {
    const res = await fetch(`/api/admin/marketing-review?filter=all`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as MorningReviewQueueSummary;
    setSummary(data);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 text-[var(--text-primary)] md:px-8">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="AI 마케팅 검토"
          description="09:00 자율 파이프라인이 생성한 CompletedMarketingCandidate를 검토합니다. 승인은 수동 게시 준비만 의미하며 자동 SNS 게시는 없습니다."
          unreadNotificationCount={unreadNotificationCount}
        />

        {todayCandidate ? (
          <AdminCard
            className={cn(
              "p-4",
              todayCandidate.reviewWorkflowState === "missing"
                ? "border-red-500/30 bg-red-500/5"
                : "border-emerald-500/30 bg-emerald-500/5",
            )}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    todayCandidate.reviewWorkflowState === "missing" ? "text-red-800" : "text-emerald-800",
                  )}
                >
                  {todayCandidate.reviewWorkflowState === "missing"
                    ? "오늘 후보는 있으나 HumanMarketingReview 레코드가 누락되었습니다"
                    : "오늘의 AI 마케팅 작업이 준비되었습니다"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {todayCandidate.title} · {todayCandidate.channel}
                  {todayCandidate.formatLabel ? ` / ${todayCandidate.formatLabel}` : ""} · 거버넌스{" "}
                  {todayCandidate.governanceDecision ?? "—"} · {todayCandidate.actionLabel}
                </p>
                {todayCandidate.operationalMessage ? (
                  <p className="mt-1 text-xs text-red-700">{todayCandidate.operationalMessage}</p>
                ) : null}
              </div>
              <Link
                href={`/theall_manager_only/marketing-review/${encodeURIComponent(todayCandidate.candidateId)}`}
                className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white"
              >
                검토 열기
              </Link>
            </div>
          </AdminCard>
        ) : (
          <AdminCard className="p-4 text-sm text-[var(--text-secondary)]">
            오늘(KST) 생성된 CompletedMarketingCandidate가 아직 없습니다.
          </AdminCard>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <AdminSummaryCard title="검토 필요" value={String(pendingCount)} />
          <AdminSummaryCard title="큐 항목" value={String(items.length)} />
          <AdminSummaryCard title="오늘 후보" value={todayCandidate ? "1" : "0"} />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm",
                filter === item.id
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]",
              )}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)]"
          >
            새로고침
          </button>
        </div>

        <AdminCard className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3">주제</th>
                  <th className="px-4 py-3">형식/채널</th>
                  <th className="px-4 py-3">거버넌스</th>
                  <th className="px-4 py-3">인간 검토</th>
                  <th className="px-4 py-3">액션</th>
                  <th className="px-4 py-3">열기</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      표시할 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.candidateId} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.businessDateKst}
                        {item.isToday ? (
                          <span className="ml-2 text-xs text-emerald-700">오늘</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {item.productLinked ? "상품 연계" : "정보성/상품 무관"}
                          {item.humanEditedAfterGovernance ? " · governance stale" : ""}
                          {item.operationalIssue ? " · 운영 확인" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.channel}
                        {item.formatLabel ? ` / ${item.formatLabel}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(item.governanceDecision ?? "—", governanceTone(item.governanceDecision))}
                      </td>
                      <td className="px-4 py-3">
                        {statusBadge(item.actionLabel, workflowTone(item.reviewWorkflowState))}
                      </td>
                      <td className="px-4 py-3">
                        {item.actionNeeded ? (
                          <span className="text-xs font-medium text-amber-800">조치 필요</span>
                        ) : (
                          <span className="text-xs text-[var(--text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/theall_manager_only/marketing-review/${encodeURIComponent(item.candidateId)}`}
                          className="text-[var(--primary)] underline-offset-2 hover:underline"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </main>
    </div>
  );
}
