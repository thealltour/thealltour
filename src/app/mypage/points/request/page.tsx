import MyPageLayout from "@/components/mypage/MyPageLayout";
import EarnRequestSection from "@/components/points/EarnRequestSection";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { getMyPageMemberSummary } from "@/lib/mypage/memberSummary";

export default async function MyPagePointRequestPage() {
  const memberSummary = await getMyPageMemberSummary();

  return (
    <MyPageLayout
      title="포인트 적립 요청"
      description="여행 예약 증빙 제출 후 검수 완료 시 포인트가 지급됩니다."
      memberSummary={memberSummary}
    >
      <MyPageCard className="p-0 sm:p-0">
        <div className="p-4 sm:p-5">
          <EarnRequestSection />
        </div>
      </MyPageCard>
    </MyPageLayout>
  );
}
