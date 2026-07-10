"use client";

import { usePathname } from "next/navigation";
import MyPageSidebar from "@/components/mypage/MyPageSidebar";
import { MobileBackHeader } from "@/components/navigation/MobileBackHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import type { MyPageMemberSummary } from "@/lib/mypage/memberSummary";
import { cn } from "@/lib/cn";

type MyPageContentProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  memberSummary?: MyPageMemberSummary | null;
};

export default function MyPageContent({
  children,
  title,
  description,
  memberSummary,
}: MyPageContentProps) {
  const pathname = usePathname();
  const isDashboard = pathname === "/mypage/dashboard" || pathname === "/mypage";
  const showMobileBack = !isDashboard;

  return (
    <>
      {showMobileBack ? (
        <MobileBackHeader title={title} fallbackHref="/mypage/dashboard" />
      ) : null}
      <PageContainer
        size="reading"
        className="pb-[max(1.5rem,env(safe-area-inset-bottom))] py-6 sm:py-10"
      >
        <header className={cn("mb-6 space-y-2", showMobileBack && "hidden lg:block")}>
          <p className="section-label text-[var(--primary)]">THEALL TOUR MEMBERS</p>
          <h1 className="type-h2 text-[var(--text-primary)]">{title}</h1>
          {description ? <p className="text-sm text-[var(--text-muted)]">{description}</p> : null}
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <aside className="min-w-0 lg:w-[240px] lg:shrink-0">
            <MyPageSidebar showMobileBack={showMobileBack} memberSummary={memberSummary} />
          </aside>
          <section className="min-w-0 flex-1">{children}</section>
        </div>
      </PageContainer>
    </>
  );
}
