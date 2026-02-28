import { Suspense } from "react";
import AdminHeader from "@/components/AdminHeader";
import AdminNoticeManager from "@/components/AdminNoticeManager";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { getAdminCounts } from "@/lib/adminCounts";

function NoticeManagerFallback() {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl bg-[#f8fbff] p-8 text-sm text-slate-500 ring-1 ring-[#dbeafe]">
      공지사항을 불러오는 중...
    </div>
  );
}

export default async function AdminNoticesPage() {
  const [{ inquiryCount, productCount, memberCount, reviewCount }, unreadNotificationCount] =
    await Promise.all([getAdminCounts(), prepareAdminNotificationsAndGetUnreadCount()]);

  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="w-full space-y-6">
        <AdminHeader
          activeTab="notices"
          title="공지사항 관리"
          description="회원가입 법률 문서, 공지 등록, 등록된 공지 목록을 관리합니다."
          inquiryCount={inquiryCount}
          productCount={productCount}
          memberCount={memberCount}
          reviewCount={reviewCount}
          unreadNotificationCount={unreadNotificationCount}
        />
        <section className="overflow-hidden rounded-2xl bg-white p-4 shadow-md ring-1 ring-[#dbeafe] md:p-5">
          <AdminToastProvider>
            <AdminConfirmProvider>
              <Suspense fallback={<NoticeManagerFallback />}>
                <AdminNoticeManager />
              </Suspense>
            </AdminConfirmProvider>
          </AdminToastProvider>
        </section>
      </main>
    </div>
  );
}
