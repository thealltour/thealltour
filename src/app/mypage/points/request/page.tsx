import MyPageLayout from "@/components/mypage/MyPageLayout";
import EarnRequestSection from "@/components/points/EarnRequestSection";

export default function MyPagePointRequestPage() {
  return (
    <MyPageLayout title="포인트 적립 요청" description="여행 예약 증빙 제출 후 검수 완료 시 포인트가 지급됩니다.">
      <EarnRequestSection />
    </MyPageLayout>
  );
}
