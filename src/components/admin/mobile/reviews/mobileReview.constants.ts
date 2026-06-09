/**
 * 모바일 관리자에서 허용할 리뷰 관련 경로 정책.
 * 전체 콘솔 정책은 `mobileAdminRoutePolicy`에서 `/reviews` 접두 시 이 모듈을 호출합니다.
 */

const MANAGER_PREFIX = "/theall_manager_only";

/** 모바일에서 열 수 있는 리뷰 경로 (getAdminConsoleRelativePath 기준, 정확 일치) */
export const MOBILE_ALLOWED_REVIEW_EXACT_PATHS = [
  "/reviews",
  "/reviews/moderation",
  "/reviews/notifications",
] as const;

/**
 * 모바일에서 차단하는 리뷰 하위 경로 (본인 또는 하위 세그먼트).
 * 고밀도 분석·요약·실험 등.
 */
export const MOBILE_BLOCKED_REVIEW_PATH_PREFIXES = [
  "/reviews/analytics",
  "/reviews/anomalies",
  "/reviews/authors",
  "/reviews/conversions",
  "/reviews/experiments",
  "/reviews/insights",
  "/reviews/summaries",
] as const;

/** 모바일 리뷰 서브 네비(검토·알림 등) */
export const MOBILE_REVIEW_NAV_ITEMS = [
  { label: "목록", href: `${MANAGER_PREFIX}/reviews` },
  { label: "검토", href: `${MANAGER_PREFIX}/reviews/moderation` },
  { label: "운영 알림", href: `${MANAGER_PREFIX}/reviews/notifications` },
] as const;

const ALLOWED_EXACT = new Set<string>(MOBILE_ALLOWED_REVIEW_EXACT_PATHS);

/**
 * `/reviews` 로 시작하는 상대 경로만 판별 (호출부에서 접두 확인 권장).
 */
export function isMobileReviewRelativePathAllowed(path: string): boolean {
  if (ALLOWED_EXACT.has(path)) return true;
  if (!path.startsWith("/reviews/")) return false;
  for (const blocked of MOBILE_BLOCKED_REVIEW_PATH_PREFIXES) {
    if (path === blocked || path.startsWith(`${blocked}/`)) return false;
  }
  return false;
}
