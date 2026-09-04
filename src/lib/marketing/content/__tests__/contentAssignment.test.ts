vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { createSelectedAgenda } from "@/lib/marketing/content/createSelectedAgenda";
import { createContentAssignment } from "@/lib/marketing/content/createContentAssignment";
import { buildContentPlanScaffold } from "@/lib/marketing/content/buildContentPlanScaffold";
import { recommendContentFormats } from "@/lib/marketing/content/recommendContentFormats";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import {
  createInMemoryContentAssignmentStore,
  getContentAssignmentById,
} from "@/lib/marketing/content/store/contentAssignmentStore";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";

const NOW = new Date("2026-09-02T03:00:00.000Z");

const officialEvidence: CompactManagerEvidenceRef = {
  evidenceId: "ev-official",
  sourceId: "src-official",
  sourceType: "official_government",
  sourceName: "JNTO",
  isOfficial: true,
  evidenceType: "official_statement",
  url: "https://example.com/official",
  reference: null,
  excerpt: "Japan entry guidance updated for autumn travel.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
};

const lowEvidence: CompactManagerEvidenceRef = {
  ...officialEvidence,
  evidenceId: "ev-low",
  sourceId: "src-community",
  sourceType: "community",
  sourceName: "Forum",
  isOfficial: false,
  url: null,
  excerpt: "Unverified rumor about visa changes.",
};

function allow(): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
  };
}

describe("SelectedAgenda contract", () => {
  it("remains separate from AgendaCandidate and stores manager decision", () => {
    const agenda = createSelectedAgenda({
      title: "Japan autumn travel update",
      summary: "Official guidance changed.",
      agendaCandidateId: "ac-123",
      researchBriefId: "rb-456",
      researchScoreAtSelection: 0.82,
      rationale: ["timely official update"],
      now: NOW,
    });
    expect(agenda.contract).toBe("selected-agenda-v1");
    expect(agenda.provenance.agendaCandidateId).toBe("ac-123");
    expect(agenda.provenance.researchScoreAtSelection).toBe(0.82);
    expect(agenda.id).toMatch(/^sa_/);
  });
});

describe("ContentAssignment handoff", () => {
  let store: ReturnType<typeof createInMemoryContentAssignmentStore>;

  beforeEach(() => {
    store = createInMemoryContentAssignmentStore();
  });

  it("creates valid assignment from manager decision", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Japan autumn travel update",
        summary: "Official guidance changed.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
        matchedProductIds: ["prod-1"],
        commercialIntent: "mixed",
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.contract).toBe("content-assignment-v1");
    expect(handoff.contentAssignment.selectedAgendaId).toBe(handoff.selectedAgenda.id);
    expect(handoff.contentPlanScaffold.contract).toBe("content-plan-v1");
  });

  it("keeps productless agenda valid", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Grand Canyon limited reopening",
        summary: "Useful travel safety update without product linkage.",
        commercialIntent: "informational",
        matchedProductIds: [],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.88)],
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.matchedProductIds).toHaveLength(0);
    expect(handoff.contentAssignment.commercialIntent).toBe("informational");
    expect(handoff.contentPlanScaffold.productLinkageStrategy).toMatch(/without product/i);
  });

  it("carries matchedProductIds without forcing ad tone", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Spain Portugal combo interest",
        summary: "Seasonal demand rising.",
        matchedProductIds: ["prod-spain"],
        commercialIntent: "mixed",
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.matchedProductIds).toContain("prod-spain");
    expect(handoff.contentPlanScaffold.ctaStrategy).not.toMatch(/hard sell/i);
  });

  it("preserves evidence refs through handoff", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Visa update",
        summary: "Official notice.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.evidenceRefs[0]?.url).toBe(officialEvidence.url);
    expect(handoff.contentAssignment.facts.length).toBeGreaterThan(0);
    expect(jsonContainsForbiddenBotLeak(handoff)).toBe(false);
  });

  it("adds risk notes for weak evidence", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Unverified visa rumor",
        summary: "Community claim only.",
        evidenceRefs: [mapManagerEvidenceRef(lowEvidence, 0.2)],
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.riskNotes.some((note) => /low_credibility|missing_url/i.test(note))).toBe(
      true,
    );
    expect(handoff.contentPlanScaffold.factsToAvoid.length).toBeGreaterThan(0);
  });

  it("is idempotent for duplicate assignment creation", () => {
    const input = {
      title: "Kenya travel interest",
      summary: "Timely destination topic.",
      idempotencyKey: "idem-kenya-1",
    };
    const first = prepareManagerToContentHandoff(input, { store, now: NOW });
    const second = prepareManagerToContentHandoff(input, { store, now: NOW });
    expect(second.contentAssignment.assignmentId).toBe(first.contentAssignment.assignmentId);
    expect(store.list().length).toBe(1);
  });

  it("bounds assignment facts and evidence", () => {
    const manyEvidence = Array.from({ length: 20 }, (_, i) =>
      mapManagerEvidenceRef({ ...officialEvidence, evidenceId: `ev-${i}`, excerpt: `fact ${i}` }, 0.8),
    );
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Many facts topic",
        summary: "Summary",
        evidenceRefs: manyEvidence,
      },
      { store, now: NOW },
    );
    expect(handoff.contentAssignment.evidenceRefs.length).toBeLessThanOrEqual(12);
    expect(handoff.contentAssignment.facts.length).toBeLessThanOrEqual(10);
  });
});

