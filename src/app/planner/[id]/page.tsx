import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlannerResultLoader } from "@/components/planner/PlannerResultLoader";
import { assertFreeTravelPlannerEnabled } from "@/lib/planner/assertPlannerEnabled";
import { buildOgBrandFallbackMetadata } from "@/lib/seo/buildOgPageMetadata";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return buildOgBrandFallbackMetadata({
    canonicalPath: `/planner/${id}`,
    documentTitle: "나의 자유여행 플랜 | 더올투어",
    description: "입력하신 조건으로 만든 자유여행 일정 초안입니다.",
    ogImageAlt: "자유여행 플랜",
    openGraphType: "website",
    useAbsolutePageTitle: true,
  });
}

export default async function PlannerResultPage({ params }: PageProps) {
  assertFreeTravelPlannerEnabled();
  const { id } = await params;

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
              <PlannerResultLoader sessionId={id} />
            </Suspense>
          </main>
        </PageContainer>
      </div>
    </>
  );
}
