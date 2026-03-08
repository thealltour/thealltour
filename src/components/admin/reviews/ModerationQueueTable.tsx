"use client";

import Link from "next/link";
import type { ReviewModerationQueueItem } from "@/lib/reviewModerationQueue";

type ModerationQueueTableProps = {
  items: ReviewModerationQueueItem[];
  onActionDone?: () => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
};

function formatDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR");
}

const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

export function ModerationQueueTable({
  items,
  onActionDone,
  selectedIds = [],
  onSelectionChange,
}: ModerationQueueTableProps) {
  const set = new Set(selectedIds);
  const toggle = (id: string) => {
    if (!onSelectionChange) return;
    if (set.has(id)) {
      onSelectionChange(selectedIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };
  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (items.length === set.size) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map((i) => i.reviewId));
    }
  };
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-muted)]">
        현재 우선 검토가 필요한 리뷰가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
            {onSelectionChange && (
              <th className="w-10 px-2 py-2">
                <input
                  type="checkbox"
                  checked={items.length > 0 && set.size === items.length}
                  onChange={toggleAll}
                  className="rounded border-[var(--border)]"
                />
              </th>
            )}
            <th className="px-3 py-2 text-left font-medium">Priority</th>
            <th className="px-3 py-2 text-left font-medium">Review ID</th>
            <th className="px-3 py-2 text-left font-medium">Product</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Reports</th>
            <th className="px-3 py-2 text-left font-medium">Trust</th>
            <th className="px-3 py-2 text-left font-medium">Reasons</th>
            <th className="px-3 py-2 text-left font-medium">Created</th>
            <th className="px-3 py-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.reviewId} className="border-b border-[var(--border)]">
              {onSelectionChange && (
                <td className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={set.has(row.reviewId)}
                    onChange={() => toggle(row.reviewId)}
                    className="rounded border-[var(--border)]"
                  />
                </td>
              )}
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASS[row.priorityLevel] ?? ""}`}
                >
                  {row.priorityLevel}
                </span>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/reviews/${row.reviewId}`}
                  className="font-mono text-[var(--primary)] hover:underline"
                >
                  {row.reviewId.slice(0, 8)}…
                </Link>
              </td>
              <td className="px-3 py-2">
                {row.productId ? (
                  <Link
                    href={`/products/${row.productId}`}
                    className="text-[var(--text-muted)] hover:underline"
                  >
                    {row.productId.slice(0, 12)}…
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">{row.status}</td>
              <td className="px-3 py-2">{row.reportCount}</td>
              <td className="px-3 py-2">{row.trustScore ?? "—"}</td>
              <td className="max-w-[160px] truncate px-3 py-2 text-xs text-[var(--text-muted)]">
                {row.reasons.slice(0, 2).join(", ")}
              </td>
              <td className="px-3 py-2">{formatDate(row.createdAt)}</td>
              <td className="px-3 py-2">
                <Link
                  href={`/admin/reviews/moderation`}
                  className="text-[var(--primary)] hover:underline"
                >
                  처리
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