describe("format recommendation", () => {
  it("recommends different formats for different characteristics", () => {
    const informational = recommendContentFormats({
      commercialIntent: "informational",
      destinations: ["Japan"],
      factsCount: 5,
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      urgency: "normal",
    });
    const timelyShort = recommendContentFormats({
      commercialIntent: "informational",
      destinations: [],
      factsCount: 2,
      evidenceRefs: [],
      urgency: "high",
    });
    expect(informational[0]?.format).not.toBeUndefined();
    expect(timelyShort.find((item) => item.format === "threads_text")!.score).toBeGreaterThan(
      informational.find((item) => item.format === "threads_text")!.score - 0.3,
    );
    const dense = recommendContentFormats({
      commercialIntent: "informational",
      destinations: ["Peru"],
      factsCount: 6,
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      urgency: "low",
    });
    expect(dense.find((item) => item.format === "blog_article")!.score).toBeGreaterThan(0.4);
  });
});

describe("pipeline preserves assignment without re-selecting agenda", () => {
  it("passes contentAssignment to Content Strategist envelope", async () => {
    const store = createInMemoryContentAssignmentStore();
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Scotland luxury camp trend",
        summary: "Travel lifestyle angle.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.85)],
      },
      { store, now: NOW },
    );

    let capturedAgenda: string | null = null;
    const draft: ContentStrategistOutput = {
      title: "Scotland trend",
      body: "Travel lifestyle angle.",
      channel: "threads",
      agenda: handoff.selectedAgenda.title,
      sourceReferences: ["evidence:ev-official"],
      assignmentId: handoff.contentAssignment.assignmentId,
    };

    const result = await runDepartmentPipeline(
      {
        productId: "98a889e9-fbc4-41e3-8302-0d2b042fbe0a",
        channel: "threads",
        goal: "daily content",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
      },
      {
        requestDraft: async (envelope) => {
          capturedAgenda = envelope.payload.agenda;
          expect(envelope.payload.contentAssignment?.assignmentId).toBe(handoff.contentAssignment.assignmentId);
          expect(envelope.payload.selectedAgenda?.id).toBe(handoff.selectedAgenda.id);
          expect(envelope.payload.constraints.some((c) => /preserve.*agenda|re-select/i.test(c))).toBe(true);
          return draft;
        },
        requestGovernance: async () => allow(),
      },
    );

    expect(result.status).toBe("publish_ready");
    expect(capturedAgenda).toBe(handoff.selectedAgenda.title);
    expect(result.draft?.assignmentId).toBe(handoff.contentAssignment.assignmentId);
  });
});

describe("content assignment lookup", () => {
  it("returns stored assignment without embeddings", () => {
    const store = createInMemoryContentAssignmentStore();
    const handoff = prepareManagerToContentHandoff(
      { title: "Topic", summary: "Summary", idempotencyKey: "lookup-1" },
      { store, now: NOW },
    );
    const lookup = getContentAssignmentById(handoff.contentAssignment.assignmentId, store);
    expect(lookup.status).toBe("ok");
    if (lookup.status === "ok") {
      expect(lookup.assignment.topic).toBe("Topic");
      expect(jsonContainsForbiddenBotLeak(lookup)).toBe(false);
    }
  });
});

describe("commercial relevance does not dominate format choice for productless topics", () => {
  it("still recommends informational formats strongly", () => {
    const assignment = createContentAssignment({
      selectedAgenda: createSelectedAgenda({
        title: "Flood recovery travel note",
        summary: "Public safety update.",
        commercialIntent: "informational",
        matchedProductIds: [],
        now: NOW,
      }),
      now: NOW,
    });
    const plan = buildContentPlanScaffold(
      assignment,
      createSelectedAgenda({ title: assignment.topic, summary: "Public safety update.", now: NOW }),
    );
    expect(plan.recommendedFormats[0]?.format).toBeTruthy();
    expect(plan.productLinkageStrategy).toMatch(/without product/i);
  });
});
