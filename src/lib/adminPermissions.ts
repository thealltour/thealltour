import type { AdminRole } from "@/types/adminRole";

/** 관리자 권한 키 — 메뉴·API와 1:1 매핑 */
export const ADMIN_PERMISSION_KEYS = [
  "dashboard.view",
  "inquiries.manage",
  "members.manage",
  "points.manage",
  "rewards.manage",
  "products.manage",
  "home.manage",
  "landings.manage",
  "reviews.ops",
  "reviews.analytics",
  "guides.manage",
  "notices.manage",
  "notifications.view",
  "tools.view",
  "settings.manage",
  "admin_users.manage",
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  "dashboard.view": "대시보드",
  "inquiries.manage": "문의·상담",
  "members.manage": "회원 목록",
  "points.manage": "포인트·적립",
  "rewards.manage": "리워드 교환",
  "products.manage": "상품",
  "home.manage": "홈·배너",
  "landings.manage": "랜딩·유입·골프 리드",
  "reviews.ops": "후기 운영",
  "reviews.analytics": "후기 분석·고급",
  "guides.manage": "여행가이드",
  "notices.manage": "공지사항",
  "notifications.view": "알림 센터",
  "tools.view": "도구·익스텐션",
  "settings.manage": "환경설정",
  "admin_users.manage": "관리자 계정 (총괄 전용)",
};

export type AdminRolePresetId = "manager" | "viewer" | "cs_lead" | "marketing" | "custom";

export const ADMIN_ROLE_PRESETS: Array<{
  id: AdminRolePresetId;
  label: string;
  description: string;
  permissions: AdminPermissionKey[];
}> = [
  {
    id: "manager",
    label: "운영 매니저",
    description: "문의·상품·랜딩·포인트·후기 운영 등 일상 업무",
    permissions: [
      "dashboard.view",
      "inquiries.manage",
      "products.manage",
      "home.manage",
      "landings.manage",
      "points.manage",
      "rewards.manage",
      "reviews.ops",
      "guides.manage",
      "notices.manage",
      "notifications.view",
      "tools.view",
    ],
  },
  {
    id: "viewer",
    label: "열람 전용",
    description: "대시보드·후기·가이드·알림 조회",
    permissions: [
      "dashboard.view",
      "reviews.ops",
      "reviews.analytics",
      "guides.manage",
      "notifications.view",
    ],
  },
  {
    id: "cs_lead",
    label: "CS 리드",
    description: "문의·회원·후기 운영 중심",
    permissions: [
      "dashboard.view",
      "inquiries.manage",
      "members.manage",
      "notifications.view",
      "reviews.ops",
    ],
  },
  {
    id: "marketing",
    label: "마케팅",
    description: "랜딩·홈 노출·후기 분석",
    permissions: [
      "dashboard.view",
      "landings.manage",
      "home.manage",
      "reviews.analytics",
    ],
  },
  {
    id: "custom",
    label: "직접 설정",
    description: "권한을 개별 선택합니다",
    permissions: [],
  },
];

export type AdminSessionPermissions = {
  role: AdminRole;
  permissions: string[];
  isBootstrapAdmin: boolean;
  adminUserId?: string;
  username?: string;
};

export function getPresetPermissions(presetId: AdminRolePresetId): AdminPermissionKey[] {
  const preset = ADMIN_ROLE_PRESETS.find((p) => p.id === presetId);
  return preset ? [...preset.permissions] : [];
}

/** DB 하위 관리자에게 부여 불가 */
export const BOOTSTRAP_ONLY_PERMISSIONS: AdminPermissionKey[] = ["admin_users.manage"];

export function sanitizeSubAdminPermissions(permissions: string[]): AdminPermissionKey[] {
  const allowed = new Set(ADMIN_PERMISSION_KEYS);
  return permissions.filter(
    (p): p is AdminPermissionKey =>
      allowed.has(p as AdminPermissionKey) && !BOOTSTRAP_ONLY_PERMISSIONS.includes(p as AdminPermissionKey),
  );
}

export function hasAdminPermission(
  session: Pick<AdminSessionPermissions, "permissions" | "isBootstrapAdmin">,
  key: AdminPermissionKey | string,
): boolean {
  if (session.isBootstrapAdmin) return true;
  if (session.permissions.includes("*")) return true;
  return session.permissions.includes(key);
}

export function hasAnyAdminPermission(
  session: Pick<AdminSessionPermissions, "permissions" | "isBootstrapAdmin">,
  keys: AdminPermissionKey[],
): boolean {
  return keys.some((k) => hasAdminPermission(session, k));
}

/** preset → legacy AdminRole (하위 호환) */
export function deriveLegacyRoleFromPermissions(
  permissions: string[],
  isBootstrapAdmin: boolean,
): AdminRole {
  if (isBootstrapAdmin || permissions.includes("*")) return "admin";
  if (permissions.includes("inquiries.manage") || permissions.includes("products.manage")) {
    return "manager";
  }
  return "viewer";
}

export function deriveLegacyRoleFromPreset(presetId: string): AdminRole {
  if (presetId === "viewer") return "viewer";
  if (presetId === "manager" || presetId === "cs_lead" || presetId === "marketing") return "manager";
  return "manager";
}
