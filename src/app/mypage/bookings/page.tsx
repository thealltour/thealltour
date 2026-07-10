import MyPageLayout from "@/components/mypage/MyPageLayout";
import MyPageBookingsShell from "@/app/mypage/bookings/MyPageBookingsShell";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";

export default async function MyPageBookingsPage() {
  const memberSummary = await getMyPageMemberSummary();

  return (
    <MyPageLayout
      title="내 예약"
      description="연결된 여행 예약 목록입니다. 완료된 예약은 포인트 적립 요청 시 선택할 수 있습니다."
      memberSummary={memberSummary}
    >
      <MyPageBookingsShell />
    </MyPageLayout>
  );
}
