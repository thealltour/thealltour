"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, type BreadcrumbProps } from "@/components/navigation/Breadcrumb";
import { shouldShowBreadcrumb } from "@/lib/navigation/breadcrumbPolicy";
import { cn } from "@/lib/cn";

/**
 * 정책(`breadcrumbPolicy`)에 따라 브레드크럼을 노출합니다.
 * - 허용 경로가 아니면 null
 * - 모바일(md 미만)에서는 풀 브레드크럼 미노출 (`shouldShowBreadcrumbMobile` 참고)
 */
export function BreadcrumbWrapper({ items, className }: BreadcrumbProps) {
  const pathname = usePathname();

  if (!shouldShowBreadcrumb(pathname)) return null;

  // TODO:
  // 모바일에서는 Breadcrumb 대신
  // MobileBackNavigation 연결 예정 (shouldShowBreadcrumbMobile 등과 연동)

  return (
    <div className={cn("mb-5 hidden md:block", className)}>
      <Breadcrumb items={items} className="mb-0" />
    </div>
  );
}
