"use client";

import type { ReviewModerationHistoryItem } from "@/types/reviewModerationHistory";

const ACTION_LABELS: Record<string, string> = {
  auto_flagged: "시스템 자동 신고됨",
  auto_under_review: "시스템 자동 검토 전환",
  auto_hidden: "시스템 자동 숨김",
  manually_hidden: "관리자 숨김",
  manually_restored: "관리자 복원",
  marked_under_review: "관리자 검토 전환",
  resolved: "관리자 해결",
};

type ReviewModerationHistoryListProps = {
  items: ReviewModerationHistoryItem[];
  maxItems?: number;
};

function formatDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR");
}

export function ReviewModerationHistoryList({
  items,
  maxItems = 10,
}: ReviewModerationHistoryListProps) {
  const list = items.slice(0, maxItems);
  if (list.length === 0) {
    return <p className="text-xs text-[var(--text-muted)]">이력이 없습니다.</p>;
  }
  return (
    <ul className="space-y-1 text-xs">
      {list.map((item) => (
        <li key={item.id} className="flex flex-wrap gap-2 text-[var(--text-secondary)]">
          <span>{formatDate(item.createdAt)}</span>
          <span className="font-medium">
            {ACTION_LABELS[item.actionType] ?? item.actionType}
          </span>
          {item.reason && <span className="text-[var(--text-muted)]">{item.reason}</span>}
        </li>
      ))}
    </ul>
  );
}
