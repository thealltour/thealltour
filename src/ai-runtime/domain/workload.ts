export const WORKLOAD_CLASSES = [
  "classification",
  "extraction",
  "summarization",
  "content_draft",
  "reasoning",
  "governance",
  "analysis",
  "manager_decision",
] as const;

export type WorkloadClass = (typeof WORKLOAD_CLASSES)[number];
