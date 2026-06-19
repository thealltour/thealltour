import { Suspense } from "react";
import { AdminSmsResponsiveSection } from "@/components/admin/sms/AdminSmsResponsiveSection";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminSmsCenterPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-slate-500">SMS 센터를 불러오는 중…</p>}>
      <AdminSmsResponsiveSection
        inquiryCount={inquiryCount}
        productCount={productCount}
        memberCount={memberCount}
        reviewCount={reviewCount}
        unreadNotificationCount={unreadNotificationCount}
      />
    </Suspense>
  );
}
