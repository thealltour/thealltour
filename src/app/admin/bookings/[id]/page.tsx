import AdminHeader from "@/components/admin/AdminHeader";
import AdminBookingDetailPage from "@/components/admin/bookings/AdminBookingDetailPage";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

export default async function AdminBookingDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          title="예약 상세"
          description="여행자·결제·SMS·리워드 지급"
          unreadNotificationCount={unreadNotificationCount}
        />
        <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
          <AdminBookingDetailPage bookingId={id} />
        </section>
      </main>
    </div>
  );
}
