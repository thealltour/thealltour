import { MOBILE_ADMIN_ALLOWED_PATH_PREFIXES } from "@/components/admin/mobile/mobileAdmin.constants";
import { isMobileReviewRelativePathAllowed } from "@/components/admin/mobile/reviews/mobileReview.constants";
import { hasAdminPermission } from "@/lib/adminPermissions";
import { isSessionAllowedForConsolePath } from "@/lib/adminRolePolicy";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";

/**
 * 관리자 콘솔 상대 경로(rel)가 모바일 MVP에서 허용되는지.
 */
export function isMobileAdminRouteAllowed(
  relativePath: string | null,
  session: AdminSessionPermissions,
): boolean {
  if (relativePath == null) return false;
  const path = relativePath === "" ? "/" : relativePath;

  if (!isSessionAllowedForConsolePath(session, path)) return false;

  if (path === "/") return true;

  if (path === "/inquiries") return hasAdminPermission(session, "inquiries.manage");
  if (path.startsWith("/inquiries/")) return false;

  if (path === "/bookings" || path.startsWith("/bookings/")) {
    return hasAdminPermission(session, "inquiries.manage");
  }

  if (path === "/sms") return hasAdminPermission(session, "inquiries.manage");

  if (path.startsWith("/members")) return hasAdminPermission(session, "members.manage");
  if (path.startsWith("/points")) return hasAdminPermission(session, "points.manage");
  if (path.startsWith("/rewards")) return hasAdminPermission(session, "rewards.manage");

  for (const prefix of MOBILE_ADMIN_ALLOWED_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (prefix === "/members" && !hasAdminPermission(session, "members.manage")) continue;
      if (prefix === "/points" && !hasAdminPermission(session, "points.manage")) continue;
      if (prefix === "/rewards" && !hasAdminPermission(session, "rewards.manage")) continue;
      return true;
    }
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
  if (path === "/inquiries" || path.startsWith("/inquiries/")) return "문의·상담";
  if (path === "/bookings" || path.startsWith("/bookings/")) return "예약 관리";
  if (path === "/sms") return "SMS 센터";
  if (path.startsWith("/members") || path.startsWith("/points") || path.startsWith("/rewards")) {
    return "회원·리워드";
  }
  if (path.startsWith("/notifications")) return "알림";
  if (path === "/reviews/moderation") return "리뷰 검토";
  if (path === "/reviews/notifications") return "리뷰 운영 알림";
  if (path.startsWith("/reviews")) return "리뷰";
  return "관리자";
}
