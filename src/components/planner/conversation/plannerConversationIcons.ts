import type { ComponentType } from "react";
import {
  Baby,
  BadgeDollarSign,
  CalendarClock,
  CalendarDays,
  Camera,
  CircleHelp,
  Coffee,
  Compass,
  Footprints,
  Heart,
  HeartHandshake,
  House,
  Landmark,
  MoonStar,
  PiggyBank,
  Scale,
  ShoppingBag,
  Sparkles,
  Star,
  Trees,
  User,
  UserRound,
  Users,
  Utensils,
  WalletCards,
  Waves,
  Zap,
} from "lucide-react";
import type {
  PlannerBudgetStyle,
  PlannerCompanionType,
  PlannerInterest,
  PlannerPace,
} from "@/types/planner";

export type PlannerConversationIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean;
}>;

export const COMPANION_ICONS: Record<PlannerCompanionType, PlannerConversationIcon> = {
  solo: User,
  couple: Heart,
  friends: Users,
  family: House,
  parents: HeartHandshake,
  with_children: Baby,
};

export const INTEREST_ICONS: Record<PlannerInterest, PlannerConversationIcon> = {
  food: Utensils,
  sightseeing: Camera,
  shopping: ShoppingBag,
  relaxation: Coffee,
  nature: Trees,
  culture: Landmark,
  activity: Waves,
  night_view: MoonStar,
};

export const THEME_MOOD_ICONS: Record<string, PlannerConversationIcon> = {
  "현지 분위기": Compass,
  "사진 찍기 좋은 곳": Camera,
  "대표 명소 중심": Star,
  "사람 적은 곳": UserRound,
  "감성적인 곳": Heart,
};

export const PACE_ICONS: Record<PlannerPace, PlannerConversationIcon> = {
  relaxed: Coffee,
  balanced: Scale,
  packed: Zap,
};

export const BUDGET_STYLE_ICONS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  PlannerConversationIcon
> = {
  undecided: CircleHelp,
  budget: PiggyBank,
  standard: WalletCards,
  premium: Sparkles,
  custom: BadgeDollarSign,
};

export const BUDGET_STYLE_DESCRIPTIONS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  string
> = {
  undecided: "플랜을 먼저 받아볼게요",
  budget: "비용을 아끼는 방향",
  standard: "일반적인 여행 예산",
  premium: "편의와 경험을 조금 더",
  custom: "직접 예산 입력",
};

export const BUDGET_STYLE_DISPLAY_LABELS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  string
> = {
  undecided: "아직 모르겠어요",
  budget: "가성비 있게",
  standard: "보통 수준",
  premium: "조금 여유롭게",
  custom: "금액을 정했어요",
};

export const QUICK_REQUEST_ICONS: Record<string, PlannerConversationIcon> = {
  less_walking: Footprints,
  with_kids: Baby,
  with_parents: HeartHandshake,
  shopping_time: ShoppingBag,
  food_focus: Utensils,
  rest_enough: Coffee,
};

export const DATE_MODE_ICONS = {
  fixed: CalendarDays,
  flexible: CalendarClock,
} as const;
