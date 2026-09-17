import {
  PLANNER_BUDGET_STYLE_OPTIONS,
  PLANNER_COMPANION_OPTIONS,
  PLANNER_INTEREST_OPTIONS,
  PLANNER_PACE_OPTIONS,
} from "@/lib/planner/constants";
import { formatPlannerDatesSummary } from "@/lib/planner/dates";
import { validatePlannerStep } from "@/lib/planner/schemas";
import type {
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerInterest,
  PlannerPace,
  PlannerWizardStep,
} from "@/types/planner";

export const PLANNER_ORIGIN_SUGGESTIONS = ["서울", "부산", "대구", "제주"] as const;

export const PLANNER_THEME_MOOD_CHIPS: ReadonlyArray<{ label: string; text: string }> = [
  { label: "현지 분위기", text: "현지 분위기를 느끼고 싶어요." },
  { label: "사진 찍기 좋은 곳", text: "사진 찍기 좋은 곳을 중심으로 가고 싶어요." },
  { label: "대표 명소 중심", text: "대표 명소 중심으로 보고 싶어요." },
  { label: "사람 적은 곳", text: "사람이 적은 곳을 선호해요." },
  { label: "감성적인 곳", text: "감성적인 장소를 선호해요." },
] as const;

export const PLANNER_ASSISTANT_QUESTIONS: Record<PlannerWizardStep, string> = {
  1: "어디에서 출발해서 어디로 떠나실까요?",
  2: "여행 날짜는 정하셨나요?",
  3: "누구와 함께 떠나시나요?",
  4: "이번 여행에서 무엇을 즐기고 싶으세요?",
  5: "하루 일정은 어느 정도가 좋으세요?",
  6: "일정을 짤 때 꼭 지켜야 할 조건이 있나요?",
  7: "좋습니다. 지금까지 말씀해주신 여행 조건을 정리했어요.",
};

export const PLANNER_ASSISTANT_DESCRIPTIONS: Partial<Record<PlannerWizardStep, string>> = {
  4: "여러 개 선택하셔도 됩니다.",
  6: "해당되는 항목만 선택해 주세요.",
};

export const PLANNER_BUDGET_QUESTION = "여행 경비는 어느 정도로 생각하고 계세요?";

export function formatWonDisplay(amount: number | null): string {
  if (amount == null) return "";
  return new Intl.NumberFormat("ko-KR").format(amount);
}

export function parseWonInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export function companionLabel(value: PlannerCompanionType): string {
  return PLANNER_COMPANION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function interestLabels(values: PlannerInterest[]): string {
  return values
    .map((v) => PLANNER_INTEREST_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(" · ");
}

export function paceLabel(value: PlannerPace): string {
  return PLANNER_PACE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function budgetSummary(draft: PlannerDraftInput): string {
  const styleLabel =
    draft.budget.style == null
      ? null
      : PLANNER_BUDGET_STYLE_OPTIONS.find((o) => o.value === draft.budget.style)?.label;
  const amountLabel =
    draft.budget.amount == null
      ? null
      : `${formatWonDisplay(draft.budget.amount)}원 (${
          draft.budget.scope === "per_person" ? "1인" : "전체"
        })`;
  if (!styleLabel && !amountLabel) return "아직 미정";
  return [styleLabel, amountLabel].filter(Boolean).join(" · ");
}

/** Step 7 / history display — companion first; hide children when 0. */
export function formatPlannerTravelersSummary(draft: PlannerDraftInput): string {
  const companion = companionLabel(draft.companionType);
  const adults = `성인 ${draft.travelers.adults}명`;
  if (draft.travelers.children > 0) {
    return `${companion} · ${adults} · 아이 ${draft.travelers.children}명`;
  }
  return `${companion} · ${adults}`;
}

/** Compact one-line context for generation waiting UI (display only). */
export function formatPlannerGenerationContext(draft: PlannerDraftInput): string {
  const parts = [
    formatPlannerDatesSummary(draft.dates) || null,
    companionLabel(draft.companionType),
    interestLabels(draft.interests) || null,
    paceLabel(draft.pace),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function formatCompletedStepAnswer(
  step: PlannerWizardStep,
  draft: PlannerDraftInput,
): string {
  switch (step) {
    case 1: {
      const origin = draft.origin.text.trim();
      const dest = draft.destination.text.trim();
      if (origin && dest) return `${origin} → ${dest}`;
      return dest || origin || "";
    }
    case 2:
      return formatPlannerDatesSummary(draft.dates);
    case 3:
      return formatPlannerTravelersSummary(draft);
    case 4: {
      const interests = interestLabels(draft.interests);
      const theme = draft.themeRequest.trim();
      return [interests || null, theme || null].filter(Boolean).join(" · ");
    }
    case 5:
      return `${paceLabel(draft.pace)} · ${budgetSummary(draft)}`;
    case 6: {
      const req = draft.additionalRequest.trim();
      return req || "추가 요청 없음";
    }
    case 7:
      return "";
  }
}

/**
 * Compact history steps: progression-based (steps before current),
 * or when editing from summary — other validated steps excluding current.
 * Never treat defaults alone as completed while still on step 1.
 */
export function getCompletedConversationSteps(params: {
  step: PlannerWizardStep;
  draft: PlannerDraftInput;
  editingFromSummary: boolean;
}): PlannerWizardStep[] {
  const { step, draft, editingFromSummary } = params;
  const out: PlannerWizardStep[] = [];

  if (editingFromSummary) {
    for (let s = 1; s <= 6; s++) {
      if (s === step) continue;
      if (validatePlannerStep(s, draft) == null) {
        out.push(s as PlannerWizardStep);
      }
    }
    return out;
  }

  for (let s = 1; s < step; s++) {
    out.push(s as PlannerWizardStep);
  }
  return out;
}

export function getPlannerAcknowledgement(params: {
  step: PlannerWizardStep;
  draft: PlannerDraftInput;
}): string | null {
  const { step, draft } = params;
  if (step === 3) {
    switch (draft.companionType) {
      case "parents":
        return "부모님과 함께 가시는군요. 이동이 너무 빡빡하지 않도록 고려할게요.";
      case "couple":
        return "두 분이 함께 즐길 수 있는 분위기도 고려할게요.";
      case "family":
      case "with_children":
        return "이동 시간과 휴식도 함께 고려할게요.";
      case "solo":
        return "혼자만의 템포로 즐길 수 있게 볼게요.";
      default:
        return null;
    }
  }
  if (step === 5) {
    if (draft.pace === "relaxed") {
      return "좋아요. 여유를 남기는 일정으로 볼게요.";
    }
    if (draft.pace === "packed") {
      return "알찬 일정도 무리 없이 짜 볼게요.";
    }
  }
  if (step === 4 && draft.interests.includes("food")) {
    return "맛집도 충분히 즐길 수 있게 반영할게요.";
  }
  return null;
}
