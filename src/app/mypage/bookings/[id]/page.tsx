import { isPortOneEnabled } from "@/lib/payments/portone/config";
import MyPageLayout from "@/components/mypage/MyPageLayout";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";
import MyPageBookingDetailClient from "./MyPageBookingDetailClient";

export default async function MyPageBookingDetailPage() {
  const memberSummary = await getMyPageMemberSummary();

  return (
    <MyPageLayout
      title="예약 상세"
      description="예약금·잔금 결제 상태와 선택하신 출발일·옵션을 확인할 수 있습니다."
      memberSummary={memberSummary}
    >
      <MyPageBookingDetailClient portOneEnabled={isPortOneEnabled()} />
    </MyPageLayout>
  );
}
