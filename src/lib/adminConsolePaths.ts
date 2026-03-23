/**
 * 관리자 콘솔 URL: /admin/* 와 /theall_manager_only/* 를 동일한 "상대 경로"로 정규화해
 * 메뉴 활성·권한 판별을 한 곳에서 맞춥니다.
 */

export const ADMIN_CONSOLE_PREFIXES = ["/admin", "/theall_manager_only"] as const;

export type AdminConsolePrefix = (typeof ADMIN_CONSOLE_PREFIXES)[number];

/**
 * /admin 또는 /theall_manager_only 기준 상대 경로 (선행 슬래시 포함).
 * 예: /admin/products → /products, /theall_manager_only → /
 * 콘솔 밖 경로면 null.
 */
export function getAdminConsoleRelativePath(pathname: string): string | null {
  const p = pathname.trim();
  for (const prefix of ADMIN_CONSOLE_PREFIXES) {
    if (p === prefix) return "/";
    if (p.startsWith(`${prefix}/`)) return p.slice(prefix.length);
  }
  return null;
}

export function isAdminConsolePath(pathname: string): boolean {
  return getAdminConsoleRelativePath(pathname) != null;
}

/** 로그인 등 사이드바·권한 그룹 밖 공개 화면 */
export function isAdminConsolePublicPath(pathname: string): boolean {
  const rel = getAdminConsoleRelativePath(pathname);
  return rel === "/login";
}

/** 후기·신고·알림 등 "후기 관리" 메뉴에 묶이는 상대 경로 */
export function isAdminReviewSectionRelativePath(rel: string): boolean {
  return (
    rel === "/reviews" ||
    rel.startsWith("/reviews/") ||
    rel.startsWith("/review-reports") ||
    rel.startsWith("/review-reminders") ||
    rel.startsWith("/review-summaries")
  );
}
