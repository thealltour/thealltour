vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import {
  AGENT_IDENTITY_ENFORCEMENT,
  MAX_AUTO_REVISION_ROUNDS,
  createHandoffEnvelope,
  parseHandoffEnvelope,
  serializeHandoffEnvelope,
} from "@/lib/marketing/bot/organization/envelope";
import { applyPipelineApproval, runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import { HERMES_HANDOFF_CLASSIFICATION, buildHermesOneshotArgv } from "@/lib/marketing/bot/organization/hermesHandoff";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";

const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

const draft: ContentStrategistOutput = {
  title: "스페인 포르투갈 안내",
  body: "캠페인 초안.",
  channel: "threads",
  agenda: "iberia-core",
  sourceReferences: [`product:${PRODUCT}`],
};

function allowResult(overrides: Partial<GovernanceReviewResult> = {}): GovernanceReviewResult {
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

describe("handoff envelopes", () => {
  it("serializes and parses Manager → Content requests", () => {
    const envelope = createHandoffEnvelope({
      sourceAgent: "marketing-manager",
      targetAgent: "content-strategist",
      taskType: "content_draft",
      productId: PRODUCT,
      channel: "threads",
      goal: "홍보",
      contextMemoryRefs: ["memory:1"],
      payload: {
        productId: PRODUCT,
        channel: "threads",
        goal: "홍보",
        agenda: "iberia-core",
        brief: { productFound: true },
        constraints: ["no invent"],
        memoryReferences: ["memory:1"],
      },
    });
    const roundTrip = parseHandoffEnvelope(serializeHandoffEnvelope(envelope));
    expect(roundTrip.targetAgent).toBe("content-strategist");
    expect(roundTrip.payload).toEqual(envelope.payload);
    expect(jsonContainsForbiddenBotLeak(roundTrip)).toBe(false);
  });

  it("rejects embedding vectors in envelopes", () => {
    expect(() =>
      createHandoffEnvelope({
        sourceAgent: "governance-auditor",
        targetAgent: "marketing-manager",
        taskType: "governance_review",
        productId: PRODUCT,
        channel: "threads",
        goal: null,
        contextMemoryRefs: [],
        payload: { embedding: [0.1, 0.2, 0.3] },
      }),
    ).toThrow(MarketingBotValidationError);
  });

  it("uses application-level Hermes CLI, not a native profile RPC", () => {
    expect(HERMES_HANDOFF_CLASSIFICATION).toBe("application_level");
    expect(buildHermesOneshotArgv("content-strategist", "ping")).toEqual([
      "hermes",
      "-p",
      "content-strategist",
      "--yolo",
      "--ignore-rules",
      "-z",
      "ping",
    ]);
  });
});

describe("department pipeline", () => {
  it("maps ALLOW to publish_ready without publishing", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () => allowResult(),
      },
    );
    expect(result.status).toBe("publish_ready");
    expect(result.publishActionIncluded).toBe(false);
    expect(result.governance?.decision).toBe("ALLOW");
    expect(result.nextAction).toBe("stop_before_publish");
    expect(result.envelopes.some((env) => env.targetAgent === "content-strategist")).toBe(true);
    expect(result.envelopes.some((env) => env.sourceAgent === "governance-auditor")).toBe(true);
  });

  it("maps REVIEW to approval_pending and approval_required", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () =>
          allowResult({
            decision: "REVIEW",
            riskScore: 0.55,
            reasons: ["SEMANTIC_SIMILARITY_REVIEW"],
            humanApprovalRequired: true,
          }),
      },
    );
    expect(result.status).toBe("approval_pending");
    expect(result.approvalHandoff?.type).toBe("approval_required");
    expect(result.approvalHandoff?.recommendedAction).toBe("REQUEST_CHANGES");
  });

  it("maps BLOCK to one revision round then human if still blocked", async () => {
    let drafts = 0;
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => {
          drafts += 1;
          return draft;
        },
        requestGovernance: async () =>
          allowResult({
            decision: "BLOCK",
            reasons: ["EXACT_DUPLICATE"],
            revisionHints: ["hook 변경"],
            humanApprovalRequired: false,
          }),
      },
    );
    expect(drafts).toBe(1 + MAX_AUTO_REVISION_ROUNDS);
    expect(result.revisionRounds).toBe(1);
    expect(result.status).toBe("revision_required");
    expect(result.publishActionIncluded).toBe(false);
  });

  it("applies APPROVE / REJECT / REQUEST_CHANGES without publishing", async () => {
    const pending = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () =>
          allowResult({ decision: "REVIEW", reasons: ["SEMANTIC_SIMILARITY_REVIEW"], humanApprovalRequired: true }),
      },
    );
    const approved = applyPipelineApproval(pending, "APPROVE");
    expect(approved.status).toBe("approved");
    expect(approved.publishActionIncluded).toBe(false);
    expect(applyPipelineApproval(pending, "REJECT").status).toBe("rejected");
    expect(applyPipelineApproval(pending, "REQUEST_CHANGES").status).toBe("revision_required");
  });

  it("stops safely when Content Strategist is unavailable", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => {
          throw new Error("profile down");
        },
        requestGovernance: async () => allowResult(),
      },
    );
    expect(result.status).toBe("handoff_failed");
    expect(result.failure?.code).toBe("content_unavailable");
    expect(result.draft).toBeUndefined();
    expect(result.nextAction).toBe("safe_stop");
  });

  it("does not mark publish_ready when Governance is unavailable", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () => {
          throw new Error("auditor down");
        },
      },
    );
    expect(result.status).toBe("handoff_failed");
    expect(result.failure?.code).toBe("governance_unavailable");
    expect(result.status).not.toBe("publish_ready");
  });

  it("keeps the content pipeline going when Performance is unavailable", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () => allowResult(),
        requestPerformance: async () => {
          throw new Error("analyst down");
        },
      },
    );
    expect(result.status).toBe("publish_ready");
    expect(result.performance).toEqual({ unavailable: true, reason: "performance_analyst_unavailable" });
  });

  it("sends semantic-unavailable ALLOW to human approval", async () => {
    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      {
        requestDraft: async () => draft,
        requestGovernance: async () => allowResult({ semanticAvailable: false }),
      },
    );
    expect(result.status).toBe("approval_pending");
  });

  it("keeps prompt/profile ACL only and max revision 1", () => {
    expect(AGENT_IDENTITY_ENFORCEMENT).toBe("prompt_profile_acl_only");
    expect(MAX_AUTO_REVISION_ROUNDS).toBe(1);
  });
});
