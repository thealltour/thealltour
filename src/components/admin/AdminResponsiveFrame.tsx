"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminCompactShell } from "@/components/admin/mobile/useAdminCompactShell";
import { TabletAdminShell } from "@/components/admin/mobile/TabletAdminShell";
import { MobileAdminPageGuard } from "@/components/admin/mobile/MobileAdminPageGuard";
import { MobileReviewPageGuard } from "@/components/admin/mobile/reviews/MobileReviewPageGuard";
import {
  getMobileAdminShellTitle,
  isMobileAdminRouteAllowed,
} from "@/components/admin/mobile/mobileAdminRoutePolicy";
import { ADMIN_PWA_HUB_HREF } from "@/components/admin/mobile/mobileAdmin.constants";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { getAdminConsoleRelativePath, isAdminConsolePublicPath } from "@/lib/adminConsolePaths";

type AdminResponsiveFrameProps = {
  children: ReactNode;
};

/**
 * 관리자 콘솔 반응 분기 레이어.
 * - 공개 경로(/login): 레이아웃 없이 children만.
 * - 미디어쿼리 준비 전: 데스크톱 AdminLayout (hydration 일치).
 * - 컴팩트(PWA standalone 또는 ≤1280): TabletAdminShell + 허용 경로만 본문.
 * - 와이드 데스크톱: 기존 AdminLayout.
 */
export function AdminResponsiveFrame({ children }: AdminResponsiveFrameProps) {
  const pathname = usePathname();
  const session = useAdminSession();
  const { useCompactShell, isLandscape, isReady } = useAdminCompactShell();
  const rel = getAdminConsoleRelativePath(pathname);

  if (isAdminConsolePublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!isReady) {
    return <AdminLayout>{children}</AdminLayout>;
  }

  if (useCompactShell) {
    const allowed = isMobileAdminRouteAllowed(rel, session);
    const title = allowed ? getMobileAdminShellTitle(rel) : "PC 전용 화면";
    const isReviewPath = rel != null && rel.startsWith("/reviews");
    return (
      <TabletAdminShell title={title} isLandscape={isLandscape}>
        {allowed ? (
          children
        ) : isReviewPath ? (
          <MobileReviewPageGuard />
        ) : (
          <MobileAdminPageGuard
            title="PC 관리자에서 이용해 주세요"
            description="이 화면은 태블릿·모바일 관리자에서 지원하지 않습니다."
            desktopOnlyReason="상품·랜딩·설정·고밀도 분석 등은 PC 환경을 권장합니다."
            backHref={ADMIN_PWA_HUB_HREF}
            backLabel="태블릿 메뉴로"
          />
        )}
      </TabletAdminShell>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
