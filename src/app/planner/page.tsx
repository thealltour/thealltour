import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlannerEntry } from "@/components/planner/PlannerEntry";
import { assertFreeTravelPlannerEnabled } from "@/lib/planner/assertPlannerEnabled";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";

export const metadata: Metadata = buildOgBrandFallbackMetadata({
  canonicalPath: "/planner",
  documentTitle: "자유여행 플래너 | 더올투어",
  description:
    "가고 싶은 곳과 여행 조건을 알려주시면 더올투어가 자유여행 계획을 함께 만들어드립니다.",
  ogImageAlt: "자유여행 플래너",
  openGraphType: "website",
  useAbsolutePageTitle: true,
});

export default function PlannerPage() {
  assertFreeTravelPlannerEnabled();

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen page-bg-wash">
        <PageContainer size="reading" className="pb-16 pt-2 sm:pt-4">
          <main id="main-content" tabIndex={-1}>
            <Suspense fallback={<div className="min-h-[12rem]" aria-hidden />}>
              <PlannerEntry />
            </Suspense>
          </main>
        </PageContainer>
      </div>
    </>
  );
}
