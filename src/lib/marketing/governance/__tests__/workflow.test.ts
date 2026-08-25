import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { applyApprovalDecision } from "@/lib/marketing/governance/applyApprovalDecision";
import { applyGovernancePolicy } from "@/lib/marketing/governance/applyGovernancePolicy";
import { canAutoPublish } from "@/lib/marketing/governance/canAutoPublish";
import {
  GOVERNANCE_ALLOW_MAX_RISK,
  GOVERNANCE_POLICY_VERSION,
  channelGovernancePolicy,
} from "@/lib/marketing/governance/constants";
import { evaluateGovernanceWorkflow } from "@/lib/marketing/governance/evaluateGovernanceWorkflow";
import { emptyAgendaStats } from "@/lib/marketing/governance/evaluators";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import type { GovernanceLookups } from "@/lib/marketing/governance/lookups";
import { revisionHintsForReasons } from "@/lib/marketing/governance/revisionHints";
import type {
  GovernanceAgendaStats,
  GovernanceCandidate,
  GovernanceChannelStats,
  GovernanceReason,
  GovernanceResult,
} from "@/lib/marketing/governance/types";

const CONTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENDA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-08-25T00:00:00.000Z");

function candidate(overrides: Partial<GovernanceCandidate> = {}): GovernanceCandidate {
  return {
    title: "효도여행 일정",
    body: "부모님과 함께 떠나는 스페인 10일 일정입니다.",
    channel: "threads",
    agendaId: AGENDA_ID,
    ...overrides,
  };
}

function channelStats(overrides: Partial<GovernanceChannelStats> = {}): GovernanceChannelStats {
  return {
    channel: "threads",
    dailyCount: 0,
    dailyMax: 3,
    cooldownDays: 7,
    sameAgendaRecentCount: 0,
    ...overrides,
  };
}

function agendaStats(overrides: Partial<GovernanceAgendaStats> = {}): GovernanceAgendaStats {
  return {
    ...emptyAgendaStats(),
    agendaId: AGENDA_ID,
    agendaKey: "filial-trip",
    ...overrides,
  };
}

function governanceResult(overrides: Partial<GovernanceResult> = {}): GovernanceResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: [{ code: "NO_RISK_SIGNAL", severity: "info" }],
    checkedAt: NOW.toISOString(),
    semanticAvailable: true,
    matchedMemories: [],
    agendaStats: agendaStats(),
    channelStats: channelStats(),
    ...overrides,
  };
}

function lookups(overrides: Partial<GovernanceLookups> = {}): GovernanceLookups {
  return {
    findByContentHash: async () => null,
    findByNormalizedHash: async () => null,
    retrieveSimilar: async () => ({ status: "ok", matches: [] }),
    loadAgendaStats: async () => agendaStats(),
    loadChannelStats: async () => channelStats(),
    loadMatchedMemories: async () => [],
    ...overrides,
  };
}

describe("channel auto-publish policy", () => {
  it("allows Threads as the only v1 auto-publish candidate", () => {
    expect(channelGovernancePolicy("threads").autoPublishEnabled).toBe(true);
    expect(channelGovernancePolicy("instagram").autoPublishEnabled).toBe(false);
    expect(channelGovernancePolicy("naver_blog").autoPublishEnabled).toBe(false);
    expect(channelGovernancePolicy("naver_band").autoPublishEnabled).toBe(false);
    expect(channelGovernancePolicy("kakao_channel").autoPublishEnabled).toBe(false);
  });
});

