import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import AuthPageAutoOpen from "@/components/auth/AuthPageAutoOpen";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader activeTab="signup" />
      <Suspense fallback={null}>
        <AuthPageAutoOpen mode="signup" />
      </Suspense>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12 md:px-10">
        <p className="text-center text-sm text-[var(--text-secondary)]">
          회원가입 창이 열리지 않으면 상단 메뉴의 회원가입을 눌러 주세요.
        </p>
      </main>
    </div>
  );
}
