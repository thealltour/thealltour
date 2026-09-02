import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

/** Stable research source id for performance_memory (aligned with research fixtures). */
export const PERFORMANCE_MEMORY_SOURCE_ID = "44444444-4444-4444-8444-444444444444" as const;

export const PERFORMANCE_MEMORY_SOURCE: Omit<ResearchSource, "createdAt" | "updatedAt"> = {
  id: PERFORMANCE_MEMORY_SOURCE_ID,
  sourceType: "performance_memory",
  name: "Performance Analyst Memory",
  authorityLevel: "primary",
  defaultCredibility: 0.75,
  language: "ko",
  isOfficial: false,
  isEnabled: true,
  metadata: {
    adapter: "performance_signal",
    advisoryOnly: true,
  },
};

export function performanceSnapshotExternalId(snapshotId: string): string {
  return `content_performance_snapshot:${snapshotId}`;
}
