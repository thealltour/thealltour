import { AdminInquiryDashboardPageBody } from "@/components/admin/inquiries/AdminInquiryDashboardPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminInquiryDashboardPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <AdminInquiryDashboardPageBody
      inquiryCount={inquiryCount}
      productCount={productCount}
      memberCount={memberCount}
      reviewCount={reviewCount}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
