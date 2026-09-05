import type {
  PlannerBudgetScope,
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerInterest,
  PlannerPace,
} from "@/types/planner";

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
  { value: "relaxed", label: "여유롭게", description: "쉬는 시간을 넉넉히" },
  { value: "balanced", label: "균형 있게", description: "관광과 휴식의 균형" },
  { value: "packed", label: "알차게", description: "하루를 최대한 활용" },
] as const;

export const PLANNER_BUDGET_SCOPE_OPTIONS: ReadonlyArray<{
  value: PlannerBudgetScope;
  label: string;
}> = [
  { value: "per_person", label: "1인 기준" },
  { value: "total", label: "전체 기준" },
] as const;

export const PLANNER_WIZARD_STEP_COUNT = 7;

export const PLANNER_WIZARD_TITLES: Record<number, string> = {
  1: "어디로 떠나고 싶으세요?",
  2: "언제 떠나시나요?",
  3: "누구와 함께 가시나요?",
  4: "어떤 여행을 원하세요?",
  5: "여행 속도와 예산은요?",
  6: "꼭 반영했으면 하는 내용이 있나요?",
  7: "입력하신 조건을 확인해주세요",
};

export function createEmptyPlannerDraftInput(destinationText = ""): PlannerDraftInput {
  return {
    destination: { text: destinationText.trim() },
    dates: { startDate: "", endDate: "" },
    travelers: { adults: 2, children: 0 },
    companionType: "friends",
    interests: [],
    pace: "balanced",
    budget: { amount: null, scope: "per_person", currency: "KRW" },
    additionalRequest: "",
  };
}
