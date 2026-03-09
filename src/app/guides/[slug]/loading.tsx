import { PageContainer } from "@/components/layout/PageContainer";

export default function GuideDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)]">
      <div className="h-14 shrink-0 bg-[var(--surface)]" />
      <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
        <PageContainer size="wide" className="flex flex-col gap-8">
          <div className="h-[280px] animate-pulse rounded-2xl bg-[var(--surface-muted)] sm:rounded-3xl" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
              />
            ))}
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
