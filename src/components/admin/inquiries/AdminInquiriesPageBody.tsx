"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { AdminInquiriesResponsiveSection } from "@/components/admin/inquiries/AdminInquiriesResponsiveSection";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

type AdminInquiriesPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export function AdminInquiriesPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
}: AdminInquiriesPageBodyProps) {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();
  const showDesktopHeader = !isReady || !isMobileAdmin;

  return (
    <div
      className={
        isReady && isMobileAdmin
          ? "min-h-0 bg-[var(--bg)] py-2 text-[var(--text-primary)]"
          : "min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10"
      }
    >
      <main className="w-full space-y-6">
        {showDesktopHeader ? (
          <AdminHeader
          title="문의 관리"
          description="접수된 문의를 검색하고 상담 완료 상태를 업데이트할 수 있습니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        ) : null}

        <section
          className={
            isReady && isMobileAdmin
              ? ""
              : "overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
          }
        >
          <AdminInquiriesResponsiveSection />
        </section>
      </main>
    </div>
  );
}
