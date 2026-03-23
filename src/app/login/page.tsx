import SiteHeader from "@/components/site-chrome/SiteHeader";
import MemberLoginForm from "@/components/auth/MemberLoginForm";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const rawNextPath = resolvedSearchParams.next ?? "/";
  const nextPath = rawNextPath.startsWith("/") ? rawNextPath : "/";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--card)] p-8 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] md:p-10">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold tracking-wide text-[var(--primary)]">THEALL TOUR MEMBERS</p>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">회원 로그인</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              여행후기 작성과 회원 전용 기능 이용을 위해 로그인해 주세요.
            </p>
          </div>
          <MemberLoginForm nextPath={nextPath} />
        </section>
      </main>
    </div>
  );
}
