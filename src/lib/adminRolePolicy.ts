import type { AdminPermissionKey } from "@/lib/adminPermissions";
import { hasAdminPermission, type AdminSessionPermissions } from "@/lib/adminPermissions";
import type { AdminRole } from "@/types/adminRole";

/** API 경로 → 필요 권한 (bootstrap admin은 hasAdminPermission에서 bypass) */
const API_PATH_PERMISSIONS: Array<{ prefix: string; permission: AdminPermissionKey }> = [
  { prefix: "/api/admin/admin-users", permission: "admin_users.manage" },
  { prefix: "/api/admin/members", permission: "members.manage" },
  { prefix: "/api/admin/site-settings", permission: "settings.manage" },
  { prefix: "/api/admin/legal-documents", permission: "settings.manage" },
  { prefix: "/api/admin/hero-content", permission: "settings.manage" },
  { prefix: "/api/admin/terms-templates", permission: "settings.manage" },
  { prefix: "/api/admin/notice-templates", permission: "settings.manage" },
  { prefix: "/api/admin/inquiries", permission: "inquiries.manage" },
  { prefix: "/api/admin/bookings", permission: "inquiries.manage" },
  { prefix: "/api/admin/sms", permission: "inquiries.manage" },
  { prefix: "/api/admin/inbound-sms", permission: "inquiries.manage" },
  { prefix: "/api/admin/points", permission: "points.manage" },
  { prefix: "/api/admin/reward", permission: "rewards.manage" },
  { prefix: "/api/admin/rewards", permission: "rewards.manage" },
  { prefix: "/api/admin/products", permission: "products.manage" },
  { prefix: "/api/admin/threads", permission: "products.manage" },
  { prefix: "/api/admin/product-taxonomies", permission: "products.manage" },
  { prefix: "/api/admin/banners", permission: "home.manage" },
  { prefix: "/api/admin/home-curated", permission: "home.manage" },
  { prefix: "/api/admin/landings", permission: "landings.manage" },
  { prefix: "/api/admin/golf-leads", permission: "landings.manage" },
  { prefix: "/api/admin/flyers", permission: "landings.manage" },
  { prefix: "/api/admin/guides", permission: "guides.manage" },
  { prefix: "/api/admin/blog", permission: "products.manage" },
  { prefix: "/api/admin/notices", permission: "notices.manage" },
  { prefix: "/api/admin/notifications", permission: "notifications.view" },
  { prefix: "/api/admin/push-subscriptions", permission: "notifications.view" },
  { prefix: "/api/admin/sessions", permission: "notifications.view" },
  { prefix: "/api/admin/review-summaries", permission: "reviews.analytics" },
  { prefix: "/api/admin/review-reports", permission: "reviews.ops" },
  { prefix: "/api/admin/review-reminders", permission: "reviews.ops" },
  { prefix: "/api/admin/reviews/summary", permission: "reviews.ops" },
  { prefix: "/api/admin/reviews/analytics", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews/anomalies", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews/authors", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews/conversions", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews/experiments", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews/insights", permission: "reviews.analytics" },
  { prefix: "/api/admin/reviews", permission: "reviews.ops" },
  { prefix: "/api/admin/dashboard", permission: "dashboard.view" },
  { prefix: "/api/admin/search/recommended", permission: "settings.manage" },
  { prefix: "/api/admin/search", permission: "dashboard.view" },
  { prefix: "/api/admin/modetour", permission: "products.manage" },
  { prefix: "/api/admin/hanatour", permission: "products.manage" },
  { prefix: "/api/admin/uploads", permission: "products.manage" },
  { prefix: "/api/admin/storage", permission: "settings.manage" },
  { prefix: "/api/admin/tools", permission: "tools.view" },
  { prefix: "/api/admin/ai-runtime", permission: "settings.manage" },
  { prefix: "/api/admin/marketing-review", permission: "settings.manage" },
  { prefix: "/api/admin/chat", permission: "dashboard.view" },
];

/** UI 상대 경로(rel) → 필요 권한 (하나라도 있으면 허용하는 그룹은 anyOf) */
const CONSOLE_PATH_RULES: Array<{
  test: (rel: string) => boolean;
  anyOf: AdminPermissionKey[];
}> = [
  { test: (r) => r === "/" || r === "", anyOf: ["dashboard.view"] },
  { test: (r) => r === "/pwa" || r.startsWith("/pwa/"), anyOf: ["dashboard.view"] },
  { test: (r) => r.startsWith("/inquiries") || r.startsWith("/bookings"), anyOf: ["inquiries.manage"] },
  { test: (r) => r.startsWith("/sms") || r.startsWith("/inbound-sms"), anyOf: ["inquiries.manage"] },
  { test: (r) => r.startsWith("/members"), anyOf: ["members.manage"] },
  { test: (r) => r.startsWith("/points"), anyOf: ["points.manage", "members.manage"] },
  { test: (r) => r.startsWith("/rewards"), anyOf: ["rewards.manage", "points.manage"] },
  { test: (r) => r.startsWith("/products"), anyOf: ["products.manage", "home.manage"] },
  { test: (r) => r.startsWith("/banners"), anyOf: ["home.manage"] },
  { test: (r) => r.startsWith("/landings") || r.startsWith("/golf-leads") || r.startsWith("/flyers"), anyOf: ["landings.manage"] },
  {
    test: (r) =>
      r.startsWith("/reviews/analytics") ||
      r.startsWith("/reviews/anomalies") ||
      r.startsWith("/reviews/authors") ||
      r.startsWith("/reviews/conversions") ||
      r.startsWith("/reviews/experiments") ||
      r.startsWith("/reviews/insights") ||
      r.startsWith("/review-summaries"),
    anyOf: ["reviews.analytics"],
  },
  {
    test: (r) =>
      r === "/reviews" ||
      r.startsWith("/reviews/") ||
      r.startsWith("/review-reports") ||
      r.startsWith("/review-reminders"),
    anyOf: ["reviews.ops", "reviews.analytics"],
  },
  { test: (r) => r.startsWith("/guides"), anyOf: ["guides.manage"] },
  { test: (r) => r.startsWith("/blog"), anyOf: ["products.manage"] },
  { test: (r) => r.startsWith("/notices"), anyOf: ["notices.manage"] },
  { test: (r) => r.startsWith("/notifications"), anyOf: ["notifications.view"] },
  { test: (r) => r.startsWith("/tools"), anyOf: ["tools.view"] },
  { test: (r) => r.startsWith("/ai-runtime") || r.startsWith("/marketing-review"), anyOf: ["settings.manage"] },
  { test: (r) => r.startsWith("/settings"), anyOf: ["settings.manage", "admin_users.manage"] },
  { test: (r) => r === "/login", anyOf: ["dashboard.view"] },
];

function permissionAllowed(session: AdminSessionPermissions, keys: AdminPermissionKey[]): boolean {
  return keys.some((k) => hasAdminPermission(session, k));
}

export function isInquiriesApiPath(pathname: string): boolean {
  return pathname === "/api/inquiries" || pathname.startsWith("/api/inquiries/");
}

function resolveApiPermission(pathname: string): AdminPermissionKey | null {
  for (const rule of API_PATH_PERMISSIONS) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.permission;
    }
  }
  if (pathname.startsWith("/api/admin")) {
    return "settings.manage";
  }
  return null;
}

