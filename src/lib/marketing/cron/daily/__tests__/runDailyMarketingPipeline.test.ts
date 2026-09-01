vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { MAX_AUTO_REVISION_ROUNDS } from "@/lib/marketing/bot/organization/envelope";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import { createInMemoryGovernanceReviewStore } from "@/lib/marketing/content/governance/store/governanceReviewStore";
import { buildLogicalDailyRunKey } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { runDailyMarketingPipeline } from "@/lib/marketing/cron/daily/runDailyMarketingPipeline";
import {
  createInMemoryDailyMarketingRunRepository,
  resetDefaultDailyMarketingRunRepository,
} from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  buildManagerAgendaSelectionPrompt,
  parseManagerAgendaSelection,
  resolveResearchPrecondition,
} from "@/lib/marketing/cron/daily/resolveMarketingManagerAgenda";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";
import {
  buildResearchContext,
  managerSelectJson,
  NOW,
  PRODUCT,
  productlessManagerJson,
} from "@/lib/marketing/cron/daily/__tests__/fixtures";
import {
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_7,
  assertCanInvokePublicationAdapter,
} from "@/lib/marketing/social/publication/governanceBoundary";

const BUSINESS_DATE = "2026-09-02";
const LOGICAL_KEY = buildLogicalDailyRunKey({
  routineId: DAILY_MARKETING_ROUTINE_ID,
  businessDateKst: BUSINESS_DATE,
});

