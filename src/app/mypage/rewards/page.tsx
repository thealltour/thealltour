import MyPageLayout from "@/components/mypage/MyPageLayout";
import RewardsRedemptionClient from "@/components/mypage/RewardsRedemptionClient";
import { cookies } from "next/headers";
import { getActiveRewardCatalog, getMemberPointsData } from "@/lib/member/meServerData";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

export default async function MyPageRewardsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return null;
  }

  const [memberSummary, catalog, points] = await Promise.all([
    getMyPageMemberSummary(),
    getActiveRewardCatalog(),
    getMemberPointsData(session.memberId),
  ]);

  let profile: { name: string | null; phone: string | null } | null = null;
  const { data } = await supabase
    .from("members")
    .select("name, phone")
    .eq("id", session.memberId)
    .maybeSingle();
  profile = data as { name: string | null; phone: string | null } | null;

  return (
    <MyPageLayout
      title="리워드 교환소"
      description="포인트로 교환 가능한 리워드를 확인할 수 있습니다."
      memberSummary={memberSummary}
    >
      <RewardsRedemptionClient
        initialCatalog={catalog}
        initialBalance={Number(points?.balance ?? 0)}
        initialName={profile?.name ?? undefined}
        initialPhone={profile?.phone ?? undefined}
      />
    </MyPageLayout>
  );
}
