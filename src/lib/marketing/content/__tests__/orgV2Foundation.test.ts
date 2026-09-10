vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { buildDeliverableRequirements } from "@/lib/marketing/content/buildDeliverableRequirements";
import {
  buildEvidencePack,
  allowedEvidenceIdsFromPack,
  packHasAllowedFactualItems,
} from "@/lib/marketing/content/evidencePack";
import {
  projectSourceReferences,
  validateContentCompleteness,
} from "@/lib/marketing/content/completenessValidator";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { buildContentDraftPrompt } from "@/lib/marketing/cron/marketingPlanSpecialists";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";

const NOW = new Date("2026-09-02T03:00:00.000Z");
const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

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

function allow(overrides: Partial<GovernanceReviewResult> = {}): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
    ...overrides,
  };
}

describe("O-1 content-deliverable-requirements-v1", () => {
  it("derives requiredDestinations from multi-destination agenda", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Iberia cities",
        summary: "Four-city circuit.",
        destinations: ["Madrid", "Barcelona", "Lisbon", "Porto"],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    expect(handoff.deliverableRequirements?.contract).toBe("content-deliverable-requirements-v1");
    expect(handoff.deliverableRequirements?.requiredDestinations).toEqual([
      "Madrid",
      "Barcelona",
      "Lisbon",
      "Porto",
    ]);
    expect(handoff.deliverableRequirements?.requiredDestinationCount).toBe(4);
    expect(handoff.deliverableRequirements?.requiredOutputKinds).toEqual(["content_plan", "text_draft"]);
    expect(handoff.contentAssignment.deliverableRequirements?.requiredDestinationCount).toBe(4);
  });

  it("empty destinations → no destination requirement", () => {
    const handoff = prepareManagerToContentHandoff(
      { title: "Generic tip", summary: "No city list.", destinations: [] },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    expect(handoff.deliverableRequirements?.requiredDestinations).toEqual([]);
    expect(handoff.deliverableRequirements?.requiredDestinationCount).toBe(0);
  });
});

describe("O-2 evidence-pack-v1", () => {
  it("locks low-confidence facts as allowedForDraft=false; IDs subset of assignment", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Japan update",
        summary: "Mixed confidence facts.",
        evidenceRefs: [
          mapManagerEvidenceRef(officialEvidence, 0.9),
          mapManagerEvidenceRef(lowEvidence, 0.2),
        ],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    expect(handoff.evidencePack?.contract).toBe("evidence-pack-v1");
    const assignmentIds = new Set(handoff.contentAssignment.evidenceRefs.map((r) => r.evidenceId));
    for (const item of handoff.evidencePack!.items) {
      for (const id of item.evidenceRefIds) {
        expect(assignmentIds.has(id)).toBe(true);
      }
    }
    const lowFact = handoff.evidencePack!.items.find((item) => item.factId === "ev-low");
    expect(lowFact?.allowedForDraft).toBe(false);
    expect(allowedEvidenceIdsFromPack(handoff.evidencePack)).not.toContain("ev-low");
    expect(allowedEvidenceIdsFromPack(handoff.evidencePack).every((id) => assignmentIds.has(id))).toBe(
      true,
    );
  });

  it("CS prompt lists only allowed pack IDs when evidencePack present", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Japan update",
        summary: "Official + rumor.",
        evidenceRefs: [
          mapManagerEvidenceRef(officialEvidence, 0.9),
          mapManagerEvidenceRef(lowEvidence, 0.2),
        ],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    const prompt = buildContentDraftPrompt({
      productId: PRODUCT,
      channel: "threads",
      goal: "test",
      agenda: handoff.selectedAgenda.title,
      brief: null,
      constraints: [],
      memoryReferences: [],
      contentAssignment: handoff.contentAssignment,
      contentPlanScaffold: handoff.contentPlanScaffold,
      selectedAgenda: handoff.selectedAgenda,
      deliverableRequirements: handoff.deliverableRequirements,
      evidencePack: handoff.evidencePack,
    });
    expect(prompt).toContain("EVIDENCE_PACK");
    expect(prompt).toContain("DELIVERABLE_REQUIREMENTS");
    expect(prompt).toContain("AVAILABLE_EVIDENCE_REFS:");
    expect(prompt).toContain("ev-official");
    const availableSection = prompt.slice(prompt.indexOf("AVAILABLE_EVIDENCE_REFS:"));
    const availableOnly = availableSection.split("Grounding rules:")[0] ?? availableSection;
    expect(availableOnly).not.toContain("ev-low");
  });
});

