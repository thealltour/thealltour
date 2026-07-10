import {
  Bell,
  CalendarCheck,
  Gift,
  LayoutDashboard,
  MessageSquare,
  Star,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type MyPageNavIconKey =
  | "dashboard"
  | "points"
  | "points-request"
  | "rewards"
  | "redemptions"
  | "bookings"
  | "reviews"
  | "notifications"
  | "profile";

const ICON_MAP: Record<MyPageNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  points: Wallet,
  "points-request": Wallet,
  rewards: Gift,
  redemptions: Gift,
  bookings: CalendarCheck,
  reviews: Star,
  notifications: Bell,
  profile: User,
};

const HREF_TO_KEY: Record<string, MyPageNavIconKey> = {
  "/mypage/dashboard": "dashboard",
  "/mypage/points": "points",
  "/mypage/points/request": "points-request",
  "/mypage/rewards": "rewards",
  "/mypage/redemptions": "redemptions",
  "/mypage/bookings": "bookings",
  "/mypage/reviews": "reviews",
  "/mypage/notifications": "notifications",
  "/mypage/profile": "profile",
};

export function resolveMyPageNavIconKey(href: string): MyPageNavIconKey {
  return HREF_TO_KEY[href] ?? "dashboard";
}

type MyPageNavIconProps = {
  iconKey: MyPageNavIconKey;
  className?: string;
};

export function MyPageNavIcon({ iconKey, className }: MyPageNavIconProps) {
  const Icon = ICON_MAP[iconKey] ?? LayoutDashboard;
  return <Icon className={cn("size-4 shrink-0", className)} aria-hidden />;
}

export const MYPAGE_QUICK_ACTIONS = [
  { href: "/mypage/bookings", label: "내 예약", iconKey: "bookings" as const, description: "예약·결제" },
  { href: "/mypage/points", label: "포인트", iconKey: "points" as const, description: "잔액·내역" },
  { href: "/mypage/reviews", label: "리뷰", iconKey: "reviews" as const, description: "작성·관리" },
  { href: "/mypage/rewards", label: "리워드", iconKey: "rewards" as const, description: "교환·신청" },
] as const;

export { MessageSquare };
