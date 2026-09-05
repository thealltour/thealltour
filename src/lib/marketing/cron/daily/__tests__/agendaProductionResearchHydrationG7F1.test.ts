vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  buildProductionExecutionInput,
} from "@/lib/marketing/cron/daily/agendaSlate/processMarketingProductionQueue";
import {
  hydrateProductionResearchContext,
  ProductionResearchHydrationError,
} from "@/lib/marketing/cron/daily/agendaSlate/hydrateProductionResearchContext";
import {
  buildQueuedProductionRequest,
} from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import { parseProviderContentPlan } from "@/lib/marketing/content/validation/validateContentPlan";
import { buildDailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/buildDailyAgendaSlate";
import {
  NOW,
  buildResearchContext,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import { signalFixture } from "@/lib/marketing/research/__tests__/semanticCalibrationFixtures";
import { MVP_RESEARCH_SOURCES } from "@/lib/marketing/research/collectors/config";
import { createInMemoryResearchRepository } from "@/lib/marketing/research/repository/inMemoryResearchRepository";
import { buildResearchBriefFromCluster } from "@/lib/marketing/research/services/briefBuilder";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";

/**
 * Fixture constants mirror the failed Vietnam G-7 request identities.
 * Do not hard-code these into production hydration logic.
 */
const VIETNAM_AGENDA_CANDIDATE_ID = "9a95db46-4eca-448a-8a79-02596c2095f6";
const VIETNAM_RESEARCH_BRIEF_ID = "000f9822-c27b-460f-85b8-9dbbb706b2aa";
const VIETNAM_EVIDENCE_ID = "743b0bb2-7abe-46c7-a96d-ee91f652057c";
const VIETNAM_TITLE =
  "chasing gold and clouds: vietnam’s best september escapes";
const VIETNAM_SUMMARY =
  "Vietnam National Tourism highlights September escapes across the country for autumn travelers.";

async function seedVietnamCanonicalResearch() {
  const repo = createInMemoryResearchRepository();
  const sources: ResearchSource[] = MVP_RESEARCH_SOURCES.map((s) => ({
    ...s,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }));
  for (const source of sources) {
    await repo.upsertSource(source);
  }

  const signal = signalFixture({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    title: VIETNAM_TITLE,
    summary: VIETNAM_SUMMARY,
    signalType: "destination_trend",
    destinations: ["vietnam"],
    topics: ["september", "travel", "tourism"],
    sourceId: MVP_RESEARCH_SOURCES[0]!.id,
    sourceType: "official_government",
    evidence: [
      {
        id: VIETNAM_EVIDENCE_ID,
        sourceId: MVP_RESEARCH_SOURCES[0]!.id,
        url: "https://vietnam.travel/rss/september-escapes",
        excerpt:
          "Vietnam National Tourism highlights September escapes across the country.",
        observedAt: NOW.toISOString(),
        evidenceType: "official_statement",
      },
    ],
  });
  await repo.upsertSignal(signal);

  const brief = buildResearchBriefFromCluster({
    cluster: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01",
      primarySignalId: signal.id,
      signalIds: [signal.id],
      clusterType: "event",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    signals: [signal],
    sources: new Map(sources.map((s) => [s.id, s])),
    now: NOW,
  })!;
  // Pin IDs to the durable selection IDs from the failed ProductionRequest.
  brief.id = VIETNAM_RESEARCH_BRIEF_ID;
  await repo.upsertBrief(brief);

  const candidate = buildAgendaCandidateFromBrief(brief, NOW);
  candidate.id = VIETNAM_AGENDA_CANDIDATE_ID;
  candidate.researchBriefId = VIETNAM_RESEARCH_BRIEF_ID;
  candidate.title = VIETNAM_TITLE;
  candidate.rationale = VIETNAM_SUMMARY;
  candidate.createdAt = NOW.toISOString();
  candidate.updatedAt = NOW.toISOString();
  await repo.upsertAgendaCandidate(candidate);

  return { repo, brief, candidate, signal };
}

function vietnamQueuedRequest(): MarketingProductionRequest {
  const research = buildResearchContext({
    agendaCandidates: [
      {
        agendaCandidateId: VIETNAM_AGENDA_CANDIDATE_ID,
        researchBriefId: VIETNAM_RESEARCH_BRIEF_ID,
        title: VIETNAM_TITLE,
        summary: VIETNAM_SUMMARY,
        destinations: ["vietnam"],
        topics: ["september", "travel"],
        entities: [],
        signalTypes: ["destination_trend"],
        publishedAt: NOW.toISOString(),
        observedAt: NOW.toISOString(),
        freshnessScore: 0.9,
        credibilityScore: 0.85,
        travelRelevanceScore: 0.8,
        publicInterestScore: 0.7,
        commercialRelevanceScore: 0.3,
        seasonalityScore: 0.8,
        corroborationScore: 0.5,
        noveltyScore: 0.6,
        koreanOutboundRelevanceScore: 0.7,
        totalResearchScore: 0.75,
        researchScoreComponents: null,
        scoreReasons: ["official tourism"],
        riskFlags: [],
        matchedProductIds: [],
        // Slate compact may carry evidence, but queued ProductionRequest does not.
        evidence: [],
        candidateStatus: "eligible",
      },
    ],
    briefs: [],
  });
  const slate = buildDailyAgendaSlate({
    research,
    logicalRunKey: "daily-marketing-plan:acceptance:2026-09-05:agenda-v7",
    businessDateKst: "2026-09-05",
    runId: "run-g7f1",
    correlationId: "corr-g7f1",
    now: NOW,
  });
  const candidate = slate.candidates[0]!;
  return buildQueuedProductionRequest({ slate, candidate, now: NOW });
}

describe("G7-F1 canonical research hydration for queued Agenda production", () => {
  it("documents durable request IDs without evidence blobs", () => {
    const request = vietnamQueuedRequest();
    expect(request.selection.agendaCandidateId).toBe(VIETNAM_AGENDA_CANDIDATE_ID);
    expect(request.selection.researchBriefId).toBe(VIETNAM_RESEARCH_BRIEF_ID);
    expect(request.selection.summary).toContain("Vietnam");
    // Contract: ProductionRequest stores IDs + summary, not evidence.
    expect(request.selection).not.toHaveProperty("evidence");
    expect(request.selection).not.toHaveProperty("evidenceRefs");
  });

  it("before hydration: summary-only handoff yields assignment evidence = 0", () => {
    const request = vietnamQueuedRequest();
    const input = buildProductionExecutionInput(request, { productId: "prod-test" });
    expect(input.researchCandidate).toBeNull();
    expect(input.researchBrief).toBeNull();

    const handoff = prepareManagerToContentHandoff(
      {
        ...input.selection,
        channel: input.channel,
        researchCandidate: input.researchCandidate,
        researchBrief: input.researchBrief,
        idempotencyKey: `${input.logicalRunKey}:before`,
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );

    expect(handoff.selectedAgenda.evidenceRefs).toHaveLength(0);
    expect(handoff.contentAssignment.evidenceRefs).toHaveLength(0);
    expect(handoff.contentPlanScaffold.factsToUse.length).toBeGreaterThanOrEqual(0);

    // Factual claims derived from summary + explicit empty evidenceRefs still fail validator.
    try {
      parseProviderContentPlan({
        assignmentId: handoff.contentAssignment.assignmentId,
        factsToUse: [request.selection.summary],
        evidenceRefs: [],
      });
      expect.fail("expected evidence_refs_empty rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentPlanContractError);
      expect((error as ContentPlanContractError).validationIssue).toBe("evidence_refs_empty");
    }
  });

  it("after hydration: research evidence >= 1 and CS scaffold receives Vietnam evidence id", async () => {
    const { repo } = await seedVietnamCanonicalResearch();
    const request = vietnamQueuedRequest();

    const hydrated = await hydrateProductionResearchContext(request, { repo });
    expect(hydrated.researchBrief.evidence.length).toBeGreaterThanOrEqual(1);
    expect(hydrated.researchCandidate.evidence.length).toBeGreaterThanOrEqual(1);
    expect(hydrated.researchBrief.evidence.map((e) => e.evidenceId)).toContain(
      VIETNAM_EVIDENCE_ID,
    );

    const input = buildProductionExecutionInput(
      request,
      { productId: "prod-test" },
      hydrated,
    );
    expect(input.researchCandidate?.evidence.length).toBeGreaterThanOrEqual(1);
    expect(input.researchBrief?.evidence.length).toBeGreaterThanOrEqual(1);

    const handoff = prepareManagerToContentHandoff(
      {
        ...input.selection,
        channel: input.channel,
        researchCandidate: input.researchCandidate,
        researchBrief: input.researchBrief,
        idempotencyKey: `${input.logicalRunKey}:after`,
        now: NOW,
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );

    expect(handoff.selectedAgenda.evidenceRefs.length).toBeGreaterThanOrEqual(1);
    expect(handoff.contentAssignment.evidenceRefs.length).toBeGreaterThanOrEqual(1);
    expect(
      handoff.contentAssignment.evidenceRefs.map((e) => e.evidenceId),
    ).toContain(VIETNAM_EVIDENCE_ID);
    expect(handoff.contentPlanScaffold.factsToUse.length).toBeGreaterThanOrEqual(1);
    expect(
      handoff.contentPlanScaffold.evidenceRefs?.map((e) => e.evidenceId) ?? [],
    ).toContain(VIETNAM_EVIDENCE_ID);

    // Properly grounded provider plan with the hydrated evidence id is accepted.
    const plan = parseProviderContentPlan({
      assignmentId: handoff.contentAssignment.assignmentId,
      factsToUse: [
        "Vietnam National Tourism highlights September escapes across the country.",
      ],
      evidenceRefs: handoff.contentAssignment.evidenceRefs,
    });
    expect(plan.evidenceRefs.map((e) => e.evidenceId)).toContain(VIETNAM_EVIDENCE_ID);
  });

  it("fail-closed: missing canonical research → research_context_unavailable", async () => {
    const repo = createInMemoryResearchRepository();
    const request = vietnamQueuedRequest();
    await expect(hydrateProductionResearchContext(request, { repo })).rejects.toMatchObject({
      code: "research_context_unavailable",
    } satisfies Partial<ProductionResearchHydrationError>);
  });

  it("fail-closed: candidate/brief identity mismatch → research_identity_mismatch", async () => {
    const { repo, candidate } = await seedVietnamCanonicalResearch();
    // Point candidate at a different brief id than selection.
    candidate.researchBriefId = "11111111-1111-4111-8111-111111111111";
    await repo.upsertAgendaCandidate(candidate);

    const request = vietnamQueuedRequest();
    await expect(hydrateProductionResearchContext(request, { repo })).rejects.toMatchObject({
      code: "research_identity_mismatch",
    } satisfies Partial<ProductionResearchHydrationError>);
  });

  it("fail-closed: empty brief evidence → research_evidence_unavailable", async () => {
    const { repo, brief } = await seedVietnamCanonicalResearch();
    brief.evidence = [];
    await repo.upsertBrief(brief);

    const request = vietnamQueuedRequest();
    await expect(hydrateProductionResearchContext(request, { repo })).rejects.toMatchObject({
      code: "research_evidence_unavailable",
    } satisfies Partial<ProductionResearchHydrationError>);
  });

  it("selection summary is not treated as evidence by the validator", () => {
    const request = vietnamQueuedRequest();
    try {
      parseProviderContentPlan({
        assignmentId: "ca_summary_not_evidence",
        factsToUse: [request.selection.summary],
        evidenceRefs: [],
      });
      expect.fail("expected evidence_refs_empty rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentPlanContractError);
      expect((error as ContentPlanContractError).validationIssue).toBe("evidence_refs_empty");
    }
  });

  it("validator stays strict: empty evidenceRefs fail; no auto-hydrate from selection summary", () => {
    const request = vietnamQueuedRequest();
    // No automatic assignment hydration inside the provider validator.
    try {
      parseProviderContentPlan({
        assignmentId: "ca_no_auto_hydrate",
        factsToUse: ["A factual claim about Vietnam September escapes."],
        evidenceRefs: [],
      });
      expect.fail("expected evidence_refs_empty rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentPlanContractError);
      expect((error as ContentPlanContractError).validationIssue).toBe("evidence_refs_empty");
    }

    // Fabricated evidence ID is structural-only at parse time; selection summary
    // must not be silently converted into an evidence ref by the validator.
    const fabricated = parseProviderContentPlan({
      assignmentId: "ca_fabricated_shape",
      factsToUse: ["A factual claim about Vietnam September escapes."],
      evidenceRefs: [
        {
          evidenceId: "fabricated-evidence-id",
          sourceId: "src-x",
          sourceType: "news",
          sourceName: "fake",
          isOfficial: false,
          evidenceType: "direct_source",
          url: "https://example.com/fake",
          reference: null,
          excerpt: request.selection.summary,
          publishedAt: null,
          observedAt: NOW.toISOString(),
          credibilityHint: 0.1,
        },
      ],
    });
    expect(fabricated.evidenceRefs.map((e) => e.evidenceId)).toEqual([
      "fabricated-evidence-id",
    ]);
    expect(fabricated.evidenceRefs.map((e) => e.evidenceId)).not.toContain(
      VIETNAM_EVIDENCE_ID,
    );
  });
});
