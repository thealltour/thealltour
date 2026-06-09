/**
 * 사이드바 active/open 판별용 helper.
 * - 후기 관련 경로 여부
 * - 자식 경로 active 여부 (exact / startsWith)
 * - 그룹 내 활성 자식 존재 여부
 */

import { getAdminConsoleRelativePath, isAdminReviewSectionRelativePath } from "@/lib/adminConsolePaths";

/** 후기 관리 하위 경로인지 (상위 메뉴 open/active 판별용) */
export function isReviewRelatedPath(pathname: string): boolean {
  const rel = getAdminConsoleRelativePath(pathname);
  if (rel == null) return false;
  return isAdminReviewSectionRelativePath(rel);
}

/** 단일 링크가 현재 pathname과 일치하는지 (자식 메뉴 active용) */
export function isChildPathActive(
  href: string,
  pathname: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href;
  const hrefRel = getAdminConsoleRelativePath(href.split("?")[0] ?? href);
  const pathRel = getAdminConsoleRelativePath(pathname);
  if (hrefRel != null && pathRel != null) {
    if (exact) return pathRel === hrefRel;
    if (hrefRel === "/reviews") return pathRel === "/reviews";
    return pathRel === hrefRel || pathRel.startsWith(`${hrefRel}/`);
  }
  return pathname.startsWith(href);
}

/** children 중 현재 pathname과 일치하는 항목이 있는지 */
export function hasActiveChild(
  childItems: Array<{ href: string; exact?: boolean }>,
  pathname: string,
): boolean {
  return childItems.some((c) => isChildPathActive(c.href, pathname, c.exact));
}
