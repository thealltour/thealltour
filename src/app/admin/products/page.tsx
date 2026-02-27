import { Suspense } from "react";
import AdminProductManager from "@/components/AdminProductManager";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminProductsPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="w-full space-y-6">
        <section className="overflow-hidden rounded-2xl bg-white p-4 shadow-md ring-1 ring-[#dbeafe] md:p-5">
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
            }
          >
            <AdminToastProvider>
              <AdminConfirmProvider>
                <AdminProductManager />
              </AdminConfirmProvider>
            </AdminToastProvider>
          </Suspense>
        </section>
      </main>
    </div>
  );
}
