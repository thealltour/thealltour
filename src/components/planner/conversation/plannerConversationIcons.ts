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
  MapPinned,
  MessageSquareText,
  MoonStar,
  PiggyBank,
  Plane,
  Route,
  Scale,
  ShoppingBag,
  Sparkles,
  Star,
  Sunrise,
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

/** Restrained category tones for Planner choice icons (meaning only — not selected state). */
export type PlannerVisualTone =
  | "blue"
  | "rose"
  | "violet"
  | "amber"
  | "emerald"
  | "teal"
  | "indigo"
  | "sky"
  | "slate";

export type PlannerIconToneClasses = {
  container: string;
  icon: string;
};

export type PlannerIconVisual = {
  icon: PlannerConversationIcon;
  tone: PlannerVisualTone;
};

export const PLANNER_ICON_TONE_CLASSES: Record<PlannerVisualTone, PlannerIconToneClasses> = {
  blue: { container: "bg-blue-50", icon: "text-blue-600" },
  rose: { container: "bg-rose-50", icon: "text-rose-600" },
  violet: { container: "bg-violet-50", icon: "text-violet-600" },
  amber: { container: "bg-amber-50", icon: "text-amber-600" },
  emerald: { container: "bg-emerald-50", icon: "text-emerald-600" },
  teal: { container: "bg-teal-50", icon: "text-teal-600" },
  indigo: { container: "bg-indigo-50", icon: "text-indigo-600" },
  sky: { container: "bg-sky-50", icon: "text-sky-600" },
  slate: { container: "bg-slate-100", icon: "text-slate-600" },
};

export function getPlannerIconToneClasses(tone: PlannerVisualTone): PlannerIconToneClasses {
  return PLANNER_ICON_TONE_CLASSES[tone];
}

/** Step 7 confirmation row icons (category meaning — not choice chips). */
export const SUMMARY_SECTION_VISUALS: Record<
  "destination" | "dates" | "companions" | "themes" | "budget" | "request",
  PlannerIconVisual
> = {
  destination: { icon: Plane, tone: "blue" },
  dates: { icon: CalendarDays, tone: "violet" },
  companions: { icon: Users, tone: "rose" },
  themes: { icon: Sparkles, tone: "amber" },
  budget: { icon: Scale, tone: "teal" },
  request: { icon: MessageSquareText, tone: "slate" },
};

export const COMPANION_VISUALS: Record<PlannerCompanionType, PlannerIconVisual> = {
  solo: { icon: User, tone: "blue" },
  couple: { icon: Heart, tone: "rose" },
  friends: { icon: Users, tone: "violet" },
  family: { icon: House, tone: "amber" },
  parents: { icon: HeartHandshake, tone: "emerald" },
  with_children: { icon: Baby, tone: "sky" },
};

export const INTEREST_VISUALS: Record<PlannerInterest, PlannerIconVisual> = {
  food: { icon: Utensils, tone: "amber" },
  sightseeing: { icon: Camera, tone: "blue" },
  shopping: { icon: ShoppingBag, tone: "violet" },
  relaxation: { icon: Coffee, tone: "slate" },
  nature: { icon: Trees, tone: "emerald" },
  culture: { icon: Landmark, tone: "indigo" },
  activity: { icon: Waves, tone: "teal" },
  night_view: { icon: MoonStar, tone: "violet" },
};

export const THEME_MOOD_VISUALS: Record<string, PlannerIconVisual> = {
  "현지 분위기": { icon: Compass, tone: "teal" },
  "사진 찍기 좋은 곳": { icon: Camera, tone: "violet" },
  "대표 명소 중심": { icon: Star, tone: "amber" },
  "사람 적은 곳": { icon: UserRound, tone: "slate" },
  "감성적인 곳": { icon: Heart, tone: "rose" },
};

export const PACE_VISUALS: Record<PlannerPace, PlannerIconVisual> = {
  relaxed: { icon: Coffee, tone: "amber" },
  balanced: { icon: Scale, tone: "blue" },
  packed: { icon: Zap, tone: "violet" },
};

export const BUDGET_STYLE_VISUALS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  PlannerIconVisual
> = {
  undecided: { icon: CircleHelp, tone: "slate" },
  budget: { icon: PiggyBank, tone: "emerald" },
  standard: { icon: WalletCards, tone: "blue" },
  premium: { icon: Sparkles, tone: "violet" },
  custom: { icon: BadgeDollarSign, tone: "amber" },
};

