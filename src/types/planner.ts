import type { PlannerPlan } from "@/lib/planner/planSchemas";

export type PlannerSessionStatus = "draft" | "generated" | "saved";

export type PlannerCompanionType =
  | "solo"
  | "couple"
  | "friends"
  | "family"
  | "parents"
  | "with_children";

export type PlannerInterest =
  | "food"
  | "sightseeing"
  | "shopping"
  | "relaxation"
  | "nature"
  | "culture"
  | "activity"
  | "night_view";

export type PlannerPace = "relaxed" | "balanced" | "packed";

export type PlannerBudgetScope = "per_person" | "total";

export type PlannerDraftInput = {
  destination: { text: string };
  dates: { startDate: string; endDate: string };
  travelers: { adults: number; children: number };
  companionType: PlannerCompanionType;
  interests: PlannerInterest[];
  pace: PlannerPace;
  budget: {
    amount: number | null;
    scope: PlannerBudgetScope;
    currency: "KRW";
  };
  additionalRequest: string;
};

/** @deprecated PR-1 string destination — prefer PlannerDraftInput */
export type PlannerSessionInput = PlannerDraftInput | { destination?: string };

export type PlannerSession = {
  id: string;
  anonymousKey: string;
  memberId: string | null;
  status: PlannerSessionStatus;
  input: PlannerDraftInput;
  plan: PlannerPlan | null;
  sourceProductId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlannerWizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
