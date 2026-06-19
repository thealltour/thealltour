import { AdminBookingsPageBody } from "@/components/admin/bookings/AdminBookingsPageBody";
import AdminBookingsTable from "@/components/admin/bookings/AdminBookingsTable";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminBookingsPage() {
  const unreadNotificationCount = await prepareAdminNotificationsAndGetUnreadCount();

  return (
    <AdminBookingsPageBody unreadNotificationCount={unreadNotificationCount}>
      <AdminBookingsTable />
    </AdminBookingsPageBody>
  );
}
