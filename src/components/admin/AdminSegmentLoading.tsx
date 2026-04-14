/**
 * 관리자 라우트 세그먼트 `loading.tsx`용 공통 스켈레톤.
 */
export default function AdminSegmentLoading() {
  return (
    <div className="min-h-[50vh] space-y-4 px-6 py-10 text-[var(--text-primary)] md:px-10">
      <div className="h-9 w-48 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)] md:h-10 md:w-64" />
      <div className="h-4 w-full max-w-xl animate-pulse rounded bg-[var(--surface-muted)]" />
      <div className="h-72 w-full animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]" />
    </div>
  );
}
