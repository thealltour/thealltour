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

export type PlannerDateMode = "fixed" | "flexible";

export type PlannerBudgetStyle = "budget" | "standard" | "premium";

export type PlannerDraftDates = {
  mode: PlannerDateMode;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
};

export type PlannerDraftInput = {
  destination: { text: string };
  dates: PlannerDraftDates;
  travelers: { adults: number; children: number };
  companionType: PlannerCompanionType;
  interests: PlannerInterest[];
  /** Style / mood preferences (optional free text). */
  themeRequest: string;
  pace: PlannerPace;
  budget: {
    style: PlannerBudgetStyle | null;
    amount: number | null;
    scope: PlannerBudgetScope;
    currency: "KRW";
  };
  /** Concrete must-keep requirements. */
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

export type PlannerSummaryEditSection =
  | "destination"
  | "dates"
  | "companions"
  | "themes"
  | "budget"
  | "request";

export type PlannerGenerationFailureCategory =
  | "input_invalid"
  | "provider_failed"
  | "schema_invalid"
  | "invariant_failed"
  | "persist_failed"
  | "result_navigation_failed";
