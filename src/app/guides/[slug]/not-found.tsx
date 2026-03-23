import Link from "next/link";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";

export default function GuideNotFound() {
  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
      <SiteHeader />
      <main className="flex w-full flex-col items-center justify-center py-20">
        <PageContainer size="default" className="text-center">
          <h1 className="type-h2 font-semibold text-[var(--foreground)]">
            가이드를 찾을 수 없습니다
          </h1>
          <p className="mt-2 type-body text-[var(--text-muted)]">
            요청하신 여행 가이드가 없거나 비공개 상태입니다.
          </p>
          <Link
            href="/blog"
            className={cn(
              "mt-6 inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90",
              solidButtonShadowClasses,
            )}
          >
            여행가이드 목록으로
          </Link>
        </PageContainer>
      </main>
    </div>
  );
}
