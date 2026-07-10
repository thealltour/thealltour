import MyPageLayout from "@/components/mypage/MyPageLayout";
import WelcomeKakaoPointsToast from "@/components/mypage/WelcomeKakaoPointsToast";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageList, MyPageListItem } from "@/components/mypage/ui/MyPageListItem";
import { MyPageSectionHeader } from "@/components/mypage/ui/MyPageSectionHeader";
import { MyPageStatCard, MyPageStatGrid } from "@/components/mypage/ui/MyPageStatGrid";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { MyPageWelcomeStrip } from "@/components/mypage/ui/MyPageWelcomeStrip";
import { buttonVariants } from "@/components/ui/Button";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { getMemberPointsData } from "@/lib/member/meServerData";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";

const TYPE_LABEL: Record<string, string> = {
  EARN: "적립",
  USE: "사용",
  EXPIRE: "소멸",
  ADJUST: "조정",
  RESERVE: "예약",
  RELEASE: "예약해제",
};

export default async function MyPagePointsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return null;
  }

  const [memberSummary, data] = await Promise.all([
    getMyPageMemberSummary(),
    getMemberPointsData(session.memberId),
  ]);
  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];

  return (
    <MyPageLayout
      title="포인트"
      description="잔액 및 포인트 내역을 확인할 수 있습니다."
      memberSummary={memberSummary}
    >
      <Suspense fallback={null}>
        <WelcomeKakaoPointsToast />
      </Suspense>
      <div className="space-y-6">
        <MyPageWelcomeStrip userName={memberSummary?.name} points={data?.balance ?? memberSummary?.points} />

        <MyPageStatGrid>
          <MyPageStatCard
            label="포인트 잔액"
            value={`${Number(data?.balance ?? 0).toLocaleString()}P`}
            iconKey="points"
            elevated
          />
          <MyPageStatCard
            label="적립 예정"
            value={`${Number(data?.pending ?? 0).toLocaleString()}P`}
            iconKey="points-request"
            elevated
          />
        </MyPageStatGrid>

        {Number(data?.expiringSoon ?? 0) > 0 ? (
          <p className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
            30일 이내 소멸 예정 포인트: {Number(data?.expiringSoon ?? 0).toLocaleString()}P
          </p>
        ) : null}

        <Link
          href="/mypage/points/request"
          className={cn(buttonVariants({ variant: "primary", size: "md" }), "inline-flex")}
        >
          예약 증빙으로 포인트 적립 요청하기
        </Link>

        <MyPageCard>
          <MyPageSectionHeader title="포인트 내역" />
          <MyPageList className="mt-4">
            {ledger.length === 0 ? (
              <li>
                <MyPageEmptyState message="포인트 내역이 없습니다." dashed className="py-4" />
              </li>
            ) : (
              ledger.map((item) => (
                <MyPageListItem key={item.id}>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {TYPE_LABEL[item.type] ?? item.type} · {item.reason ?? "-"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(item.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {Number(item.amount).toLocaleString()}P
                    </p>
                    <MyPageStatusBadge status={item.status} label={item.status} />
                  </div>
                </MyPageListItem>
              ))
            )}
          </MyPageList>
        </MyPageCard>
      </div>
    </MyPageLayout>
  );
}
