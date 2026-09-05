export type PlannerSessionStatus = "draft" | "generated" | "saved";

export type PlannerSessionInput = {
  destination?: string;
};

export type PlannerSession = {
  id: string;
  anonymousKey: string;
  memberId: string | null;
  status: PlannerSessionStatus;
  input: PlannerSessionInput;
  plan: unknown | null;
  sourceProductId: string | null;
  createdAt: string;
  updatedAt: string;
};
