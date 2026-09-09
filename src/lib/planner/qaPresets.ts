import { dateToYmd } from "@/lib/datePickerUtils";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { computeDurationDays } from "@/lib/planner/dates";
import type { PlannerDraftInput } from "@/types/planner";

export type PlannerQaPresetId =
  | "osaka-fixed"
  | "danang-family-fixed"
  | "tokyo-flexible"
  | "minimal-valid";

export type PlannerQaPreset = {
  id: PlannerQaPresetId;
  label: string;
  draft: PlannerDraftInput;
};

/** Build a future fixed date range (local calendar). durationDays includes start day. */
export function createFutureFixedDateRange(options: {
  startOffsetDays: number;
  durationDays: number;
  now?: Date;
}): {
  mode: "fixed";
  startDate: string;
  endDate: string;
  durationDays: number;
} {
  const now = options.now ?? new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + options.startOffsetDays);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  end.setDate(end.getDate() + Math.max(0, options.durationDays - 1));
  const startDate = dateToYmd(start);
  const endDate = dateToYmd(end);
  const durationDays =
    computeDurationDays(startDate, endDate) ?? options.durationDays;
  return {
    mode: "fixed",
    startDate,
    endDate,
    durationDays,
  };
}

function buildOsakaFixed(now?: Date): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: createFutureFixedDateRange({
      startOffsetDays: 30,
      durationDays: 5,
      now,
    }),
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: ["food", "sightseeing"],
    themeRequest: "",
    pace: "balanced",
    budget: {
      style: "standard",
      amount: null,
      scope: "per_person",
      currency: "KRW",
    },
    additionalRequest: "현지 맛집과 주요 관광지를 적절히 포함해 주세요.",
  };
}

function buildDanangFamilyFixed(now?: Date): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("다낭", "서울"),
    dates: createFutureFixedDateRange({
      startOffsetDays: 45,
      durationDays: 5,
      now,
    }),
    travelers: { adults: 2, children: 1 },
    companionType: "with_children",
    interests: ["relaxation", "food", "sightseeing"],
    themeRequest: "아이와 편하게 다닐 수 있게",
    pace: "relaxed",
    budget: {
      style: "standard",
      amount: null,
      scope: "total",
      currency: "KRW",
    },
    additionalRequest: "아이와 편하게 다닐 수 있게 구성해주세요.",
  };
}

function buildTokyoFlexible(): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("도쿄", "부산"),
    dates: {
      mode: "flexible",
      startDate: null,
      endDate: null,
      durationDays: 5,
    },
    travelers: { adults: 2, children: 0 },
    companionType: "friends",
    interests: ["food", "shopping", "culture"],
    themeRequest: "",
    pace: "balanced",
    budget: {
      style: "budget",
      amount: null,
      scope: "per_person",
      currency: "KRW",
    },
    additionalRequest: "쇼핑 시간을 넉넉히 넣어주세요.",
  };
}

function buildMinimalValid(now?: Date): PlannerDraftInput {
  return {
    ...createEmptyPlannerDraftInput("오사카", "서울"),
    dates: createFutureFixedDateRange({
      startOffsetDays: 14,
      durationDays: 3,
      now,
    }),
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: ["sightseeing"],
    themeRequest: "",
    pace: "balanced",
    budget: {
      style: null,
      amount: null,
      scope: "per_person",
      currency: "KRW",
    },
    additionalRequest: "",
  };
}

/** Fresh presets (dates recomputed each call). */
export function getPlannerQaPresets(now?: Date): PlannerQaPreset[] {
  return [
    {
      id: "osaka-fixed",
      label: "오사카 fixed (커플)",
      draft: buildOsakaFixed(now),
    },
    {
      id: "danang-family-fixed",
      label: "다낭 fixed (가족)",
      draft: buildDanangFamilyFixed(now),
    },
    {
      id: "tokyo-flexible",
      label: "도쿄 flexible",
      draft: buildTokyoFlexible(),
    },
    {
      id: "minimal-valid",
      label: "최소 valid",
      draft: buildMinimalValid(now),
    },
  ];
}

export function getPlannerQaPreset(
  id: PlannerQaPresetId,
  now?: Date,
): PlannerQaPreset {
  const found = getPlannerQaPresets(now).find((p) => p.id === id);
  if (!found) {
    return getPlannerQaPresets(now)[0]!;
  }
  return found;
}

export const PLANNER_QA_PRESET_IDS: PlannerQaPresetId[] = [
  "osaka-fixed",
  "danang-family-fixed",
  "tokyo-flexible",
  "minimal-valid",
];