describe("O-3/O-5/O-6 completeness validator + shared revision budget", () => {
  it("4 destinations / 1 covered → fail + hint; fail never calls GA", async () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Iberia",
        summary: "Four cities.",
        destinations: ["Madrid", "Barcelona", "Lisbon", "Porto"],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    const incomplete: ContentStrategistOutput = {
      title: "Madrid only",
      body: "Focus on Madrid this season.",
      channel: "threads",
      agenda: handoff.selectedAgenda.title,
      sourceReferences: ["https://example.com/official"],
      contentPlan: {
        ...handoff.contentPlanScaffold,
        evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
      },
      assignmentId: handoff.contentAssignment.assignmentId,
    };

    const validation = validateContentCompleteness({
      draft: incomplete,
      requirements: handoff.deliverableRequirements,
      evidencePack: handoff.evidencePack,
    });
    expect(validation.ok).toBe(false);
    expect(validation.missingDestinations).toEqual(
      expect.arrayContaining(["Barcelona", "Lisbon", "Porto"]),
    );
    expect(validation.revisionHints.some((h) => h.includes("Barcelona"))).toBe(true);

    let governanceCalls = 0;
    let draftCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => {
          draftCalls += 1;
          return incomplete;
        },
        requestGovernance: async () => {
          governanceCalls += 1;
          return allow();
        },
      },
    );
    expect(governanceCalls).toBe(0);
    expect(draftCalls).toBe(2); // first + one completeness revision
    expect(result.status).toBe("revision_required");
    expect(result.failure).toBeUndefined();
    expect(result.revisionRounds).toBe(1);
  });

  it("after revise covering all destinations → pass and call GA", async () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Iberia",
        summary: "Four cities.",
        destinations: ["Madrid", "Barcelona", "Lisbon", "Porto"],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    let draftCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => {
          draftCalls += 1;
          if (draftCalls === 1) {
            return {
              title: "Madrid",
              body: "Madrid highlight only.",
              channel: "threads",
              agenda: handoff.selectedAgenda.title,
              sourceReferences: ["https://example.com/official"],
              contentPlan: {
                ...handoff.contentPlanScaffold,
                evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
              },
            };
          }
          return {
            title: "Iberia circuit",
            body: "Madrid, Barcelona, Lisbon, and Porto in one season.",
            channel: "threads",
            agenda: handoff.selectedAgenda.title,
            sourceReferences: ["https://example.com/official"],
            contentPlan: {
              ...handoff.contentPlanScaffold,
              evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
            },
          };
        },
        requestGovernance: async () => allow(),
      },
    );
    expect(draftCalls).toBe(2);
    expect(result.status).not.toBe("revision_required");
    expect(["publish_ready", "approval_pending"]).toContain(result.status);
    expect(result.revisionRounds).toBe(1);
  });

  it("completeness consumes the single auto-revision budget before GA BLOCK", async () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Iberia",
        summary: "Four cities.",
        destinations: ["Madrid", "Barcelona", "Lisbon", "Porto"],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    let draftCalls = 0;
    let governanceCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => {
          draftCalls += 1;
          return {
            title: "Iberia circuit",
            body:
              draftCalls === 1
                ? "Madrid only incomplete."
                : "Madrid, Barcelona, Lisbon, and Porto covered.",
            channel: "threads",
            agenda: handoff.selectedAgenda.title,
            sourceReferences: ["https://example.com/official"],
            contentPlan: {
              ...handoff.contentPlanScaffold,
              evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
            },
          };
        },
        requestGovernance: async () => {
          governanceCalls += 1;
          return allow({
            decision: "BLOCK",
            reasons: ["unsupported_exact_price"],
            revisionHints: ["remove invented price"],
          });
        },
      },
    );
    // Completeness used the only auto round; GA BLOCK cannot revise again.
    expect(draftCalls).toBe(2);
    expect(governanceCalls).toBe(1);
    expect(result.revisionRounds).toBe(1);
    expect(result.status).toBe("revision_required");
  });

  it("projects sourceReferences from cited evidenceRefs; still-empty → fail", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Japan",
        summary: "Official guidance.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    expect(packHasAllowedFactualItems(handoff.evidencePack)).toBe(true);

    const projected = projectSourceReferences({
      draft: {
        title: "Japan",
        body: "Official autumn guidance.",
        channel: "threads",
        agenda: null,
        sourceReferences: [],
        contentPlan: {
          ...handoff.contentPlanScaffold,
          evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
        },
      },
      evidencePack: handoff.evidencePack,
    });
    expect(projected.sourceReferences).toContain("https://example.com/official");

    const empty = validateContentCompleteness({
      draft: {
        title: "Japan",
        body: "Claim without cites.",
        channel: "threads",
        agenda: null,
        sourceReferences: [],
        contentPlan: { ...handoff.contentPlanScaffold, evidenceRefs: [] },
      },
      requirements: buildDeliverableRequirements({
        assignment: handoff.contentAssignment,
        selectedAgenda: handoff.selectedAgenda,
        contentPlanScaffold: handoff.contentPlanScaffold,
        requireSourceReferencesWhenFactual: true,
      }),
      evidencePack: handoff.evidencePack,
    });
    expect(empty.ok).toBe(false);
    expect(empty.failures.some((f) => f.code === "missing_source_references")).toBe(true);
  });
});

describe("evidence pack builder unit", () => {
  it("buildEvidencePack mirrors handoff pack shape", () => {
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Topic",
        summary: "Summary",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { now: NOW },
    );
    const pack = buildEvidencePack({
      assignment: handoff.contentAssignment,
      selectedAgenda: handoff.selectedAgenda,
      now: NOW,
    });
    expect(pack.assignmentId).toBe(handoff.contentAssignment.assignmentId);
    expect(pack.items.every((item) => item.locked === true)).toBe(true);
  });
});
