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
        className="rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
      >
        Mark Under Review
      </button>
      <button
        type="button"
        onClick={() => run("hide")}
        disabled={!!loading}
        className="rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
      >
        Hide Selected
      </button>
      <button
        type="button"
        onClick={() => run("restore")}
        disabled={!!loading}
        className="rounded border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium hover:bg-green-100 disabled:opacity-50"
      >
        Restore Selected
      </button>
      <button
        type="button"
        onClick={() => run("resolve")}
        disabled={!!loading}
        className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
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
