import SiteHeader from "@/components/SiteHeader";
import MyPageSidebar from "@/components/mypage/MyPageSidebar";

type MyPageLayoutProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
};

export default function MyPageLayout({ children, title, description }: MyPageLayoutProps) {
  return (
    <div className="min-h-screen bg-site-bg text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 md:py-8">
        <header className="mb-6 rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-5">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p> : null}
        </header>

        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <aside className="rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-3 lg:w-[260px] lg:shrink-0">
            <MyPageSidebar />
          </aside>
          <section className="min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 sm:rounded-xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:p-5">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
