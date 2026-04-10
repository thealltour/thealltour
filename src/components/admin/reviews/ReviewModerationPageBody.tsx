"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { ReviewModerationResponsiveSection } from "@/components/admin/reviews/ReviewModerationResponsiveSection";
import type { ReviewModerationDashboardProps } from "@/components/admin/reviews/ReviewModerationDashboard";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

type ReviewModerationPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
  moderation: ReviewModerationDashboardProps;
};

export function ReviewModerationPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
  moderation,
}: ReviewModerationPageBodyProps) {
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
      <main className="mx-auto w-full max-w-6xl space-y-6">
        {showDesktopHeader ? (
          <AdminHeader
            activeTab="reviews"
            title="리뷰 검토"
            description="검토 대기·신고된 리뷰·숨김 리뷰를 관리하고, 숨김/복원/검토/해결 처리할 수 있습니다."
            inquiryCount={inquiryCount}
            productCount={productCount}
            memberCount={memberCount}
            reviewCount={reviewCount}
            unreadNotificationCount={unreadNotificationCount}
          />
        ) : null}

        <section
          className={
            isReady && isMobileAdmin
              ? ""
              : "overflow-hidden rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]"
          }
        >
          <ReviewModerationResponsiveSection {...moderation} />
        </section>
      </main>
    </div>
  );
}
