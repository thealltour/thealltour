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
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
          <Suspense
            fallback={
              <div className="h-32 animate-pulse rounded-xl bg-[var(--surface-muted)]" aria-hidden="true" />
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
