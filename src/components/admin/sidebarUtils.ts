/**
 * 사이드바 active/open 판별용 helper.
 * - 후기 관련 경로 여부
 * - 자식 경로 active 여부 (exact / startsWith)
 * - 그룹 내 활성 자식 존재 여부
 */

/** 후기 관리 하위 경로인지 (상위 메뉴 open/active 판별용) */
export function isReviewRelatedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin/reviews") ||
    pathname === "/theall_manager_only/reviews" ||
    pathname.startsWith("/theall_manager_only/review-reports") ||
    pathname.startsWith("/theall_manager_only/review-reminders") ||
    pathname.startsWith("/theall_manager_only/review-summaries")
  );
}

/** 단일 링크가 현재 pathname과 일치하는지 (자식 메뉴 active용) */
export function isChildPathActive(
  href: string,
  pathname: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href;
  if (href === "/admin/reviews") return pathname === "/admin/reviews";
  if (href === "/theall_manager_only/reviews") return pathname === "/theall_manager_only/reviews";
  return pathname.startsWith(href);
}

/** children 중 현재 pathname과 일치하는 항목이 있는지 */
export function hasActiveChild(
  childItems: Array<{ href: string; exact?: boolean }>,
  pathname: string,
): boolean {
  return childItems.some((c) => isChildPathActive(c.href, pathname, c.exact));
}
