import {
  PERFORMANCE_MEMORY_SOURCE_DEFINITION,
  projectResearchSource,
} from "@/lib/marketing/research/sources/sourceRegistry";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

export const PERFORMANCE_MEMORY_SOURCE_ID = PERFORMANCE_MEMORY_SOURCE_DEFINITION.id;

export const PERFORMANCE_MEMORY_SOURCE: Omit<ResearchSource, "createdAt" | "updatedAt"> =
  projectResearchSource(PERFORMANCE_MEMORY_SOURCE_DEFINITION);

export function performanceSnapshotExternalId(snapshotId: string): string {
  return `content_performance_snapshot:${snapshotId}`;
}
