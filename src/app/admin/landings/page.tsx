import AdminHeader from "@/components/admin/AdminHeader";
import AdminLandingManager from "@/components/admin/landings/AdminLandingManager";
import {
  ADMIN_LANDINGS_DESCRIPTION,
  ADMIN_LANDINGS_TITLE,
} from "@/components/admin/landings/adminLandings.constants";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminLandingsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          activeTab="landings"
          title={ADMIN_LANDINGS_TITLE}
          description={ADMIN_LANDINGS_DESCRIPTION}
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />

        <AdminLandingManager />
      </main>
    </div>
  );
}
