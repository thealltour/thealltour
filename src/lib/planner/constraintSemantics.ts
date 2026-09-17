import { PLANNER_QUICK_REQUESTS } from "@/lib/planner/constants";
import type { PlannerBudgetStyle, PlannerDraftInput, PlannerInterest } from "@/types/planner";

export type PlannerKnownConstraintId =
  | "less_walking"
  | "less_transfer"
  | "slow_morning"
  | "avoid_late_night"
  | "free_time"
  | "fewer_transitions";

/** Canonical AI-facing rules keyed by quick-request id (UI insertText remains source of selection). */
export const PLANNER_CONSTRAINT_SEMANTICS: Record<
  PlannerKnownConstraintId,
  ReadonlyArray<string>
> = {
  less_walking: [
    "긴 도보 구간을 연속 배치하지 말고, 가까운 장소를 같은 지역으로 묶습니다.",
    "대중교통·택시 등 현실적인 이동수단을 활용하되, km/분 수치를 지도 없이 날조하지 않습니다.",
    "보행 부담을 줄이는 신호이며 itinerary item 수를 무조건 줄이라는 뜻이 아닙니다.",
  ],
  less_transfer: [
    "가까운 지역을 같은 Day에 묶고, 긴 지역 간 이동을 반복하지 않습니다.",
    "한 번의 이동이 장시간인 일정은 가능한 피합니다.",
    "동선 clustering을 우선하며, itinerary item 수 감소 신호로 해석하지 않습니다.",
    "분/km를 사전에 추측해 확정 사실처럼 쓰지 않습니다.",
  ],
  slow_morning: [
    "일반 관광·식사 일정의 첫 시작을 09:30 이전으로 잡지 않습니다.",
    "교통편·체크아웃·불가피한 예약은 예외 가능합니다.",
    "아침을 비우라는 뜻이 아니라, 이른 시작을 피하라는 의미입니다.",
  ],
  avoid_late_night: [
    "일반 일정은 20:30 이후 새로 시작하지 않습니다.",
    "주요 외부 일정은 가능하면 21:30 전후까지 마칩니다.",
    "오후 16~19시 일정을 삭제하지 않으며, 저녁 식사는 정상적으로 포함 가능합니다.",
    "『밤늦은 일정 피하기』는 『16시 이후 일정 없음』이 아닙니다.",
  ],
  free_time: [
    "중간 full day에 대략 60~120분 정도의 자유시간/비계획 블록을 확보합니다.",
    "모든 Day에 강제하지 않으며, arrival/departure day는 자연스러운 여백으로 대체 가능합니다.",
    "자유시간 확보가 density hard minimum을 낮추는 신호가 아닙니다.",
  ],
  fewer_transitions: [
    "하루를 1~2개의 주요 지역/동네 중심으로 구성합니다.",
    "여러 지역을 계속 넘나드는 구성을 피합니다.",
    "같은 지역 안에서는 여러 itinerary item이 가능하며, 『장소 2개만』으로 해석하지 않습니다.",
  ],
};

export const PLANNER_BUDGET_STYLE_SEMANTICS: Record<PlannerBudgetStyle, ReadonlyArray<string>> = {
  budget: [
    "cost-conscious: 숙소·식사·교통에서 합리적 가격대 우선.",
    "편의보다 가격 대비 만족도를 중시하고, 불필요한 고가 옵션을 최소화합니다.",
    "무료/저비용 경험도 적극 포함합니다.",
  ],
  standard: [
    "mid-range balanced: 해당 목적지에서 일반적인 중간 가격대.",
    "가격·위치·편의의 균형이며, 무조건 최저가도 프리미엄도 아닙니다.",
  ],
  premium: [
    "comfort/experience weighted: 위치·편의·경험 품질을 위해 추가 지출을 허용합니다.",
    "중상급 옵션 선택 가능하며, 가격만을 이유로 좋은 경험을 과도하게 제외하지 않습니다.",
  ],
};

/** Detect known chip constraints via insertText inclusion only (no fuzzy matching). */
export function derivePlannerKnownConstraints(
  additionalRequest: string,
): PlannerKnownConstraintId[] {
  const text = additionalRequest.trim();
  if (!text) return [];
  const found: PlannerKnownConstraintId[] = [];
  for (const chip of PLANNER_QUICK_REQUESTS) {
    if (!text.includes(chip.insertText)) continue;
    found.push(chip.id as PlannerKnownConstraintId);
  }
  return found;
}

export function buildPlannerConstraintSemanticsLines(
  constraintIds: ReadonlyArray<PlannerKnownConstraintId>,
): string[] {
  const lines: string[] = [];
  for (const id of constraintIds) {
    const rules = PLANNER_CONSTRAINT_SEMANTICS[id];
    if (!rules) continue;
    lines.push(`- ${id}:`);
    for (const rule of rules) {
      lines.push(`  - ${rule}`);
    }
  }
  return lines;
}

export function buildPlannerConstraintConflictLines(params: {
  constraintIds: ReadonlyArray<PlannerKnownConstraintId>;
  interests: ReadonlyArray<PlannerInterest>;
  pace: PlannerDraftInput["pace"];
}): string[] {
  const set = new Set(params.constraintIds);
  const lines: string[] = [];
  const hasNightView = params.interests.includes("night_view");

  if (set.has("avoid_late_night") && hasNightView) {
    lines.push(
      "- night_view + avoid_late_night: 모순이 아닙니다. 야경 경험은 유지하되(예: 18:30~20:30), 22:30 이후 새 activity 시작은 피합니다. 『야경은 보고 싶지만 너무 늦게까지 다니고 싶지는 않음』으로 해석합니다.",
    );
  }

  if (params.pace === "packed" && set.has("less_walking")) {
    lines.push(
      "- packed + less_walking: 한 지역 안에서 밀도를 높이고, 긴 도보만 줄입니다.",
    );
  }
  if (params.pace === "packed" && set.has("fewer_transitions")) {
    lines.push(
      "- packed + fewer_transitions: 지역 수는 줄이고 같은 지역 내 활동 수는 유지합니다.",
    );
  }
  if (params.pace === "packed" && set.has("slow_morning")) {
    lines.push(
      "- packed + slow_morning: 늦게 시작하되 남은 시간에 밀도 있게 구성합니다.",
    );
  }
  if (params.pace === "packed" && set.has("free_time")) {
    lines.push(
      "- packed + free_time: 자유시간을 확보하되 나머지 시간은 packed 밀도를 유지합니다.",
    );
  }

  return lines;
}

/**
 * Optional user-prompt section derived from known chip insertTexts.
 * Legacy free-form additionalRequest alone yields empty string (raw line stays elsewhere).
 */
export function buildPlannerConstraintSemanticsSection(draft: PlannerDraftInput): string {
  const ids = derivePlannerKnownConstraints(draft.additionalRequest);
  if (ids.length === 0) return "";

  const lines = [
    "[일정 제약 해석]",
    ...buildPlannerConstraintSemanticsLines(ids),
    ...buildPlannerConstraintConflictLines({
      constraintIds: ids,
      interests: draft.interests,
      pace: draft.pace,
    }),
  ];
  return lines.join("\n");
}
