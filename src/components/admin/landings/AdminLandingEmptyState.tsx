type AdminLandingEmptyStateProps = {
  title: string;
  description: string;
  retryLabel?: string;
  createLabel?: string;
  onRetry?: () => void;
  onCreate?: () => void;
};

export default function AdminLandingEmptyState({
  title,
  description,
  retryLabel,
  createLabel,
  onRetry,
  onCreate,
}: AdminLandingEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center">
      <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
      {(onRetry || onCreate) ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface)]"
            >
              {retryLabel ?? "다시 시도"}
            </button>
          ) : null}
          {onCreate ? (
            <button
              type="button"
              onClick={onCreate}
              className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
            >
              {createLabel ?? "랜딩 생성"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
