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

const ADMIN_RETURN_TO_PREFIXES = ["/theall_manager_only/", "/theall_manager_only"] as const;

/**
 * 로그인 후 복귀 URL 검증. 관리자 콘솔 경로만 허용하고 /login 은 제외.
 */
export function sanitizeAdminReturnTo(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;

  let pathname = raw;
  let search = "";
  try {
    const parsed = new URL(raw, "https://admin.local");
    pathname = parsed.pathname;
    search = parsed.search;
  } catch {
    const q = raw.indexOf("?");
    if (q >= 0) {
      pathname = raw.slice(0, q);
      search = raw.slice(q);
    }
  }

  const allowed = ADMIN_RETURN_TO_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) return null;

  const rel = getAdminConsoleRelativePath(pathname);
  if (rel === "/login" || rel?.startsWith("/login/")) return null;

  return `${pathname}${search}`;
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

const MANAGER_NOTIFICATIONS_HREF = "/theall_manager_only/notifications";

/**
 * 알림 target_url·대시보드 링크용. `/admin/...` → `/theall_manager_only/...`.
 * 비어 있으면 알림 목록으로 폴백.
 */
export function normalizeAdminConsoleHref(
  url: string | null | undefined,
  fallback: string = MANAGER_NOTIFICATIONS_HREF,
): string {
  const raw = url?.trim();
  if (!raw) return fallback;

  let pathname = raw;
  let search = "";
  let hash = "";
  try {
    const parsed = new URL(raw, "https://admin.local");
    pathname = parsed.pathname;
    search = parsed.search;
    hash = parsed.hash;
  } catch {
    const hashIdx = raw.indexOf("#");
    const withoutHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
    hash = hashIdx >= 0 ? raw.slice(hashIdx) : "";
    const q = withoutHash.indexOf("?");
    if (q >= 0) {
      pathname = withoutHash.slice(0, q);
      search = withoutHash.slice(q);
    } else {
      pathname = withoutHash;
    }
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    pathname = pathname.replace(/^\/admin(?=\/|$)/, "/theall_manager_only");
  }

  return `${pathname}${search}${hash}`;
}
