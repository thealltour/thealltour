import { MOBILE_ADMIN_ALLOWED_PATH_PREFIXES } from "@/components/admin/mobile/mobileAdmin.constants";
import { isMobileReviewRelativePathAllowed } from "@/components/admin/mobile/reviews/mobileReview.constants";

/**
 * 관리자 콘솔 상대 경로(rel)가 모바일 MVP에서 허용되는지.
 * @param relativePath getAdminConsoleRelativePath(pathname) 결과 (null이면 false)
 */
export function isMobileAdminRouteAllowed(relativePath: string | null): boolean {
  if (relativePath == null) return false;
  const path = relativePath === "" ? "/" : relativePath;

  if (path === "/") return true;

  if (path === "/inquiries") return true;
  if (path.startsWith("/inquiries/")) return false;

  for (const prefix of MOBILE_ADMIN_ALLOWED_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }

  if (path.startsWith("/reviews")) {
    return isMobileReviewRelativePathAllowed(path);
  }

  if (
    path.startsWith("/review-reports") ||
    path.startsWith("/review-reminders") ||
    path.startsWith("/review-summaries")
  ) {
    return false;
  }

  return false;
}

export function getMobileAdminShellTitle(relativePath: string | null): string {
  if (relativePath == null) return "관리자";
  const path = relativePath === "" ? "/" : relativePath;
  if (path === "/") return "대시보드";
  if (path === "/landings" || path.startsWith("/landings/")) return "검색/유입 랜딩 관리";
  if (path === "/inquiries" || path.startsWith("/inquiries/")) return "문의 관리";
  if (path.startsWith("/notifications")) return "알림";
  if (path === "/reviews/moderation") return "리뷰 검토";
  if (path === "/reviews/notifications") return "리뷰 운영 알림";
  if (path.startsWith("/reviews")) return "리뷰";
  return "관리자";
}
