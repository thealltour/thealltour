import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { isPlannerSessionId } from "@/lib/auth/oauthAction";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getPlannerSessionById } from "@/lib/planner/repository";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import AlertCard from "@/components/ui/AlertCard";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Auth gateway for Kakao memo deep links.
 * Never returns planner plan/json — ownership check only, then redirect.
 */
export default async function PlannerOpenGatewayPage({ params }: PageProps) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) {
    notFound();
  }

  const { id: rawId } = await params;
  const sessionId = rawId?.trim() ?? "";
  if (!isPlannerSessionId(sessionId)) {
    notFound();
  }

  const cookieStore = await cookies();
  const memberSession = getMemberSessionFromCookies(cookieStore);

  if (!memberSession?.memberId) {
    const next = `/planner/${sessionId}`;
    redirect(`/api/auth/kakao/start?mode=login&next=${encodeURIComponent(next)}`);
  }

  const session = await getPlannerSessionById(sessionId);
  // Do not distinguish not-found vs forbidden in copy (enumeration-safe)
  if (!session || session.memberId !== memberSession.memberId) {
    return (
      <>
        <SiteHeader hideMobileSearchRow />
        <div className="min-h-screen page-bg-wash">
          <PageContainer size="reading" className="pb-10 pt-8">
            <main id="main-content" tabIndex={-1} className="space-y-4">
              <AlertCard variant="warning" title="플랜을 열 수 없습니다">
                이 계정으로는 해당 여행 플랜을 볼 수 없습니다. 플랜을 저장한 계정으로 로그인해 주세요.
              </AlertCard>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/planner/my" className={buttonVariants({ variant: "primary" })}>
                  내 여행 플랜
                </Link>
                <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                  홈으로
                </Link>
              </div>
            </main>
          </PageContainer>
        </div>
      </>
    );
  }

  redirect(`/planner/${sessionId}`);
}
