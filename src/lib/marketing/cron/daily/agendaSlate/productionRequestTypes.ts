export const MARKETING_PRODUCTION_REQUEST_CONTRACT =
  "daily-marketing-production-request-v1" as const;

export type MarketingProductionRequestStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type MarketingProductionRequest = {
  contract: typeof MARKETING_PRODUCTION_REQUEST_CONTRACT;
  requestId: string;
  /** Stable production identity — also CompletedMarketingCandidate.logical_run_key target. */
  logicalRunKey: string;
  slateId: string;
  slateItemId: string;
  businessDateKst: string;
  status: MarketingProductionRequestStatus;
  createdAt: string;
  updatedAt: string;
  selection: {
    title: string;
    summary: string;
    agendaCandidateId: string | null;
    researchBriefId: string | null;
    rationale: string[];
    recommendedChannel: string | null;
    recommendedFormats: string[];
  };
  errorMessage: string | null;
  completedCandidateId: string | null;
  metadata: Record<string, unknown>;
};
