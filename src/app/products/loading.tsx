import { PageContainer } from "@/components/layout/PageContainer";

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--border)] ${className ?? ""}`} aria-hidden />;
}

function ProductRowSkeleton() {
  return (
    <div
      className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:gap-4 sm:p-4"
      aria-hidden
    >
      <Pulse className="h-28 w-28 shrink-0 rounded-xl sm:h-32 sm:w-40" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
        <Pulse className="h-4 w-3/4" />
        <Pulse className="h-3 w-1/2" />
        <Pulse className="mt-auto h-5 w-24" />
      </div>
    </div>
  );
}

/**
 * /products segment loading — Header는 layout/page 쪽 SiteHeader를 중복 렌더하지 않음.
 */
export default function ProductsLoading() {
  return (
    <div
      className="min-h-[50vh] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] py-6 sm:py-10"
      role="status"
      aria-live="polite"
      aria-label="여행 상품을 불러오는 중"
    >
      <PageContainer size="wide" className="flex flex-col gap-4 lg:gap-6">
        <div className="space-y-2" aria-hidden>
          <Pulse className="h-4 w-40" />
          <Pulse className="h-7 w-28" />
        </div>

        <div
          className="flex flex-col gap-2 rounded-xl border-b border-[var(--border)]/40 py-2"
          aria-hidden
        >
          <div className="flex gap-2 overflow-hidden lg:hidden">
            <Pulse className="h-8 w-14 shrink-0 rounded-full" />
            <Pulse className="h-8 w-16 shrink-0 rounded-full" />
            <Pulse className="h-8 w-16 shrink-0 rounded-full" />
            <Pulse className="h-8 w-16 shrink-0 rounded-full" />
          </div>
          <div className="flex gap-2 lg:hidden">
            <Pulse className="h-11 flex-1 rounded-xl" />
            <Pulse className="h-11 flex-1 rounded-xl" />
          </div>
          <div className="hidden items-center justify-between lg:flex">
            <div className="flex gap-2">
              <Pulse className="h-10 w-20 rounded-full" />
              <Pulse className="h-10 w-24 rounded-full" />
              <Pulse className="h-10 w-24 rounded-full" />
            </div>
            <Pulse className="h-10 w-48 rounded-lg" />
          </div>
        </div>

        <div
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/98 px-3 py-2.5"
          aria-hidden
        >
          <Pulse className="h-3 w-36" />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Pulse className="h-8 w-12 rounded-full" />
            <Pulse className="h-8 w-14 rounded-full" />
            <Pulse className="h-8 w-20 rounded-full" />
            <Pulse className="h-8 w-16 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pulse className="h-7 w-12 rounded-full" />
            <Pulse className="h-7 w-20 rounded-full" />
          </div>
        </div>

        <div className="flex flex-col gap-4" aria-hidden>
          <ProductRowSkeleton />
          <ProductRowSkeleton />
          <ProductRowSkeleton />
        </div>
      </PageContainer>
    </div>
  );
}
