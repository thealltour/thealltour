import AdminProductManager from "@/components/AdminProductManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminProductsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="w-full space-y-6">
        <section className="overflow-hidden rounded-2xl bg-white p-4 shadow-md ring-1 ring-[#dbeafe] md:p-5">
          <AdminProductManager />
        </section>
      </main>
    </div>
  );
}
