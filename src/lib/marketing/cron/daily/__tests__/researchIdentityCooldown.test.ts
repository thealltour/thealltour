vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import {
  agendaCandidateMatchesCooldown,
  applyResearchIdentityCooldown,
  collectRecentResearchIdentities,
  extractResearchIdentitiesFromCandidate,
  normalizeSourceArticleIdentity,
  subtractKstBusinessDays,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  agendaCandidate,
  buildResearchContext,
  NOW,
  officialEvidence,
  researchBrief,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";

function stubCandidate(input: {
  businessDateKst: string;
  agendaCandidateId?: string | null;
  researchBriefId?: string | null;
  evidenceUrl?: string | null;
}): CompletedMarketingCandidate {
  const handoff = prepareManagerToContentHandoff(
    {
      title: "Gleneagles Scotland golf travel note",
      summary: "Scotland destination update for travelers.",
      agendaCandidateId: input.agendaCandidateId ?? null,
      researchBriefId: input.researchBriefId ?? null,
      evidenceRefs: input.evidenceUrl
        ? [
            {
              evidenceId: "ev-glen",
              sourceId: "src-glen",
              sourceType: "news",
              sourceName: "Press",
              isOfficial: false,
              evidenceType: "article",
              url: input.evidenceUrl,
              reference: null,
              excerpt: "Gleneagles remains a top Scotland golf destination.",
              publishedAt: "2026-09-01T00:00:00.000Z",
              observedAt: NOW.toISOString(),
              credibilityHint: 0.7,
            },
          ]
        : [],
      idempotencyKey: `cooldown-stub:${input.businessDateKst}:${input.agendaCandidateId ?? "none"}:${input.researchBriefId ?? "none"}:${input.evidenceUrl ?? "none"}`,
      now: NOW,
    },
    { store: createInMemoryContentAssignmentStore(), now: NOW },
  );

  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: `cmc_${input.businessDateKst}`,
    runId: "run-test",
    logicalRunKey: `daily-marketing-plan:${input.businessDateKst}`,
    businessDateKst: input.businessDateKst,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    selectedAgenda: handoff.selectedAgenda,
    contentAssignment: handoff.contentAssignment,
    contentPlan: handoff.contentPlanScaffold,
    draft: {
      title: "draft",
      body: "body",
      channel: "threads",
      agenda: handoff.selectedAgenda.title,
      sourceReferences: [],
    },
    governanceDecision: null,
    status: "ready_for_human_review",
    revisionHistory: [],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: "corr",
      researchStatus: "ok",
      governanceReviewId: null,
    },
    observability: {
      runId: "run-test",
      logicalRunKey: `daily-marketing-plan:${input.businessDateKst}`,
      businessDateKst: input.businessDateKst,
      correlationId: "corr",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: handoff.selectedAgenda.id,
      assignmentId: handoff.contentAssignment.assignmentId,
      governanceReviewId: null,
      revisionCount: 0,
      governanceDecision: null,
      finalCandidateId: null,
      finalStatus: null,
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      failureReason: null,
    },
  };
}

