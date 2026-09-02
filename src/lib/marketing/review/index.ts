export * from "@/lib/marketing/review/types";
export * from "@/lib/marketing/review/transitions";
export * from "@/lib/marketing/review/dto";
export * from "@/lib/marketing/review/validation";
export * from "@/lib/marketing/review/bootstrap";
export * from "@/lib/marketing/review/morningReview";
export { HumanMarketingReviewService, createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
export {
  createHumanMarketingReviewRepository,
  createInMemoryHumanMarketingReviewRepository,
  getDefaultHumanMarketingReviewRepository,
  resetDefaultHumanMarketingReviewRepository,
} from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";

/** Human review is business-state only — no publication adapters. */
export const HUMAN_REVIEW_PUBLICATION_SIDE_EFFECTS = 0 as const;
