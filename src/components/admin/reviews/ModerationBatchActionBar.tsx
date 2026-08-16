"use client";

import { useState } from "react";

type ModerationBatchActionBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
  onBatchAction: (
    action: string,
    ids: string[],
  ) => Promise<{ successIds: string[]; failedIds: string[] }>;
  onActionDone?: () => void;
};

export function ModerationBatchActionBar({
  selectedIds,
  onClearSelection,
  onBatchAction,
  onActionDone,
}: ModerationBatchActionBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function run(action: string) {
    if (selectedIds.length === 0) return;
    setLoading(action);
    try {
      const res = await onBatchAction(action, selectedIds);
      if (res.failedIds.length > 0) {
        alert(`${res.successIds.length}건 처리됨. 실패: ${res.failedIds.length}건`);
      }
      onActionDone?.();
      onClearSelection();
    } finally {
      setLoading(null);
    }
  }

  if (selectedIds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {selectedIds.length}개 선택됨
      </span>
      <button
        type="button"
        onClick={() => run("under_review")}
        disabled={!!loading}
        className="rounded border border-[var(--warning)]/50 bg-[var(--warning-bg)] px-3 py-1.5 text-xs font-medium text-[var(--warning)] hover:opacity-90 disabled:opacity-50"
      >
        Mark Under Review
      </button>
      <button
        type="button"
        onClick={() => run("hide")}
        disabled={!!loading}
        className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface)] disabled:opacity-50"
      >
        Hide Selected
      </button>
      <button
        type="button"
        onClick={() => run("restore")}
        disabled={!!loading}
        className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
      >
        Restore Selected
      </button>
      <button
        type="button"
        onClick={() => run("resolve")}
        disabled={!!loading}
        className="rounded border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:opacity-90 disabled:opacity-50"
      >
        Resolve Selected
      </button>
      <button
        type="button"
        onClick={onClearSelection}
        className="rounded border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
      >
        선택 해제
      </button>
    </div>
  );
}
