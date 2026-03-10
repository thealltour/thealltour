import { PageContainer } from "@/components/layout/PageContainer";
import SiteHeader from "@/components/SiteHeader";

export default function SearchLoading() {
  return (
    <>
      <SiteHeader />
    <div className="min-h-screen bg-[var(--theall-page-bg)] py-6 sm:py-10 md:py-14">
      <PageContainer size="wide" className="flex flex-col gap-6">
        <div className="h-9 w-64 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-5 w-48 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-12 w-full max-w-md animate-pulse rounded-xl bg-[var(--border)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]"
            >
              <div className="aspect-[16/10] w-full animate-pulse bg-[var(--surface-muted)]" />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="h-4 w-full animate-pulse rounded bg-[var(--border)]" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--border)]" />
                <div className="mt-2 h-5 w-24 animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-9 w-full max-w-md animate-pulse rounded-lg bg-[var(--border)]" aria-hidden />
      </PageContainer>
    </div>
    </>
  );
}
