/**
 * 데스크톱 사이드바 항목. 모바일 허용 메뉴는 `mobile/mobileAdmin.constants.ts`에서 별도 관리합니다.
 */
import type { MainMenuKey } from "@/components/admin/SubHeader";
import type { AdminRole } from "@/types/adminRole";
import {
  LayoutDashboard,
  Package,
  Search,
  MessageSquare,
  Users,
  Settings,
  Star,
  BookOpen,
  Megaphone,
  Bell,
  Home,
} from "lucide-react";

export const SIDEBAR_GROUPS = [
  { id: "ops", label: "업무" },
  { id: "catalog", label: "상품·마케팅" },
  { id: "content", label: "콘텐츠·설정" },
] as const;

export type SidebarGroupId = (typeof SIDEBAR_GROUPS)[number]["id"];

export type SidebarItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: SidebarGroupId;
  mainKey?: MainMenuKey;
  roles: AdminRole[];
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    href: "/theall_manager_only",
    label: "대시보드",
    icon: LayoutDashboard,
    group: "ops",
    mainKey: "dashboard",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/inquiries",
    label: "문의·상담",
    icon: MessageSquare,
    group: "ops",
    mainKey: "inquiry",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/members",
    label: "회원·리워드",
    icon: Users,
    group: "ops",
    mainKey: "member_rewards",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/reviews",
    label: "후기",
    icon: Star,
    group: "ops",
    mainKey: "reviews",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/products",
    label: "상품",
    icon: Package,
    group: "catalog",
    mainKey: "product",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/products?view=home-region-cards",
    label: "홈·배너 구성",
    icon: Home,
    group: "catalog",
    mainKey: "home",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/landings",
    label: "랜딩·유입",
    icon: Search,
    group: "catalog",
    mainKey: "landings",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/guides",
    label: "여행가이드",
    icon: BookOpen,
    group: "content",
    mainKey: "guides",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/notices",
    label: "공지사항",
    icon: Megaphone,
    group: "content",
    mainKey: "notices",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/notifications",
    label: "알림 센터",
    icon: Bell,
    group: "content",
    mainKey: "notifications",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/settings",
    label: "환경설정",
    icon: Settings,
    group: "content",
    mainKey: "settings",
    roles: ["admin"],
  },
];
