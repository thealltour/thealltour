"use client";

import { useSearchParams } from "next/navigation";
import { AdminSmsCenterPageBody } from "@/components/admin/sms/AdminSmsCenterPageBody";
import { MobileAdminSmsCenter } from "@/components/admin/mobile/sms/MobileAdminSmsCenter";
import { MobileAdminPageGuard } from "@/components/admin/mobile/MobileAdminPageGuard";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

type AdminSmsResponsiveSectionProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

/**
 * SMS 센터: 데스크톱은 전체 탭, 모바일은 inbox(대화)만.
 */
export function AdminSmsResponsiveSection(props: AdminSmsResponsiveSectionProps) {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  if (!isReady || !isMobileAdmin) {
    return <AdminSmsCenterPageBody {...props} />;
  }

  if (tab === "bulk" || tab === "templates") {
    return (
      <MobileAdminPageGuard
        title="PC 관리자에서 이용해 주세요"
        description="대량 발송·템플릿 관리는 PC 환경을 권장합니다."
        desktopOnlyReason="모바일 SMS 센터는 수신·발송 대화(inbox)만 지원합니다."
        backHref="/theall_manager_only/sms"
        backLabel="SMS 대화로"
      />
    );
  }

  return <MobileAdminSmsCenter />;
}
