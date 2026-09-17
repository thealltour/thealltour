import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PlannerLandingIntro } from "@/components/planner/PlannerLandingIntro";
import { PlannerLandingInfo } from "@/components/planner/PlannerLandingInfo";
import { PlannerWizard } from "@/components/planner/PlannerWizard";
import { assertFreeTravelPlannerEnabled } from "@/lib/planner/assertPlannerEnabled";
import { isPlannerQaModeEnabled } from "@/lib/planner/qaMode";
import { buildPlannerLandingPageMetadata } from "@/lib/planner/plannerPageSeo";

export const metadata: Metadata = buildPlannerLandingPageMetadata();

export default function PlannerPage() {
  assertFreeTravelPlannerEnabled();
  const qaEnabled = isPlannerQaModeEnabled();

  return (
    <>
      <SiteHeader hideMobileSearchRow />
      <div className="min-h-screen page-bg-wash">
        <PageContainer size="reading" className="pb-4 pt-2 sm:pt-4">
          <main id="main-content" tabIndex={-1}>
            <PlannerLandingIntro />
            <Suspense fallback={<div className="min-h-[12rem]" aria-hidden />}>
              <PlannerWizard qaEnabled={qaEnabled} />
            </Suspense>
            <PlannerLandingInfo />
          </main>
        </PageContainer>
      </div>
    </>
  );
}
