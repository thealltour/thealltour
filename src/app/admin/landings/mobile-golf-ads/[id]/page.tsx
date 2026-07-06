import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminMobileGolfAdForm from "@/components/admin/mobile-golf-ads/AdminMobileGolfAdForm";
import { getAdminMobileGolfAd } from "@/lib/adminMobileGolfAds/service";
import { getAdminCounts } from "@/lib/adminCounts";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";

export default async function AdminMobileGolfAdEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount, item] =
    await Promise.all([
      getAdminCounts(),
      prepareAdminNotificationsAndGetUnreadCount(),
      getAdminMobileGolfAd(id),
    ]);

  if (!item) notFound();

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-3xl space-y-6">
        <AdminHeader
          title={`모바일 골프 랜딩 · ${item.title}`}
          description="저장 후 발행하면 `/golf/ads/{slug}` URL이 공개됩니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminToastProvider>
          <AdminMobileGolfAdForm mode="edit" initial={item} />
        </AdminToastProvider>
      </main>
    </div>
  );
}
