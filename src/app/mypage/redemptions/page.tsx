import { cookies } from "next/headers";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { MyPageEmptyState } from "@/components/mypage/ui/MyPageEmptyState";
import { MyPageList, MyPageListItem } from "@/components/mypage/ui/MyPageListItem";
import { MyPageStatusBadge } from "@/components/mypage/ui/MyPageStatusBadge";
import { getMemberRedemptionList } from "@/lib/member/meServerData";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

export default async function MypageRedemptionsPage() {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) {
    return null;
  }

  const list = await getMemberRedemptionList(session.memberId);

  return (
    <MyPageLayout title="교환 신청 내역" description="리워드 교환 진행 상태를 확인할 수 있습니다.">
      {list.length === 0 ? (
        <MyPageEmptyState
          message="신청 내역이 없습니다."
          ctaHref="/mypage/rewards"
          ctaLabel="리워드 교환소"
          dashed={false}
        />
      ) : (
        <MyPageCard>
          <MyPageList>
            {list.map((row) => (
              <MyPageListItem key={row.id}>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{row.catalog_title ?? "리워드"}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{Number(row.point_amount).toLocaleString()}P</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    신청일 {new Date(row.requested_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <MyPageStatusBadge status={row.status} />
              </MyPageListItem>
            ))}
          </MyPageList>
        </MyPageCard>
      )}
    </MyPageLayout>
  );
}
