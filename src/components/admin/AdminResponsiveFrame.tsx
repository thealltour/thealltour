"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";
import { MobileAdminShell } from "@/components/admin/mobile/MobileAdminShell";
import { MobileAdminPageGuard } from "@/components/admin/mobile/MobileAdminPageGuard";
import { MobileReviewPageGuard } from "@/components/admin/mobile/reviews/MobileReviewPageGuard";
import {
  getMobileAdminShellTitle,
  isMobileAdminRouteAllowed,
} from "@/components/admin/mobile/mobileAdminRoutePolicy";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { getAdminConsoleRelativePath, isAdminConsolePublicPath } from "@/lib/adminConsolePaths";

type AdminResponsiveFrameProps = {
  children: ReactNode;
};

/**
 * 관리자 콘솔 반응 분기 레이어.
 * - 공개 경로(/login): 레이아웃 없이 children만 (기존과 동일).
 * - 미디어쿼리 준비 전: 데스크톱 AdminLayout (hydration 일치).
 * - 모바일: MobileAdminShell + 허용 경로만 본문, 비허용은 PageGuard.
 * - 데스크톱: 기존 AdminLayout.
 *
 * 후속 PR에서 /m-admin 분리 시 이 컴포넌트의 분기만 교체하면 됨.
 */
export function AdminResponsiveFrame({ children }: AdminResponsiveFrameProps) {
  const pathname = usePathname();
  const session = useAdminSession();
  const { isMobileAdmin, isReady } = useIsMobileAdmin();
  const rel = getAdminConsoleRelativePath(pathname);

  if (isAdminConsolePublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!isReady) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  if (isMobileAdmin) {
    const allowed = isMobileAdminRouteAllowed(rel, session);
    const title = allowed ? getMobileAdminShellTitle(rel) : "PC 전용 화면";
    const isReviewPath = rel != null && rel.startsWith("/reviews");
    return (
      <MobileAdminShell title={title}>
        {allowed ? (
          children
        ) : isReviewPath ? (
          <MobileReviewPageGuard />
        ) : (
          <MobileAdminPageGuard
            title="PC 관리자에서 이용해 주세요"
            description="이 화면은 모바일 관리자에서 지원하지 않습니다."
            desktopOnlyReason="상품·회원·설정·고밀도 분석 등은 PC 환경을 권장합니다."
            backHref="/theall_manager_only"
            backLabel="홈으로"
          />
        )}
      </MobileAdminShell>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
