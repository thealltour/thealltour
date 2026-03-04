import MyPageLayout from "@/components/mypage/MyPageLayout";
import NotificationsClient from "@/components/mypage/NotificationsClient";

export default function MyPageNotificationsPage() {
  return (
    <MyPageLayout title="알림" description="회원 알림 목록을 확인할 수 있습니다.">
      <NotificationsClient />
    </MyPageLayout>
  );
}