const draft: ContentStrategistOutput = {
  title: "Japan autumn update",
  body: "Official guidance says autumn travel planning is easier.",
  channel: "threads",
  agenda: "Japan autumn travel update",
  sourceReferences: ["evidence:ev-official"],
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

function baseDeps(overrides: {
  governance?: () => Promise<GovernanceReviewResult>;
  draft?: () => Promise<ContentStrategistOutput>;
  managerJson?: string;
} = {}) {
  let governanceCalls = 0;
  let draftCalls = 0;
  const repo = createInMemoryDailyMarketingRunRepository();
  const contentAssignmentStore = createInMemoryContentAssignmentStore();
  const governanceReviewStore = createInMemoryGovernanceReviewStore();

  return {
    repo,
    contentAssignmentStore,
    governanceReviewStore,
    governanceCalls: () => governanceCalls,
    draftCalls: () => draftCalls,
    deps: {
      repo,
      now: NOW,
      contentAssignmentStore,
      governanceReviewStore,
      getResearchContext: async () => buildResearchContext(),
      invokeManagerProfile: async () => overrides.managerJson ?? managerSelectJson(),
      requestDraft: async () => {
        draftCalls += 1;
        return overrides.draft ? await overrides.draft() : { ...draft, assignmentId: null };
      },
      requestGovernance: async () => {
        governanceCalls += 1;
        return overrides.governance ? await overrides.governance() : allow();
      },
      requestPerformance: async () => ({ unavailable: true as const, reason: "test" }),
    },
  };
}

describe("resolveResearchPrecondition", () => {
  it("distinguishes empty, degraded, unavailable", () => {
    expect(resolveResearchPrecondition(buildResearchContext({ status: "empty", agendaCandidates: [] }))).toEqual({
      proceed: false,
      reason: "RESEARCH_EMPTY",
    });
    expect(resolveResearchPrecondition(buildResearchContext({ status: "unavailable" }))).toEqual({
      proceed: false,
      reason: "RESEARCH_UNAVAILABLE",
    });
    expect(resolveResearchPrecondition(buildResearchContext({ status: "degraded" }))).toEqual({
      proceed: true,
      degraded: true,
    });
    expect(resolveResearchPrecondition(buildResearchContext())).toEqual({ proceed: true, degraded: false });
  });
});

describe("runDailyMarketingPipeline", () => {
  beforeEach(() => {
    resetDefaultDailyMarketingRunRepository();
  });

  it("A: research ok → MM → CS → GA ALLOW → ready_for_human_review", async () => {
    const { deps } = baseDeps();
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.idempotent).toBe(false);
    expect(result.run.status).toBe("completed");
    expect(result.candidate?.status).toBe("ready_for_human_review");
    expect(result.candidate?.contract).toBe("completed-marketing-candidate-v1");
    expect(result.run.selectedAgendaId).toBeTruthy();
    expect(result.run.assignmentId).toBeTruthy();
    expect(result.candidate?.governanceDecision?.decision).toBe("ALLOW");
  });

  it("B: GA REVIEW → needs_human_review without automatic revision", async () => {
    const { deps, draftCalls, governanceCalls } = baseDeps({
      governance: async () => allow({ decision: "REVIEW", humanApprovalRequired: true }),
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.status).toBe("needs_human_review");
    expect(draftCalls()).toBe(1);
    expect(governanceCalls()).toBe(1);
    expect(result.run.observability.revisionCount).toBeLessThanOrEqual(MAX_AUTO_REVISION_ROUNDS);
  });

  it("C: GA BLOCK → one revision → ALLOW", async () => {
    let governanceCalls = 0;
    const { deps, draftCalls } = baseDeps({
      governance: async () => {
        governanceCalls += 1;
        if (governanceCalls === 1) {
          return allow({ decision: "BLOCK", revisionHints: ["adjust hook"] });
        }
        return allow();
      },
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(draftCalls()).toBe(1 + MAX_AUTO_REVISION_ROUNDS);
    expect(governanceCalls).toBe(2);
    expect(result.candidate?.status).toBe("ready_for_human_review");
    expect(result.run.observability.revisionCount).toBe(1);
  });

  it("D: GA BLOCK → one revision → still BLOCK", async () => {
    const { deps } = baseDeps({
      governance: async () => allow({ decision: "BLOCK", revisionHints: ["unsupported claim"] }),
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.status).toBe("blocked");
    expect(result.run.failureReason).toBe("GOVERNANCE_BLOCKED");
    expect(result.run.observability.revisionCount).toBe(1);
  });

  it("E: productless agenda survives full pipeline", async () => {
    const { deps } = baseDeps({ managerJson: productlessManagerJson() });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.selectedAgenda.provenance.agendaCandidateId).toBeNull();
    expect(result.candidate?.contentAssignment.matchedProductIds).toEqual([]);
    expect(result.candidate?.status).toBe("ready_for_human_review");
  });

  it("F: research empty is explicitly represented", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo,
        now: NOW,
        getResearchContext: async () => buildResearchContext({ status: "empty", agendaCandidates: [], briefs: [] }),
        invokeManagerProfile: async () => managerSelectJson(),
      },
    );
    expect(result.candidate).toBeNull();
    expect(result.run.status).toBe("deferred");
    expect(result.run.failureReason).toBe("RESEARCH_EMPTY");
    expect(result.run.researchStatus).toBe("empty");
  });

  it("G: research degraded proceeds with degraded flag", async () => {
    const { deps } = baseDeps();
    deps.getResearchContext = async () => buildResearchContext({ status: "degraded" });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.run.degraded).toBe(true);
    expect(result.run.researchStatus).toBe("degraded");
    expect(result.candidate?.status).toBe("ready_for_human_review");
  });

  it("H: research unavailable does not masquerade as empty", async () => {
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        now: NOW,
        getResearchContext: async () => buildResearchContext({ status: "unavailable" }),
      },
    );
    expect(result.run.failureReason).toBe("RESEARCH_UNAVAILABLE");
    expect(result.run.researchStatus).toBe("unavailable");
    expect(result.run.status).toBe("failed");
  });

  it("I: MM defer handled safely", async () => {
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        now: NOW,
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () =>
          JSON.stringify({ decision: "defer", deferReason: "evidence too weak" }),
      },
    );
    expect(result.run.failureReason).toBe("MANAGER_DEFERRED");
    expect(result.run.status).toBe("deferred");
    expect(result.candidate).toBeNull();
  });

  it("J: MM malformed output handled safely", async () => {
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        now: NOW,
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () => "not json",
      },
    );
    expect(result.run.failureReason).toBe("MANAGER_INVALID_OUTPUT");
    expect(result.candidate).toBeNull();
  });

  it("K: same logical daily run is idempotent", async () => {
    const { deps, repo } = baseDeps();
    const first = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const second = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(first.candidate?.candidateId).toBe(second.candidate?.candidateId);
    expect(second.idempotent).toBe(true);
    expect(second.run.status).toBe("skipped_idempotent");
    const stored = await repo.findCandidateByLogicalKey(LOGICAL_KEY);
    expect(stored?.logicalRunKey).toBe(LOGICAL_KEY);
  });

  it("L: assignment IDs preserved end-to-end", async () => {
    const { deps } = baseDeps();
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const assignmentId = result.run.assignmentId;
    expect(result.candidate?.contentAssignment.assignmentId).toBe(assignmentId);
    expect(result.candidate?.contentAssignment.selectedAgendaId).toBe(result.run.selectedAgendaId);
  });

  it("M: research/evidence provenance survives to final candidate", async () => {
    const { deps } = baseDeps();
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.provenance.researchStatus).toBe("ok");
    expect(result.candidate?.contentAssignment.evidenceRefs.length).toBeGreaterThan(0);
    expect(result.candidate?.selectedAgenda.provenance.agendaCandidateId).toBe("ac-japan-autumn");
  });

  it("N: governance decision survives persistence", async () => {
    const { deps, repo } = baseDeps();
    await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    const stored = await repo.findCandidateByLogicalKey(LOGICAL_KEY);
    expect(stored?.governanceDecision?.decision).toBe("ALLOW");
    expect(stored?.governanceDecision?.assignmentId).toBe(stored?.contentAssignment.assignmentId);
  });

  it("O: no embeddings leak in candidate payload", async () => {
    const { deps } = baseDeps();
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(jsonContainsForbiddenBotLeak(result.candidate)).toBe(false);
    expect(JSON.stringify(result.candidate)).not.toMatch(/"embedding"/);
  });

  it("P: revisionCount stays <= 1", async () => {
    const { deps } = baseDeps({
      governance: async () => allow({ decision: "BLOCK", revisionHints: ["fix"] }),
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.run.observability.revisionCount).toBeLessThanOrEqual(1);
  });

  it("Q: malformed GA fails closed to needs_human_review", async () => {
    const { deps } = baseDeps({
      governance: async () =>
        ({
          decision: "MAYBE" as GovernanceReviewResult["decision"],
          riskScore: 0,
          reasons: [],
          revisionHints: [],
          humanApprovalRequired: false,
          semanticAvailable: true,
        }) as GovernanceReviewResult,
    });
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      deps,
    );
    expect(result.candidate?.status).toBe("needs_human_review");
    expect(result.candidate?.governanceDecision?.malformed).toBe(true);
  });

  it("R: provider failure is classified", async () => {
    const result = await runDailyMarketingPipeline(
      { productId: PRODUCT, channel: "threads", businessDateKst: BUSINESS_DATE },
      {
        repo: createInMemoryDailyMarketingRunRepository(),
        now: NOW,
        getResearchContext: async () => buildResearchContext(),
        invokeManagerProfile: async () => {
          throw new Error("provider down");
        },
      },
    );
    expect(result.run.failureReason).toBe("RUNTIME_PROVIDER_FAILED");
  });

  it("S/T: publication safety boundary unchanged", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_7).toBe(0);
    expect(() => assertCanInvokePublicationAdapter("cron_daily_plan")).toThrow(/denied/);
  });

  it("parseManagerAgendaSelection keeps manager rationale", () => {
    const context = buildResearchContext();
    const parsed = parseManagerAgendaSelection(managerSelectJson(), context);
    expect(parsed.outcome).toBe("selected");
    if (parsed.outcome === "selected") {
      expect(parsed.managerRationale).toContain("timely official update");
      expect(parsed.input.agendaCandidateId).toBe("ac-japan-autumn");
    }
    const prompt = buildManagerAgendaSelectionPrompt(context);
    expect(prompt).toContain("do NOT auto-select rank #1");
    expect(prompt).not.toMatch(/"embedding"/);
  });
});
