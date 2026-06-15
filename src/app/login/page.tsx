import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import AuthPageAutoOpen from "@/components/auth/AuthPageAutoOpen";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      <Suspense fallback={null}>
        <AuthPageAutoOpen mode="login" />
      </Suspense>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 md:px-10">
        <p className="text-center text-sm text-[var(--text-secondary)]">
          로그인 창이 열리지 않으면 상단 메뉴의 로그인을 눌러 주세요.
        </p>
      </main>
    </div>
  );
}
