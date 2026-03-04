import MyPageLayout from "@/components/mypage/MyPageLayout";
import RewardsRedemptionClient from "@/components/mypage/RewardsRedemptionClient";
import { cookies } from "next/headers";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabase } from "@/lib/supabase";

async function fetchCatalog(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/rewards/catalog`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

async function fetchPoints(baseUrl: string, cookieHeader: string) {
  const res = await fetch(`${baseUrl}/api/me/points`, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  });
  if (!res.ok) return { balance: 0 };
  return res.json();
}

export default async function MyPageRewardsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookieHeader = cookieStore.toString();
  const [catalog, points] = await Promise.all([fetchCatalog(baseUrl), fetchPoints(baseUrl, cookieHeader)]);
  let profile: { name: string | null; phone: string | null } | null = null;
  if (session?.memberId) {
    const { data } = await supabase
      .from("members")
      .select("name, phone")
      .eq("id", session.memberId)
      .maybeSingle();
    profile = data as { name: string | null; phone: string | null } | null;
  }
  return (
    <MyPageLayout title="리워드 교환소" description="포인트로 교환 가능한 리워드를 확인할 수 있습니다.">
      <RewardsRedemptionClient
        initialCatalog={catalog}
        initialBalance={Number(points?.balance ?? 0)}
        initialName={profile?.name ?? undefined}
        initialPhone={profile?.phone ?? undefined}
      />
    </MyPageLayout>
  );
}
