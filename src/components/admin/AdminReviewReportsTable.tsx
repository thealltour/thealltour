"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminReviewReportRow } from "@/lib/adminReviewReports";

type Props = {
  reports: AdminReviewReportRow[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  resolved: "처리완료",
  dismissed: "무시",
};

export default function AdminReviewReportsTable({ reports: initialReports }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleHide(reviewId: string) {
    if (!confirm("이 리뷰를 숨김 처리하시겠습니까? 공개 목록에서 제거됩니다.")) return;
    setLoadingId(reviewId);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hide" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message ?? "숨김 처리에 실패했습니다.");
        return;
      }
      setReports((prev) =>
        prev.map((r) =>
          r.review_id === reviewId
            ? { ...r, review_status: "hidden" }
            : r,
        ),
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRestore(reviewId: string) {
    if (!confirm("이 리뷰를 다시 공개하시겠습니까?")) return;
    setLoadingId(reviewId);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message ?? "복구에 실패했습니다.");
        return;
      }
      setReports((prev) =>
        prev.map((r) =>
          r.review_id === reviewId
            ? { ...r, review_status: "submitted" }
            : r,
        ),
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDismiss(reportId: string) {
    setLoadingId(reportId);
    try {
      const res = await fetch(`/api/admin/review-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message ?? "신고 무시에 실패했습니다.");
        return;
      }
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "dismissed" } : r)),
      );
    } finally {
      setLoadingId(null);
    }
  }

  function formatDate(iso: string) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("ko-KR");
  }

  if (reports.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-muted)]">
        접수된 신고가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">리뷰 ID</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">리뷰 제목</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">신고자</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">사유</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">신고일</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">상태</th>
            <th className="px-4 py-3 text-left font-semibold text-[var(--text)]">액션</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]/50"
            >
              <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                <Link
                  href={`/reviews/${row.review_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand)] hover:underline"
                >
                  {row.review_id.slice(0, 8)}…
                </Link>
              </td>
              <td className="max-w-[200px] truncate px-4 py-3 text-[var(--text)]" title={row.review_title ?? ""}>
                {row.review_title ?? "-"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{row.member_id}</td>
              <td className="max-w-[180px] truncate px-4 py-3 text-[var(--text)]" title={row.reason}>
                {row.reason}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--text-muted)]">
                {formatDate(row.created_at)}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--surface-muted)] text-[var(--text)]">
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                {row.review_status === "hidden" && (
                  <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    숨김
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.review_status === "hidden" ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(row.review_id)}
                      disabled={loadingId !== null}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      복구
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleHide(row.review_id)}
                      disabled={loadingId !== null}
                      className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      리뷰 숨김
                    </button>
                  )}
                  {row.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => handleDismiss(row.id)}
                      disabled={loadingId !== null}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                    >
                      신고 무시
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