export function isSessionAllowedForApiPath(session: AdminSessionPermissions, pathname: string): boolean {
  if (session.isBootstrapAdmin) return true;

  if (isInquiriesApiPath(pathname)) {
    return hasAdminPermission(session, "inquiries.manage");
  }

  const required = resolveApiPermission(pathname);
  if (required == null) return false;
  return hasAdminPermission(session, required);
}

export function isSessionAllowedForConsolePath(session: AdminSessionPermissions, rel: string): boolean {
  if (session.isBootstrapAdmin) return true;
  const path = rel === "" ? "/" : rel;
  if (path === "/login") return true;

  for (const rule of CONSOLE_PATH_RULES) {
    if (rule.test(path)) {
      return permissionAllowed(session, rule.anyOf);
    }
  }
  return false;
}

/** @deprecated isSessionAllowedForConsolePath 사용 */
export function isRoleAllowedForConsolePath(role: AdminRole, rel: string): boolean {
  if (role === "admin") return true;
  const path = rel === "" ? "/" : rel;
  if (path === "/login") return true;
  if (role === "viewer") {
    if (path === "/" || path.startsWith("/reviews") || path.startsWith("/review-")) return true;
    if (path.startsWith("/guides") || path.startsWith("/notifications")) return true;
    return false;
  }
  if (path.startsWith("/members") || path.startsWith("/settings")) return false;
  return true;
}