describe("researchIdentityCooldown", () => {
  it("subtracts KST business days without timezone drift", () => {
    expect(subtractKstBusinessDays("2026-09-04", 7)).toBe("2026-08-28");
    expect(subtractKstBusinessDays("2026-09-01", 1)).toBe("2026-08-31");
  });

  it("same agendaCandidateId yesterday -> excluded today", () => {
    const history = [
      stubCandidate({
        businessDateKst: "2026-09-03",
        agendaCandidateId: "ac-japan-autumn",
        researchBriefId: "rb-other",
      }),
    ];
    const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
    expect(cooled.agendaCandidateIds.has("ac-japan-autumn")).toBe(true);
    expect(agendaCandidateMatchesCooldown(agendaCandidate, cooled)).toBe(true);
    const applied = applyResearchIdentityCooldown(buildResearchContext(), cooled);
    expect(applied.context.agendaCandidates).toHaveLength(0);
    expect(applied.excludedAgendaCandidateIds).toContain("ac-japan-autumn");
  });

  it("same brief ID -> excluded", () => {
    const history = [
      stubCandidate({
        businessDateKst: "2026-09-03",
        agendaCandidateId: "ac-other",
        researchBriefId: "rb-japan-autumn",
      }),
    ];
    const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
    const applied = applyResearchIdentityCooldown(buildResearchContext(), cooled);
    expect(applied.context.briefs).toHaveLength(0);
    expect(applied.excludedBriefIds).toContain("rb-japan-autumn");
  });

  it("unrelated research -> eligible", () => {
    const history = [
      stubCandidate({
        businessDateKst: "2026-09-03",
        agendaCandidateId: "ac-gleneagles",
        researchBriefId: "rb-gleneagles",
        evidenceUrl: "https://example.com/gleneagles",
      }),
    ];
    const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
    const applied = applyResearchIdentityCooldown(buildResearchContext(), cooled);
    expect(applied.context.agendaCandidates).toHaveLength(1);
    expect(applied.context.briefs).toHaveLength(1);
  });

  it("outside 7-day window -> eligible", () => {
    const history = [
      stubCandidate({
        businessDateKst: "2026-08-27",
        agendaCandidateId: "ac-japan-autumn",
        researchBriefId: "rb-japan-autumn",
        evidenceUrl: officialEvidence.url,
      }),
    ];
    const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
    expect(cooled.agendaCandidateIds.size).toBe(0);
    const applied = applyResearchIdentityCooldown(buildResearchContext(), cooled);
    expect(applied.context.agendaCandidates).toHaveLength(1);
  });

  it("rejected or pending candidate still counts as recently used", () => {
    const rejected = stubCandidate({
      businessDateKst: "2026-09-02",
      agendaCandidateId: "ac-japan-autumn",
      researchBriefId: "rb-japan-autumn",
    });
    const pending = stubCandidate({
      businessDateKst: "2026-09-03",
      agendaCandidateId: "ac-japan-autumn",
      researchBriefId: "rb-japan-autumn",
    });
    // Human review status is not on CompletedMarketingCandidate — presence alone counts.
    const cooled = collectRecentResearchIdentities([rejected, pending], "2026-09-04", 7);
    expect(extractResearchIdentitiesFromCandidate(rejected).agendaCandidateIds.has("ac-japan-autumn")).toBe(
      true,
    );
    expect(cooled.agendaCandidateIds.has("ac-japan-autumn")).toBe(true);
    expect(cooled.researchBriefIds.has("rb-japan-autumn")).toBe(true);
  });

  it("no history -> current behavior preserved", () => {
    const cooled = collectRecentResearchIdentities([], "2026-09-04", 7);
    const context = buildResearchContext();
    const applied = applyResearchIdentityCooldown(context, cooled);
    expect(applied.context.agendaCandidates).toEqual(context.agendaCandidates);
    expect(applied.context.briefs).toEqual(context.briefs);
    expect(applied.excludedAgendaCandidateIds).toHaveLength(0);
  });

  it("canonical article URL from history excludes matching evidence", () => {
    const history = [
      stubCandidate({
        businessDateKst: "2026-09-03",
        agendaCandidateId: "ac-other",
        researchBriefId: "rb-other",
        evidenceUrl: "https://example.com/official",
      }),
    ];
    const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
    expect(agendaCandidateMatchesCooldown(agendaCandidate, cooled)).toBe(true);
    const normalized = normalizeSourceArticleIdentity({ url: officialEvidence.url });
    expect(normalized && cooled.sourceArticleIds.has(normalized)).toBe(true);
  });

  describe("exact article cooldown — not publisher cooldown", () => {
    const NYT_SOURCE = "nyt-travel-feed-uuid";
    const articleA = "https://www.nytimes.com/2026/09/01/travel/gleneagles.html";
    const articleB = "https://www.nytimes.com/2026/09/02/travel/scotland-rail.html";

    it("A: same canonical article URL -> excluded", () => {
      const history = [
        stubCandidate({
          businessDateKst: "2026-09-03",
          agendaCandidateId: "ac-hist",
          researchBriefId: "rb-hist",
          evidenceUrl: articleA,
        }),
      ];
      const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
      const candidate = {
        ...agendaCandidate,
        agendaCandidateId: "ac-fresh",
        researchBriefId: "rb-fresh",
        evidence: [{ ...officialEvidence, url: articleA, sourceId: NYT_SOURCE, evidenceId: "ev-a" }],
      };
      expect(agendaCandidateMatchesCooldown(candidate, cooled)).toBe(true);
    });

    it("B: same publisher/source but DIFFERENT article URL -> eligible", () => {
      const history = [
        stubCandidate({
          businessDateKst: "2026-09-03",
          agendaCandidateId: "ac-hist",
          researchBriefId: "rb-hist",
          evidenceUrl: articleA,
        }),
      ];
      // Force publisher-level sourceId onto historical evidence (via URL path still article-specific).
      const hist = history[0]!;
      hist.selectedAgenda = {
        ...hist.selectedAgenda,
        evidenceRefs: hist.selectedAgenda.evidenceRefs.map((ref) => ({
          ...ref,
          sourceId: NYT_SOURCE,
          url: articleA,
        })),
      };
      hist.contentAssignment = {
        ...hist.contentAssignment,
        evidenceRefs: hist.contentAssignment.evidenceRefs.map((ref) => ({
          ...ref,
          sourceId: NYT_SOURCE,
          url: articleA,
        })),
      };
      const cooled = collectRecentResearchIdentities([hist], "2026-09-04", 7);
      expect(cooled.sourceArticleIds.has(`source:${NYT_SOURCE}`)).toBe(false);
      const sibling = {
        ...agendaCandidate,
        agendaCandidateId: "ac-sibling",
        researchBriefId: "rb-sibling",
        evidence: [
          {
            ...officialEvidence,
            evidenceId: "ev-b",
            sourceId: NYT_SOURCE,
            url: articleB,
          },
        ],
      };
      expect(agendaCandidateMatchesCooldown(sibling, cooled)).toBe(false);
    });

    it("C: same agendaCandidateId -> excluded", () => {
      const history = [
        stubCandidate({
          businessDateKst: "2026-09-03",
          agendaCandidateId: "ac-japan-autumn",
          researchBriefId: "rb-unrelated",
          evidenceUrl: articleB,
        }),
      ];
      const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
      expect(agendaCandidateMatchesCooldown(agendaCandidate, cooled)).toBe(true);
    });

    it("D: same researchBriefId -> excluded", () => {
      const history = [
        stubCandidate({
          businessDateKst: "2026-09-03",
          agendaCandidateId: "ac-unrelated",
          researchBriefId: "rb-japan-autumn",
          evidenceUrl: articleB,
        }),
      ];
      const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
      expect(agendaCandidateMatchesCooldown(agendaCandidate, cooled)).toBe(true);
    });

    it("E: unrelated article -> eligible", () => {
      const history = [
        stubCandidate({
          businessDateKst: "2026-09-03",
          agendaCandidateId: "ac-other",
          researchBriefId: "rb-other",
          evidenceUrl: articleA,
        }),
      ];
      const cooled = collectRecentResearchIdentities(history, "2026-09-04", 7);
      expect(agendaCandidateMatchesCooldown(agendaCandidate, cooled)).toBe(false);
    });

    it("bare publisher sourceId alone never becomes article identity", () => {
      expect(normalizeSourceArticleIdentity({ sourceId: NYT_SOURCE })).toBeNull();
      expect(
        normalizeSourceArticleIdentity({
          sourceId: NYT_SOURCE,
          evidenceId: "ev-article-1",
        }),
      ).toBe(`source:${NYT_SOURCE}|evidence:ev-article-1`);
    });

    it("tracking-query variants of the same article share identity", () => {
      const a = normalizeSourceArticleIdentity({
        url: `${articleA}?utm_source=rss&utm_medium=feed&fbclid=abc`,
      });
      const b = normalizeSourceArticleIdentity({ url: articleA });
      expect(a).toBe(b);
    });
  });
});
