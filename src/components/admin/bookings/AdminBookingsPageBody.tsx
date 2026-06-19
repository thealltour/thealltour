"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

type AdminBookingsPageBodyProps = {
  unreadNotificationCount: number;
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export function AdminBookingsPageBody({
  unreadNotificationCount,
  children,
  title = "예약 관리",
  description = "예약번호·여행자·결제·리워드를 통합 관리합니다.",
}: AdminBookingsPageBodyProps) {
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
            title={title}
            description={description}
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
          {children}
        </section>
      </main>
    </div>
  );
}