export function getDefaultLandingPathForSession(session: AdminSessionPermissions): string {
  if (hasAdminPermission(session, "inquiries.manage")) {
    return "/theall_manager_only/inquiries?status=pending";
  }
  if (hasAdminPermission(session, "reviews.ops") || hasAdminPermission(session, "reviews.analytics")) {
    return "/theall_manager_only/reviews";
  }
  return "/theall_manager_only";
}

/** @deprecated getDefaultLandingPathForSession 사용 */
export function getDefaultLandingPathForRole(role: AdminRole): string {
  switch (role) {
    case "manager":
      return "/theall_manager_only/inquiries?status=pending";
    case "viewer":
      return "/theall_manager_only/reviews";
    default:
      return "/theall_manager_only";
  }
}

export type MobileNavKey = "dashboard" | "inquiries" | "members" | "sms" | "notifications";

export function getMobileNavKeysForSession(session: AdminSessionPermissions): MobileNavKey[] {
  const keys: MobileNavKey[] = [];
  if (hasAdminPermission(session, "dashboard.view")) keys.push("dashboard");
  if (hasAdminPermission(session, "inquiries.manage")) keys.push("inquiries");
  if (hasAdminPermission(session, "members.manage")) keys.push("members");
  if (hasAdminPermission(session, "inquiries.manage")) keys.push("sms");
  if (hasAdminPermission(session, "notifications.view")) keys.push("notifications");
  return keys;
}

/** @deprecated getMobileNavKeysForSession 사용 */
export function getMobileNavKeysForRole(role: AdminRole): MobileNavKey[] {
  if (role === "viewer") return ["dashboard", "notifications"];
  if (role === "manager") return ["dashboard", "inquiries", "sms", "notifications"];
  return ["dashboard", "inquiries", "members", "sms", "notifications"];
}

/** sidebar 항목별 필요 권한 */
export const SIDEBAR_PERMISSION_MAP: Record<string, AdminPermissionKey[]> = {
  dashboard: ["dashboard.view"],
  inquiry: ["inquiries.manage"],
  bookings: ["inquiries.manage"],
  sms: ["inquiries.manage"],
  member_rewards: ["members.manage", "points.manage", "rewards.manage"],
  reviews: ["reviews.ops", "reviews.analytics"],
  product: ["products.manage"],
  home: ["home.manage"],
  landings: ["landings.manage"],
  guides: ["guides.manage"],
  blog: ["products.manage"],
  notices: ["notices.manage"],
  notifications: ["notifications.view"],
  pwa: ["dashboard.view"],
  tools_modetour: ["tools.view"],
  tools_thealltour_extension: ["tools.view"],
  tools_ai_runtime: ["settings.manage"],
  tools_marketing_review: ["settings.manage"],
  settings: ["settings.manage", "admin_users.manage"],
};

export function canAccessSidebarMainKey(
  session: AdminSessionPermissions,
  mainKey: string,
): boolean {
  if (session.isBootstrapAdmin) return true;
  const perms = SIDEBAR_PERMISSION_MAP[mainKey];
  if (!perms) return false;
  return permissionAllowed(session, perms);
}

/** @deprecated */
export function isRoleAllowedForApiPath(_role: AdminRole, _pathname: string): boolean {
  return true;
}
