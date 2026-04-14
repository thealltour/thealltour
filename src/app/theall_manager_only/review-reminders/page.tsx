"use client";

/**
 * PR13: 관리자 리뷰 리마인더 목록.
 * 필터: scheduled / sent / cancelled, 재발송·취소 버튼.
 */
import { useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  useAdminReviewRemindersQuery,
  useReviewReminderCancelMutation,
  useReviewReminderResendMutation,
} from "@/components/admin/reviews/useAdminReviewSummariesAndReminders";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "scheduled", label: "예약됨" },
  { value: "sent", label: "발송됨" },
  { value: "cancelled", label: "취소됨" },
];

function formatDate(s: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("ko-KR");
}

export default function AdminReviewRemindersPage() {
  const { showToast } = useAdminToast();
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isPending, isError, error, refetch } = useAdminReviewRemindersQuery(statusFilter);
  const cancelMut = useReviewReminderCancelMutation();
  const resendMut = useReviewReminderResendMutation();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const handleCancel = async (id: string) => {
    try {
      const msg = await cancelMut.mutateAsync(id);
      showToast("success", msg);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "취소에 실패했습니다.");
    }
  };

  const handleResend = async (id: string) => {
    try {
      const msg = await resendMut.mutateAsync(id);
      showToast("success", msg);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "재발송에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-[var(--text-muted)]">상태 필터</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-[var(--text-muted)]">총 {total}건</span>
        {isError ? (
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            다시 시도
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {isPending ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">로딩 중...</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            {error instanceof Error ? error.message : "불러오기에 실패했습니다."}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">리마인더가 없습니다.</div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="px-4 py-3 font-semibold text-[var(--text)]">eligibility_id</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">member_id</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">reminder_type</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">scheduled_at</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">sent_at</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">status</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">동작</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">
                    {r.eligibility_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{r.member_id ?? "—"}</td>
                  <td className="px-4 py-2">{r.reminder_type}</td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{formatDate(r.scheduled_at)}</td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{formatDate(r.sent_at)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.status === "scheduled"
                          ? "text-amber-600"
                          : r.status === "sent"
                            ? "text-green-600"
                            : "text-slate-500"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.status === "scheduled" && (
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={resendMut.isPending && resendMut.variables === r.id}
                          onClick={() => void handleResend(r.id)}
                          className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                        >
                          재발송
                        </button>
                        <button
                          type="button"
                          disabled={cancelMut.isPending && cancelMut.variables === r.id}
                          onClick={() => void handleCancel(r.id)}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          취소
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
