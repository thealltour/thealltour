"use client";

import AdminInquiryTable from "@/components/admin/AdminInquiryTable";
import { MobileAdminInquiryList } from "@/components/admin/mobile/inquiries/MobileAdminInquiryList";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";

/**
 * 문의 관리: 데스크톱은 기존 테이블, 모바일은 카드 목록.
 */
export function AdminInquiriesResponsiveSection() {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();

  if (!isReady || !isMobileAdmin) {
    return <AdminInquiryTable />;
  }

  return <MobileAdminInquiryList />;
}
