"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { InquiryDashboardPage } from "@/components/admin/inquiries/dashboard/InquiryDashboardPage";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

type Props = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

export function AdminInquiryDashboardPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
}: Props) {
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
          title="문의 운영 대시보드"
          description="KPI·추이·담당 부하·위험 문의를 한 화면에서 확인하고 목록으로 바로 이동할 수 있습니다."
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
          <InquiryDashboardPage />
        </section>
      </main>
    </div>
  );
}
