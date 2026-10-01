import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  BOOTSTRAP_RESEARCH_SOURCES,
  selectBootstrapResearchSources,
  type ResearchSourceDefinition,
} from "@/lib/marketing/research/sources/sourceRegistry";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

/** Upserts every catalog row, paused/retired included: lifecycle gates participation, not catalog presence. */
export async function bootstrapResearchSources(
  repo: ResearchRepository,
  now: Date = new Date(),
  sources?: readonly ResearchSourceDefinition[],
): Promise<ResearchSource[]> {
  const timestamp = now.toISOString();
  const bootstrapped: ResearchSource[] = [];
  const rows = sources ? selectBootstrapResearchSources(sources) : BOOTSTRAP_RESEARCH_SOURCES;

  for (const source of rows) {
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
