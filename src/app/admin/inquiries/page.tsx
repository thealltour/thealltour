import { AdminInquiriesPageBody } from "@/components/admin/inquiries/AdminInquiriesPageBody";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminInquiriesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <AdminInquiriesPageBody
      inquiryCount={inquiryCount}
      productCount={productCount}
      memberCount={memberCount}
      reviewCount={reviewCount}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