export const QUICK_REQUEST_VISUALS: Record<string, PlannerIconVisual> = {
  less_walking: { icon: Footprints, tone: "slate" },
  less_transfer: { icon: Route, tone: "blue" },
  slow_morning: { icon: Sunrise, tone: "amber" },
  avoid_late_night: { icon: MoonStar, tone: "violet" },
  free_time: { icon: Coffee, tone: "teal" },
  fewer_transitions: { icon: MapPinned, tone: "emerald" },
};

export const DATE_MODE_VISUALS = {
  fixed: { icon: CalendarDays, tone: "blue" as const },
  flexible: { icon: CalendarClock, tone: "violet" as const },
} satisfies Record<"fixed" | "flexible", PlannerIconVisual>;

export const BUDGET_STYLE_DESCRIPTIONS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  string
> = {
  undecided: "플랜을 먼저 받아볼게요",
  budget: "숙소·식사·이동에서 합리적인 선택 위주",
  standard: "가격과 위치·편의의 균형",
  premium: "편의와 경험에 조금 더 투자",
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

/** @deprecated Prefer *_VISUALS — kept for any residual icon-only imports. */
export const COMPANION_ICONS: Record<PlannerCompanionType, PlannerConversationIcon> = {
  solo: COMPANION_VISUALS.solo.icon,
  couple: COMPANION_VISUALS.couple.icon,
  friends: COMPANION_VISUALS.friends.icon,
  family: COMPANION_VISUALS.family.icon,
  parents: COMPANION_VISUALS.parents.icon,
  with_children: COMPANION_VISUALS.with_children.icon,
};

export const INTEREST_ICONS: Record<PlannerInterest, PlannerConversationIcon> = {
  food: INTEREST_VISUALS.food.icon,
  sightseeing: INTEREST_VISUALS.sightseeing.icon,
  shopping: INTEREST_VISUALS.shopping.icon,
  relaxation: INTEREST_VISUALS.relaxation.icon,
  nature: INTEREST_VISUALS.nature.icon,
  culture: INTEREST_VISUALS.culture.icon,
  activity: INTEREST_VISUALS.activity.icon,
  night_view: INTEREST_VISUALS.night_view.icon,
};

export const THEME_MOOD_ICONS: Record<string, PlannerConversationIcon> = {
  "현지 분위기": THEME_MOOD_VISUALS["현지 분위기"]!.icon,
  "사진 찍기 좋은 곳": THEME_MOOD_VISUALS["사진 찍기 좋은 곳"]!.icon,
  "대표 명소 중심": THEME_MOOD_VISUALS["대표 명소 중심"]!.icon,
  "사람 적은 곳": THEME_MOOD_VISUALS["사람 적은 곳"]!.icon,
  "감성적인 곳": THEME_MOOD_VISUALS["감성적인 곳"]!.icon,
};

export const PACE_ICONS: Record<PlannerPace, PlannerConversationIcon> = {
  relaxed: PACE_VISUALS.relaxed.icon,
  balanced: PACE_VISUALS.balanced.icon,
  packed: PACE_VISUALS.packed.icon,
};

export const BUDGET_STYLE_ICONS: Record<
  PlannerBudgetStyle | "undecided" | "custom",
  PlannerConversationIcon
> = {
  undecided: BUDGET_STYLE_VISUALS.undecided.icon,
  budget: BUDGET_STYLE_VISUALS.budget.icon,
  standard: BUDGET_STYLE_VISUALS.standard.icon,
  premium: BUDGET_STYLE_VISUALS.premium.icon,
  custom: BUDGET_STYLE_VISUALS.custom.icon,
};

export const QUICK_REQUEST_ICONS: Record<string, PlannerConversationIcon> = {
  less_walking: QUICK_REQUEST_VISUALS.less_walking!.icon,
  less_transfer: QUICK_REQUEST_VISUALS.less_transfer!.icon,
  slow_morning: QUICK_REQUEST_VISUALS.slow_morning!.icon,
  avoid_late_night: QUICK_REQUEST_VISUALS.avoid_late_night!.icon,
  free_time: QUICK_REQUEST_VISUALS.free_time!.icon,
  fewer_transitions: QUICK_REQUEST_VISUALS.fewer_transitions!.icon,
};

export const DATE_MODE_ICONS = {
  fixed: DATE_MODE_VISUALS.fixed.icon,
  flexible: DATE_MODE_VISUALS.flexible.icon,
} as const;
