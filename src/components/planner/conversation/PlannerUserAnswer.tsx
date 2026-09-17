"use client";

type PlannerUserAnswerProps = {
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
  disabled?: boolean;
};

/** Compact completed-answer row — lighter than current input/choice cards. */
export function PlannerUserAnswer({
  children,
  onEdit,
  editLabel = "수정",
  disabled,
}: PlannerUserAnswerProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-1 py-2.5">
      <p className="min-w-0 flex-1 type-small leading-relaxed text-[var(--foreground)]">
        {children}
      </p>
      {onEdit ? (
        <button
          type="button"
          className="shrink-0 type-caption font-semibold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
          onClick={onEdit}
          disabled={disabled}
        >
          {editLabel}
        </button>
      ) : null}
    </div>
  );
}
