import { AdminGolfLeadsPageBody } from "@/components/admin/golf-leads/AdminGolfLeadsPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminGolfLeadsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <AdminGolfLeadsPageBody
      inquiryCount={inquiryCount}
      productCount={productCount}
      memberCount={memberCount}
      reviewCount={reviewCount}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