describe("applyGovernancePolicy", () => {
  it("maps ALLOW to publish_ready", () => {
    const policy = applyGovernancePolicy(governanceResult(), { now: NOW });
    expect(policy.action).toBe("PROCEED");
    expect(policy.workflowState).toBe("publish_ready");
    expect(policy.humanApprovalRequired).toBe(false);
    expect(policy.revisionRequired).toBe(false);
    expect(policy.autoPublishAllowed).toBe(true);
    expect(policy.policyVersion).toBe(GOVERNANCE_POLICY_VERSION);
    expect(policy.summary).toBe("중복 및 게시 빈도 위험 신호 없음");
  });

  it("maps REVIEW to approval_pending", () => {
    const policy = applyGovernancePolicy(
      governanceResult({
        decision: "REVIEW",
        riskScore: 0.55,
        reasons: [{ code: "SEMANTIC_SIMILARITY_REVIEW", severity: "medium", value: 0.74 }],
      }),
      { now: NOW },
    );
    expect(policy.action).toBe("REQUEST_APPROVAL");
    expect(policy.workflowState).toBe("approval_pending");
    expect(policy.humanApprovalRequired).toBe(true);
    expect(policy.autoPublishAllowed).toBe(false);
    expect(policy.summary).toBe("유사 콘텐츠 또는 게시 빈도 검토 필요");
  });

  it("maps BLOCK to revision_required", () => {
    const policy = applyGovernancePolicy(
      governanceResult({
        decision: "BLOCK",
        riskScore: 1,
        reasons: [{ code: "EXACT_DUPLICATE", severity: "critical", matchedContentId: CONTENT_ID }],
      }),
      { now: NOW },
    );
    expect(policy.action).toBe("REQUEST_REVISION");
    expect(policy.workflowState).toBe("revision_required");
    expect(policy.humanApprovalRequired).toBe(false);
    expect(policy.revisionRequired).toBe(true);
    expect(policy.autoPublishAllowed).toBe(false);
    expect(policy.summary).toBe("중복 또는 플랫폼 빈도 정책 위반");
  });

  it("sends semantic unavailable ALLOW to approval_pending", () => {
    const policy = applyGovernancePolicy(
      governanceResult({ semanticAvailable: false }),
      { now: NOW },
    );
    expect(policy.action).toBe("REQUEST_APPROVAL");
    expect(policy.workflowState).toBe("approval_pending");
    expect(policy.humanApprovalRequired).toBe(true);
    expect(policy.autoPublishAllowed).toBe(false);
    expect(policy.policyOverrides.map((override) => override.code)).toContain("SEMANTIC_UNAVAILABLE");
  });

  it("keeps exact duplicate BLOCK when semantic is unavailable", () => {
    const policy = applyGovernancePolicy(
      governanceResult({
        decision: "BLOCK",
        riskScore: 1,
        semanticAvailable: false,
        reasons: [{ code: "EXACT_DUPLICATE", severity: "critical", matchedContentId: CONTENT_ID }],
      }),
      { now: NOW },
    );
    expect(policy.workflowState).toBe("revision_required");
    expect(policy.action).toBe("REQUEST_REVISION");
    expect(policy.policyOverrides).toEqual([]);
  });

  it("escalates SAME_CHANNEL_RECENT_SIMILAR to revision_required", () => {
    const policy = applyGovernancePolicy(
      governanceResult({
        decision: "REVIEW",
        riskScore: 0.72,
        reasons: [{ code: "SAME_CHANNEL_RECENT_SIMILAR", severity: "high" }],
      }),
      { now: NOW },
    );
    expect(policy.action).toBe("REQUEST_REVISION");
    expect(policy.workflowState).toBe("revision_required");
    expect(policy.policyOverrides.map((override) => override.code)).toContain("HIGH_RISK_REASON");
  });

  it("keeps Instagram ALLOW as publish_ready without auto-publish", () => {
    const policy = applyGovernancePolicy(
      governanceResult({
        channelStats: channelStats({ channel: "instagram", dailyMax: 1 }),
      }),
      { now: NOW },
    );
    expect(policy.action).toBe("PROCEED");
    expect(policy.workflowState).toBe("publish_ready");
    expect(policy.autoPublishAllowed).toBe(false);
    expect(policy.humanApprovalRequired).toBe(false);
  });
});

describe("canAutoPublish", () => {
  it("allows a safe Threads ALLOW", () => {
    expect(canAutoPublish(governanceResult())).toBe(true);
  });

  it("denies Instagram even when governance is ALLOW", () => {
    expect(
      canAutoPublish(
        governanceResult({
          channelStats: channelStats({ channel: "instagram", dailyMax: 1 }),
        }),
      ),
    ).toBe(false);
  });

  it("denies when semantic search is unavailable", () => {
    expect(canAutoPublish(governanceResult({ semanticAvailable: false }))).toBe(false);
  });

  it("denies when risk exceeds the ALLOW band", () => {
    expect(canAutoPublish(governanceResult({ riskScore: GOVERNANCE_ALLOW_MAX_RISK + 0.01 }))).toBe(false);
  });
});

