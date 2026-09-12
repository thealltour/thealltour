import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import { gatherAcrbInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import {
  loadDurableAcrb,
  persistDurableAcrb,
  readAcrbFromProductionRequest,
} from "@/lib/marketing/audienceResearch/persistence";
import { synthesizeAudienceContentResearch, type AcrbLlmInvoke } from "@/lib/marketing/audienceResearch/synthesize";
import {
  buildAcrbLogicalIdentity,
  buildEvidenceFingerprint,
} from "@/lib/marketing/audienceResearch/validate";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import {
  reconstructExternalBundleFromAcrb,
  runBoundedExternalResearch,
  type ExternalResearchBundle,
} from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import type { SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";

export type EnsureAcrbInput = {
  handoff: ManagerToContentHandoffResult;
  logicalRunKey: string;
  productionRequestRepo: MarketingProductionRequestRepository;
  compactBrief?: CompactManagerResearchBrief | null;
  compactCandidate?: CompactManagerAgendaCandidate | null;
  forceRegenerate?: boolean;
  invoke?: AcrbLlmInvoke | null;
  now?: Date;
  loadFullResearchBrief?: (id: string) => Promise<ResearchBrief | null>;
  listRecentCandidateTitles?: () => Promise<Array<{ id: string; title: string }>>;
  cooledIdentity?: boolean;
  semanticAvailable?: boolean;
  /** Inject for tests / override; default resolves from env (fail-closed). */
  searchProvider?: ResearchSearchProvider | null;
  searchCache?: SourceSearchCache | null;
  /**
   * Skip network external research. When a durable ACRB already holds external
   * evidence, that bundle is reconstructed and reused (synthesis-only path).
   */
  skipExternalResearch?: boolean;
  /** Explicit external research override (tests / synthesis-only harness). */
  externalResearch?: ExternalResearchBundle | null;
  fetchImpl?: typeof fetch;
};

export type EnsureAcrbResult = {
  brief: AudienceContentResearchBrief;
  reused: boolean;
  persisted: boolean;
  /** True when prior durable external evidence was reconstructed (no new search). */
  externalResearchReused?: boolean;
};

export async function ensureAudienceContentResearch(
  input: EnsureAcrbInput,
): Promise<EnsureAcrbResult> {
  const evidenceFingerprint = buildEvidenceFingerprint(
    input.handoff.contentAssignment.evidenceRefs ?? [],
  );
  const preselectionResearchBriefId =
    input.handoff.selectedAgenda.provenance.researchBriefId ??
    input.compactBrief?.researchBriefId ??
    null;
  const expectedLogicalIdentity = buildAcrbLogicalIdentity({
    selectedAgendaId: input.handoff.selectedAgenda.id,
    assignmentId: input.handoff.contentAssignment.assignmentId,
    evidenceFingerprint,
    preselectionResearchBriefId,
  });

  if (!input.forceRegenerate) {
    const existing = await loadDurableAcrb({
      repo: input.productionRequestRepo,
      logicalRunKey: input.logicalRunKey,
      expectedLogicalIdentity,
    });
    if (existing) {
      return {
        brief: {
          ...existing,
          provenance: { ...existing.provenance, synthesisMode: "reused" },
        },
        reused: true,
        persisted: false,
        externalResearchReused: false,
      };
    }
  }

  const gathered = await gatherAcrbInputs({
    handoff: input.handoff,
    compactBrief: input.compactBrief,
    compactCandidate: input.compactCandidate,
    deps: {
      loadFullResearchBrief: input.loadFullResearchBrief,
      listRecentCandidateTitles: input.listRecentCandidateTitles,
      cooledIdentity: input.cooledIdentity,
      semanticAvailable: input.semanticAvailable,
    },
  });

  let externalResearch: ExternalResearchBundle | null = null;
  let externalResearchReused = false;

  if (input.externalResearch !== undefined) {
    externalResearch = input.externalResearch;
  } else if (input.skipExternalResearch) {
    const priorRequest = await input.productionRequestRepo.findByLogicalKey(input.logicalRunKey);
    const priorBrief = readAcrbFromProductionRequest(priorRequest);
    const reconstructed = priorBrief
      ? reconstructExternalBundleFromAcrb({ brief: priorBrief })
      : null;
    externalResearch = reconstructed;
    externalResearchReused = Boolean(reconstructed);
  } else {
    externalResearch = await runBoundedExternalResearch({
      handoff: input.handoff,
      editorial: gathered.editorial,
      searchProvider: input.searchProvider,
      cache: input.searchCache,
      fetchImpl: input.fetchImpl,
      now: input.now,
    });
  }

  const brief = await synthesizeAudienceContentResearch({
    gathered: {
      ...gathered,
      externalResearch,
    },
    invoke: input.invoke,
    now: input.now,
  });

  await persistDurableAcrb({
    repo: input.productionRequestRepo,
    logicalRunKey: input.logicalRunKey,
    brief,
    now: input.now,
  });

  return {
    brief,
    reused: false,
    persisted: true,
    externalResearchReused,
  };
}
