import type {
  PlannerBudgetScope,
  PlannerBudgetStyle,
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerInterest,
  PlannerPace,
} from "@/types/planner";
import {
  PLANNER_DURATION_DAYS_MAX,
  PLANNER_DURATION_DAYS_MIN,
} from "@/lib/planner/dates";

export const PLANNER_COMPANION_OPTIONS: ReadonlyArray<{
  value: PlannerCompanionType;
  label: string;
}> = [
  { value: "solo", label: "혼자" },
  { value: "couple", label: "연인" },
  { value: "friends", label: "친구" },
  { value: "family", label: "가족" },
  { value: "parents", label: "부모님" },
  { value: "with_children", label: "아이와" },
] as const;

export const PLANNER_INTEREST_OPTIONS: ReadonlyArray<{
  value: PlannerInterest;
  label: string;
}> = [
  { value: "food", label: "맛집" },
  { value: "sightseeing", label: "관광" },
  { value: "shopping", label: "쇼핑" },
  { value: "relaxation", label: "휴양" },
  { value: "nature", label: "자연" },
  { value: "culture", label: "문화" },
  { value: "activity", label: "액티비티" },
  { value: "night_view", label: "야경" },
] as const;

export const PLANNER_PACE_OPTIONS: ReadonlyArray<{
  value: PlannerPace;
  label: string;
  description: string;
}> = [
  { value: "relaxed", label: "여유롭게", description: "핵심 장소 위주로 쉬는 시간을 넉넉히" },
  { value: "balanced", label: "균형 있게", description: "관광·식사·휴식을 적당히 배분" },
  { value: "packed", label: "알차게", description: "하루 시간을 적극 활용해 더 많은 경험" },
] as const;

export const PLANNER_BUDGET_SCOPE_OPTIONS: ReadonlyArray<{
  value: PlannerBudgetScope;
  label: string;
}> = [
  { value: "per_person", label: "1인 기준" },
  { value: "total", label: "전체 기준" },
] as const;

export const PLANNER_BUDGET_STYLE_OPTIONS: ReadonlyArray<{
  value: PlannerBudgetStyle | "undecided" | "custom";
  label: string;
}> = [
  { value: "undecided", label: "아직 미정" },
  { value: "budget", label: "가성비" },
  { value: "standard", label: "보통" },
  { value: "premium", label: "여유 있게" },
  { value: "custom", label: "직접 입력" },
] as const;

/** Static popular destinations — never labeled as realtime trending. */
export const PLANNER_POPULAR_DESTINATIONS: ReadonlyArray<{
  label: string;
  emoji: string;
}> = [
  { label: "오사카", emoji: "🇯🇵" },
  { label: "다낭", emoji: "🇻🇳" },
  { label: "후쿠오카", emoji: "🇯🇵" },
  { label: "방콕", emoji: "🇹🇭" },
  { label: "타이베이", emoji: "🇹🇼" },
] as const;

export const PLANNER_DURATION_QUICK_OPTIONS = [2, 3, 4, 5, 6, 7] as const;

export const PLANNER_QUICK_REQUESTS: ReadonlyArray<{
  id: string;
  label: string;
  insertText: string;
}> = [
  {
    id: "less_walking",
    label: "많이 걷지 않기",
    insertText: "많이 걷지 않는 일정으로 구성해주세요.",
  },
  {
    id: "less_transfer",
    label: "이동시간 줄이기",
    insertText: "장소 간 이동시간이 길지 않도록 동선을 구성해주세요.",
  },
  {
    id: "slow_morning",
    label: "아침 일정 여유롭게",
    insertText: "아침 일정은 너무 이르게 시작하지 않도록 구성해주세요.",
  },
  {
    id: "avoid_late_night",
    label: "밤늦은 일정 피하기",
    insertText: "밤늦게까지 이어지는 일정은 피해주세요.",
  },
  {
    id: "free_time",
    label: "자유시간 확보",
    insertText: "일정 중 자유시간을 충분히 확보해주세요.",
  },
  {
    id: "fewer_transitions",
    label: "장소 이동 적게",
    insertText: "하루에 장소를 자주 옮기지 않도록 일정을 구성해주세요.",
  },
] as const;

/** KRW slider bounds for custom budget entry (not style presets). Text input may exceed max. */
export const PLANNER_BUDGET_SLIDER_MIN = 300_000;
export const PLANNER_BUDGET_SLIDER_MAX = 50_000_000;
export const PLANNER_BUDGET_SLIDER_STEP = 100_000;

export const PLANNER_WIZARD_STEP_COUNT = 7;

export const PLANNER_WIZARD_TITLES: Record<number, string> = {
  1: "출발지와 목적지를 알려주세요",
  2: "언제 떠나시나요?",
  3: "누구와 함께 가시나요?",
  4: "어떤 여행을 원하세요?",
  5: "여행 속도와 예산은요?",
  6: "일정 조건",
  7: "입력하신 조건을 확인해주세요",
};

export {
  PLANNER_DURATION_DAYS_MIN,
  PLANNER_DURATION_DAYS_MAX,
};

export function createEmptyPlannerDraftInput(
  destinationText = "",
  originText = "",
): PlannerDraftInput {
  return {
    origin: { text: originText.trim() },
    destination: { text: destinationText.trim() },
    dates: {
      mode: "fixed",
      startDate: null,
      endDate: null,
      durationDays: 3,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "friends",
    interests: [],
    themeRequest: "",
    pace: "balanced",
    budget: { style: null, amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
  };
}

/** Append quick-request text without duplicating an existing phrase. */
export function appendPlannerQuickRequest(
  current: string,
  insertText: string,
): string {
  const trimmedInsert = insertText.trim();
  if (!trimmedInsert) return current;
  if (current.includes(trimmedInsert)) return current;
  const base = current.trim();
  if (!base) return trimmedInsert;
  const separator = /[.!?…。]$/.test(base) ? " " : ". ";
  const next = `${base}${separator}${trimmedInsert}`;
  return next.slice(0, 1000);
}
