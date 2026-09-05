import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlannerSavedListView } from "@/components/planner/PlannerSavedListView";
import { assertFreeTravelPlannerEnabled } from "@/lib/planner/assertPlannerEnabled";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";

export const metadata: Metadata = buildOgBrandFallbackMetadata({
  canonicalPath: "/planner/my",
  documentTitle: "내 여행 플랜 | 더올투어",
  description: "저장한 자유여행 계획을 다시 확인해보세요.",
  ogImageAlt: "내 여행 플랜",
  openGraphType: "website",
  useAbsolutePageTitle: true,
});

export default function PlannerSavedListPage() {
  assertFreeTravelPlannerEnabled();

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen page-bg-wash">
        <PageContainer size="reading" className="pb-10 pt-2 sm:pt-4">
          <main id="main-content" tabIndex={-1}>
            <Suspense
              fallback={
                <div className="px-4 py-16 text-center type-body text-[var(--text-muted)]">
                  불러오는 중…
                </div>
              }
            >
              <PlannerSavedListView />
            </Suspense>
          </main>
        </PageContainer>
      </div>
    </>
  );
}
