import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageList, MyPageListItem } from "@/components/mypage/ui/MyPageListItem";
import { MyPageStatCard, MyPageStatGrid } from "@/components/mypage/ui/MyPageStatGrid";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { cookies } from "next/headers";
import Link from "next/link";
import { getMemberPointsData, getMemberRedemptionList } from "@/lib/member/meServerData";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { getMyPageReviewSections } from "@/lib/mypageReviews";

function formatReviewDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR");
}

export default async function MyPageDashboardPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return null;
  }

  const [pointsData, redemptions, reviewSections] = await Promise.all([
    getMemberPointsData(session.memberId),
    getMemberRedemptionList(session.memberId),
    getMyPageReviewSections(session.memberId),
  ]);
  const recentRedemptions = redemptions.slice(0, 3);
  const recentReviews = reviewSections.submitted.slice(0, 3);

  return (
    <MyPageLayout title="마이페이지 대시보드" description="회원 활동 요약을 확인할 수 있습니다.">
      <div className="space-y-6">
        <MyPageStatGrid>
          <MyPageStatCard
            label="포인트 잔액"
            value={`${Number(pointsData?.balance ?? 0).toLocaleString()}P`}
          />
          <MyPageStatCard
            label="적립 예정 포인트"
            value={`${Number(pointsData?.pending ?? 0).toLocaleString()}P`}
          />
        </MyPageStatGrid>

        <MyPageCard title="최근 리워드 상태">
          <MyPageList>
            {recentRedemptions.length === 0 ? (
              <li>
                <MyPageEmptyState message="최근 리워드 신청 내역이 없습니다." dashed className="py-4" />
              </li>
            ) : (
              recentRedemptions.map((item) => (
                <MyPageListItem key={item.id}>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.catalog_title ?? "리워드"}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {new Date(item.requested_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <MyPageStatusBadge status={item.status} />
                </MyPageListItem>
              ))
            )}
          </MyPageList>
        </MyPageCard>

        <MyPageCard
          title="최근 리뷰"
          action={
            <Link href="/mypage/reviews" className="link-primary text-xs font-medium">
              전체 보기
            </Link>
          }
        >
          <MyPageList>
            {recentReviews.length === 0 ? (
              <li>
                <MyPageEmptyState
                  message="리뷰를 남기고 5,000포인트를 적립해 보세요."
                  ctaHref="/mypage/reviews"
                  ctaLabel="리뷰 관리"
                  dashed
                  className="py-4"
                />
              </li>
            ) : (
              recentReviews.map((item) => (
                <MyPageListItem key={item.id} href={`/mypage/reviews/${item.id}`}>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {item.title?.trim() || "제목 없음"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {typeof item.rating === "number" ? `평점 ${item.rating}/5 · ` : ""}
                      {formatReviewDate(item.created_at)}
                    </p>
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
