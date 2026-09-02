import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import { PERFORMANCE_MEMORY_SOURCE } from "@/lib/marketing/performance/constants";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

export async function bootstrapResearchSources(
  repo: ResearchRepository,
  now: Date = new Date(),
): Promise<ResearchSource[]> {
  const timestamp = now.toISOString();
  const bootstrapped: ResearchSource[] = [];

  for (const source of [...MVP_RESEARCH_SOURCES, PERFORMANCE_MEMORY_SOURCE]) {
    const existing = await repo.getSourceById(source.id);
    const next: ResearchSource = {
      ...source,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    bootstrapped.push(await repo.upsertSource(next));
  }

  return bootstrapped;
}
