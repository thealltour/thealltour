/**
 * 데스크톱 사이드바 항목. 모바일 허용 메뉴는 `mobile/mobileAdmin.constants.ts`에서 별도 관리합니다.
 */
import type { MainMenuKey } from "@/components/admin/SubHeader";
import type { AdminRole } from "@/types/adminRole";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Users,
  Settings,
  Star,
  BookOpen,
  Image as ImageIcon,
  Megaphone,
  Bell,
  Gift,
  Coins,
  BarChart2,
} from "lucide-react";

export type SidebarItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: "main" | "extra";
  mainKey?: MainMenuKey;
  roles: AdminRole[];
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    href: "/theall_manager_only",
    label: "대시보드",
    icon: LayoutDashboard,
    section: "main",
    mainKey: "dashboard",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/products",
    label: "상품 관리",
    icon: Package,
    section: "main",
    mainKey: "product",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/inquiries",
    label: "문의 관리",
    icon: MessageSquare,
    section: "main",
    mainKey: "inquiry",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/inquiries/dashboard",
    label: "문의 운영",
    icon: BarChart2,
    section: "main",
    mainKey: "inquiry_dashboard",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/members",
    label: "회원 관리",
    icon: Users,
    section: "main",
    mainKey: "member",
    roles: ["admin"],
  },
  {
    href: "/theall_manager_only/rewards",
    label: "리워드 교환 관리",
    icon: Gift,
    section: "main",
    mainKey: "rewards",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/points",
    label: "포인트 지급 관리",
    icon: Coins,
    section: "main",
    mainKey: "points",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/settings",
    label: "환경설정",
    icon: Settings,
    section: "extra",
    roles: ["admin"],
  },
  {
    href: "/admin/reviews",
    label: "후기 관리",
    icon: Star,
    section: "extra",
    mainKey: "reviews",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/guides",
    label: "여행가이드",
    icon: BookOpen,
    section: "extra",
    roles: ["admin", "manager", "viewer"],
  },
  {
    href: "/theall_manager_only/banners",
    label: "메인배너",
    icon: ImageIcon,
    section: "extra",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/notices",
    label: "공지사항",
    icon: Megaphone,
    section: "extra",
    roles: ["admin", "manager"],
  },
  {
    href: "/theall_manager_only/notifications",
    label: "알림",
    icon: Bell,
    section: "extra",
    roles: ["admin", "manager", "viewer"],
  },
];
