import { PageContainer } from "@/components/layout/PageContainer";

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--border)] ${className ?? ""}`} aria-hidden />;
}

/**
 * Product Detail segment loading — Early Decision Zone 위주 lightweight shell.
 */
export default function ProductDetailLoading() {
  return (
    <div
      className="min-h-[50vh] bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] py-6 sm:py-10"
      role="status"
      aria-live="polite"
      aria-label="상품 상세를 불러오는 중"
    >
      <PageContainer size="wide" className="flex flex-col gap-4 lg:gap-8">
        <Pulse className="h-4 w-48" />

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22.5rem)] lg:gap-8">
          <div className="space-y-4">
            <div className="space-y-2" aria-hidden>
              <Pulse className="h-8 w-4/5 max-w-md" />
              <Pulse className="h-4 w-40" />
              <Pulse className="h-6 w-32" />
            </div>

            <Pulse className="aspect-[16/10] w-full rounded-2xl" />

            <div className="space-y-2" aria-hidden>
              <Pulse className="h-4 w-full" />
              <Pulse className="h-4 w-5/6" />
              <Pulse className="h-4 w-2/3" />
            </div>

            <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
              <Pulse className="h-16 rounded-xl" />
              <Pulse className="h-16 rounded-xl" />
            </div>
          </div>

          <div className="hidden space-y-3 lg:block" aria-hidden>
            <Pulse className="h-40 w-full rounded-2xl" />
            <Pulse className="h-11 w-full rounded-xl" />
            <Pulse className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
