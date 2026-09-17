import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlannerResultLoader } from "@/components/planner/PlannerResultLoader";
import { assertFreeTravelPlannerEnabled } from "@/lib/planner/assertPlannerEnabled";
import { buildPlannerResultPageMetadata } from "@/lib/planner/plannerPageSeo";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Session id is unused for SEO — private results stay noindex with landing canonical. */
export async function generateMetadata({}: PageProps): Promise<Metadata> {
  return buildPlannerResultPageMetadata();
}

export default async function PlannerResultPage({ params }: PageProps) {
  assertFreeTravelPlannerEnabled();
  const { id } = await params;

  return (
    <>
      <SiteHeader hideMobileSearchRow />
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
