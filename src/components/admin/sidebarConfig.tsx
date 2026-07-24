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
  Inbox,
  Users,
  Settings,
  Star,
  BookOpen,
  Megaphone,
  Bell,
  Home,
  CalendarDays,
  Puzzle,
  Smartphone,
} from "lucide-react";

export const SIDEBAR_GROUPS = [
  { id: "ops", label: "업무" },
  { id: "catalog", label: "상품·마케팅" },
  { id: "content", label: "콘텐츠·설정" },
  { id: "tools", label: "도구" },
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
    href: "/theall_manager_only/sms",
    label: "SMS 센터",
    icon: Inbox,
    group: "ops",
    mainKey: "sms",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/bookings",
    label: "예약 관리",
    icon: CalendarDays,
    group: "ops",
    mainKey: "bookings",
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
    href: "/theall_manager_only/products?view=home-golf-tour-cards",
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
    href: "/theall_manager_only/pwa",
    label: "앱으로 설치",
    icon: Smartphone,
    group: "content",
    mainKey: "pwa",
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
  {
    href: "/theall_manager_only/tools/hanatour",
    label: "하나투어 익스텐션",
    icon: Puzzle,
    group: "tools",
    mainKey: "tools_hanatour",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/tools/modetour",
    label: "모두투어 익스텐션",
    icon: Puzzle,
    group: "tools",
    mainKey: "tools_modetour",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/tools/thealltour-extension",
    label: "통합 익스텐션",
    icon: Puzzle,
    group: "tools",
    mainKey: "tools_thealltour_extension",
    roles: ["admin", "manager"],
  },
];