describe("evaluateGovernanceWorkflow", () => {
  it("returns publish_ready and auto-publish for a safe Threads ALLOW", async () => {
    const result = await evaluateGovernanceWorkflow(candidate({ agendaId: null }), {
      now: NOW,
      lookups: lookups({ loadAgendaStats: async () => emptyAgendaStats() }),
    });
    expect(result.governance.decision).toBe("ALLOW");
    expect(result.action).toBe("PROCEED");
    expect(result.workflowState).toBe("publish_ready");
    expect(result.autoPublishAllowed).toBe(true);
    expect(result.humanApprovalRequired).toBe(false);
    expect(result.approvalRequest).toBeNull();
    expect(result.revisionRequest).toBeNull();
  });

  it("keeps Instagram ALLOW publish_ready with autoPublish false", async () => {
    const result = await evaluateGovernanceWorkflow(candidate({ channel: "instagram", agendaId: null }), {
      now: NOW,
      lookups: lookups({
        loadAgendaStats: async () => emptyAgendaStats(),
        loadChannelStats: async () => channelStats({ channel: "instagram", dailyMax: 1 }),
      }),
    });
    expect(result.governance.decision).toBe("ALLOW");
    expect(result.workflowState).toBe("publish_ready");
    expect(result.autoPublishAllowed).toBe(false);
  });

  it("maps exact duplicate to revision_required with hints", async () => {
    const result = await evaluateGovernanceWorkflow(candidate(), {
      now: NOW,
      lookups: lookups({ findByContentHash: async () => CONTENT_ID }),
    });
    expect(result.governance.decision).toBe("BLOCK");
    expect(result.workflowState).toBe("revision_required");
    expect(result.action).toBe("REQUEST_REVISION");
    expect(result.revisionRequest?.reasonCodes).toContain("EXACT_DUPLICATE");
    expect(result.revisionRequest?.revisionHints).toContain("기존 문구와 동일하므로 새로운 각도로 재작성 필요");
  });

  it("sends semantic unavailable ALLOW to approval_pending", async () => {
    const result = await evaluateGovernanceWorkflow(candidate({ agendaId: null }), {
      now: NOW,
      lookups: lookups({
        retrieveSimilar: async () => ({ status: "skipped", reason: "provider_not_configured", matches: [] }),
        loadAgendaStats: async () => emptyAgendaStats(),
      }),
    });
    expect(result.governance.decision).toBe("ALLOW");
    expect(result.governance.semanticAvailable).toBe(false);
    expect(result.workflowState).toBe("approval_pending");
    expect(result.humanApprovalRequired).toBe(true);
    expect(result.autoPublishAllowed).toBe(false);
    expect(result.approvalRequest?.governanceDecision).toBe("ALLOW");
    expect(result.approvalRequest?.candidate.body).toBe(candidate().body);
  });
});

describe("applyApprovalDecision", () => {
  const pending = applyGovernancePolicy(
    governanceResult({
      decision: "REVIEW",
      riskScore: 0.55,
      reasons: [{ code: "SEMANTIC_SIMILARITY_REVIEW", severity: "medium" }],
    }),
    { now: NOW },
  );

  it("approves to approved without writing to the database", () => {
    const applied = applyApprovalDecision({
      workflow: pending,
      decision: "APPROVE",
      reviewerType: "human",
      now: NOW,
    });
    expect(applied.workflowState).toBe("approved");
    expect(applied.action).toBe("PROCEED");
    expect(applied.record.decision).toBe("APPROVE");
    expect(applied.autoPublishAllowed).toBe(false);
  });

  it("rejects to rejected", () => {
    const applied = applyApprovalDecision({ workflow: pending, decision: "REJECT", now: NOW });
    expect(applied.workflowState).toBe("rejected");
    expect(applied.record.decision).toBe("REJECT");
  });

  it("requests changes as revision_required", () => {
    const applied = applyApprovalDecision({
      workflow: pending,
      decision: "REQUEST_CHANGES",
      comment: "hook 변경",
      now: NOW,
    });
    expect(applied.workflowState).toBe("revision_required");
    expect(applied.revisionRequired).toBe(true);
    expect(applied.record.comment).toBe("hook 변경");
  });

  it("does not apply approval outside approval_pending", () => {
    expect(() =>
      applyApprovalDecision({
        workflow: applyGovernancePolicy(governanceResult(), { now: NOW }),
        decision: "APPROVE",
      }),
    ).toThrow(GovernanceValidationError);
  });
});

describe("revision hints", () => {
  it("maps high-risk reason codes to rule-based Korean hints", () => {
    const reasons: GovernanceReason[] = [
      { code: "AGENDA_OVERUSED", severity: "high" },
      { code: "SEMANTIC_SIMILARITY_HIGH", severity: "high" },
    ];
    expect(revisionHintsForReasons(reasons)).toEqual([
      "최근 동일 agenda 사용 빈도가 높아 다른 agenda 선택 필요",
      "과거 콘텐츠와 의미 유사도가 높아 hook/angle 변경 필요",
    ]);
  });
});
