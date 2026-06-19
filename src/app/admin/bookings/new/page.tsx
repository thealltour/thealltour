import { AdminBookingsPageBody } from "@/components/admin/bookings/AdminBookingsPageBody";
import AdminBookingCreateForm from "@/components/admin/bookings/AdminBookingCreateForm";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminBookingNewPage() {
  const unreadNotificationCount = await prepareAdminNotificationsAndGetUnreadCount();

  return (
    <AdminBookingsPageBody
      unreadNotificationCount={unreadNotificationCount}
      title="예약 생성"
      description="문의 없이 customer_profile 기준으로 예약을 생성합니다."
    >
      <AdminBookingCreateForm />
    </AdminBookingsPageBody>
  );
}
