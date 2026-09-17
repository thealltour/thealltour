import type { PlannerCompanionType, PlannerDraftInput } from "@/types/planner";

export type TravelerConstraints = {
  adultsMin: number;
  adultsMax: number;
  childrenMin: number;
  childrenMax: number;
};

/** Canonical travelers applied when companion type changes. */
export function getDefaultTravelersForCompanion(
  type: PlannerCompanionType,
): PlannerDraftInput["travelers"] {
  switch (type) {
    case "solo":
      return { adults: 1, children: 0 };
    case "couple":
      return { adults: 2, children: 0 };
    case "friends":
      return { adults: 2, children: 0 };
    case "family":
      return { adults: 2, children: 0 };
    case "parents":
      return { adults: 2, children: 0 };
    case "with_children":
      return { adults: 2, children: 1 };
  }
}

/** Counter min/max aligned with companion defaults. */
export function getTravelerConstraints(type: PlannerCompanionType): TravelerConstraints {
  switch (type) {
    case "solo":
      return { adultsMin: 1, adultsMax: 1, childrenMin: 0, childrenMax: 0 };
    case "couple":
      return { adultsMin: 2, adultsMax: 2, childrenMin: 0, childrenMax: 0 };
    case "friends":
      return { adultsMin: 2, adultsMax: 20, childrenMin: 0, childrenMax: 0 };
    case "family":
      return { adultsMin: 1, adultsMax: 20, childrenMin: 0, childrenMax: 20 };
    case "parents":
      return { adultsMin: 2, adultsMax: 20, childrenMin: 0, childrenMax: 0 };
    case "with_children":
      return { adultsMin: 1, adultsMax: 20, childrenMin: 1, childrenMax: 20 };
  }
}

/**
 * Defensive companion ↔ travelers consistency check.
 * Returns a user-facing Korean message, or null when valid.
 */
export function getCompanionTravelersConsistencyError(params: {
  companionType: PlannerCompanionType;
  adults: number;
  children: number;
}): string | null {
  const { companionType, adults, children } = params;
  const c = getTravelerConstraints(companionType);

  if (adults < c.adultsMin || adults > c.adultsMax) {
    switch (companionType) {
      case "solo":
        return "혼자 여행은 성인 1명으로 설정해 주세요.";
      case "couple":
        return "연인 여행은 성인 2명으로 설정해 주세요.";
      case "friends":
        return "친구 여행은 성인을 2명 이상으로 설정해 주세요.";
      case "parents":
        return "부모님과 여행은 성인을 2명 이상으로 설정해 주세요.";
      default:
        return "성인 인원을 확인해 주세요.";
    }
  }

  if (children < c.childrenMin || children > c.childrenMax) {
    switch (companionType) {
      case "solo":
      case "couple":
      case "friends":
      case "parents":
        return "선택한 동행 유형에서는 아이 인원을 0명으로 설정해 주세요.";
      case "with_children":
        return "아이와 여행은 아이를 1명 이상 설정해 주세요.";
      default:
        return "아이 인원을 확인해 주세요.";
    }
  }

  return null;
}
