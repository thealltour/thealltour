"use client";

import { usePathname } from "next/navigation";
import { Breadcrumb, type BreadcrumbItem } from "@/components/navigation/Breadcrumb";
import { MobileBackHeader } from "@/components/navigation/MobileBackHeader";
import { showProductsNavigationContext, getProductsBackFallbackFromPathname } from "@/lib/navigation/productsNavigationPolicy";
import { cn } from "@/lib/cn";

export type NavigationContextHeaderProps = {
  items: BreadcrumbItem[];
  pageTitle: string;
  /** 미전달 시 `getFallbackPath(pathname)` */
  fallbackHref?: string;
  className?: string;
  /** 데스크톱에서 compact 브레드크럼(좁은 열 등) — 기본 full */
  desktopBreadcrumbVariant?: "full" | "compact";
  /** false면 하단 여백 없음 — 부모 flex gap 등으로 간격 조절 */
  withMarginBottom?: boolean;
};

/**
 * 데스크톱: 브레드크럼 / 모바일: 뒤로가기 헤더.
 * `showProductsNavigationContext`로 경로가 허용될 때만 렌더(클라이언트 네비게이션 대비).
 */
export function NavigationContextHeader({
  items,
  pageTitle,
  fallbackHref: fallbackHrefProp,
  className,
  desktopBreadcrumbVariant = "full",
  withMarginBottom = true,
}: NavigationContextHeaderProps) {
  const pathname = usePathname();
  const fallbackHref = fallbackHrefProp ?? getProductsBackFallbackFromPathname(pathname);

  if (!showProductsNavigationContext(pathname)) return null;

  return (
    <div
      className={cn(
        "w-full",
        withMarginBottom ? "mb-4 md:mb-5" : "",
        className,
      )}
    >
      <div className="hidden md:block">
        <Breadcrumb items={items} variant={desktopBreadcrumbVariant} />
      </div>
      <MobileBackHeader title={pageTitle} fallbackHref={fallbackHref} />
    </div>
  );
}
