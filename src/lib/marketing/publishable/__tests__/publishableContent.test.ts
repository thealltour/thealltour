import { describe, expect, it } from "vitest";

import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { composeShortformNarration } from "@/lib/marketing/publishable/shortform/composeShortformNarration";
import {
  looksLikeInternalPlanningBody,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import { applyPublishableContentToMediaBrief } from "@/lib/marketing/publishable/applyToMediaBrief";
import { buildMediaBriefFromCandidate } from "@/lib/marketing/assets/buildMediaBriefFromCandidate";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";

const INTERNAL_BODY = `Context
추석 연휴를 앞두고 크루즈 여행에 대한 관심이 높아지는 가운데, 관련 여행 정보 수요가 증가하고 있습니다.

Key verified facts from assignment evidence
공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측되었습니다 [f4e6f641-d2cd-4704-8d01-2fbc890a516b].

Travel relevance for audience
해외여행을 고려하는 한국 여행객들에게 부산항을 출발하는 크루즈의 실제 탑승 과정이 참고가 됩니다.

Useful takeaway without product
크루즈 여행 준비 시 탑승 동선을 미리 확인하면 일정을 체계적으로 계획할 수 있습니다.

CTA aligned to commercialIntent
확인해보세요!`;

function makeCandidate(overrides?: Partial<CompletedMarketingCandidate>): CompletedMarketingCandidate {
  const base = {
    contract: "completed-marketing-candidate-v1" as const,
    candidateId: "cmc_cg4a_test_candidate",
    runId: "run_test",
    logicalRunKey: "daily_marketing_production_2026_09_12_60",
    businessDateKst: "2026-09-12",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    selectedAgenda: {
      id: "agenda_1",
      title: "부산 출발 크루즈 체크포인트",
      summary: "부산항 출발 크루즈 탑승 동선 참고",
      destinations: ["부산"],
      entities: ["MSC 벨리시마"],
      contentObjective: "inform",
      commercialIntent: "informational",
      rationale: [],
      timelinessNote: null,
      evidenceRefs: [],
      provenance: { researchScoreAtSelection: 0.5 },
    },
    contentAssignment: {
      contract: "content-assignment-v1",
      assignmentId: "asg_test",
      selectedAgendaId: "agenda_1",
      objective: "inform cruise travelers",
      topic: "부산 출발 크루즈",
      audience: "한국 여행객",
      commercialIntent: "informational",
      facts: [
        {
          factId: "f1",
          statement: "부산항에서 출발하는 크루즈 탑승 동선 정보가 공개 콘텐츠에 소개되고 있습니다.",
          evidenceRefs: ["f4e6f641-d2cd-4704-8d01-2fbc890a516b"],
          confidence: "medium",
        },
      ],
      evidenceRefs: [
        {
          evidenceId: "f4e6f641-d2cd-4704-8d01-2fbc890a516b",
          sourceId: "src_test",
          sourceType: "social_observation",
          url: null,
          title: null,
          excerpt: null,
        },
      ],
      formatHints: [{ format: "threads_text", priority: 1, rationale: "default" }],
      matchedProductIds: [],
      riskNotes: [],
    },
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: "asg_test",
      recommendedFormats: [
        { format: "threads_text", priority: 1, rationale: "default" },
        { format: "short_video_concept", priority: 2, rationale: "shortform" },
      ],
      primaryAngle: "cruise boarding tips",
      keyMessage: "부산 출발 크루즈는 탑승 동선을 미리 보면 편합니다",
      targetAudience: "한국 여행객",
      hook: "부산항 크루즈, 출발 전 체크",
      outline: [
        "Context — why this matters now",
        "Key verified facts from assignment evidence",
        "Travel relevance for audience",
        "Useful takeaway without product",
        "CTA aligned to commercialIntent",
      ],
      factsToUse: ["부산항에서 출발하는 크루즈 탑승 동선 정보가 공개 콘텐츠에 소개되고 있습니다."],
      factsToAvoid: [],
      ctaStrategy: "Informational CTA only",
      productLinkageStrategy: "none",
      evidenceRefs: [],
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    },
    draft: {
      title: "부산 크루즈",
      body: INTERNAL_BODY,
      channel: "threads",
      sourceReferences: [],
      contentPlan: null,
    },
    governanceDecision: {
      reviewId: "gov_1",
      decision: "REVIEW",
      riskScore: 0.4,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: true,
      semanticAvailable: false,
      factualRisks: [],
      policyRisks: [],
      commercialRisks: [],
      unsupportedClaims: ["완벽한 가족 프로그램이 보장됩니다"],
      evidenceGaps: [],
      verifiedEvidenceRefs: [],
      decidedAt: "2026-09-12T00:00:00.000Z",
      malformed: false,
    },
    status: "needs_human_review" as const,
    revisionHistory: [],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: "corr",
      researchStatus: "ok",
      governanceReviewId: "gov_1",
    },
    observability: {
      runId: "run_test",
      logicalRunKey: "daily_marketing_production_2026_09_12_60",
      businessDateKst: "2026-09-12",
      correlationId: "corr",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: "agenda_1",
      assignmentId: "asg_test",
      governanceReviewId: "gov_1",
      revisionCount: 0,
      governanceDecision: "REVIEW",
      finalCandidateId: "cmc_cg4a_test_candidate",
      finalStatus: "needs_human_review",
      startedAt: "2026-09-12T00:00:00.000Z",
      completedAt: null,
      failureReason: null,
    },
  };
  return { ...base, ...overrides } as CompletedMarketingCandidate;
}

describe("CG-4A publishable content core", () => {
  it("detects internal outline bodies", () => {
    expect(looksLikeInternalPlanningBody(INTERNAL_BODY)).toBe(true);
    expect(looksLikeInternalPlanningBody("부산항 크루즈 탑승 전에 동선만 확인하세요.")).toBe(false);
  });

  it("composes Threads copy without headings or evidence UUIDs", async () => {
    const candidate = makeCandidate();
    const input = buildPublishableComposerInput(candidate);
    const threads = await composeThreadsPublishableContent({ composerInput: input });
    expect(threads.body).not.toMatch(/Context/i);
    expect(threads.body).not.toMatch(/Key verified facts/i);
    expect(threads.body).not.toMatch(/f4e6f641-d2cd-4704-8d01-2fbc890a516b/);
    expect(threads.body).not.toMatch(/\[object Object\]/i);
    expect(threads.body.trim().length).toBeGreaterThan(40);
    expect(validatePublishableText(threads.body).ok).toBe(true);
  });

  it("composes shortform narration without internal headings", async () => {
    const candidate = makeCandidate();
    const input = buildPublishableComposerInput(candidate);
    const shortform = await composeShortformNarration({ composerInput: input });
    expect(shortform.body).not.toMatch(/Key verified facts/i);
    expect(shortform.body).not.toMatch(/Travel relevance/i);
    expect(shortform.body).not.toMatch(/f4e6f641/);
    expect(shortform.narrationSegments?.length).toBeGreaterThan(1);
    for (const seg of shortform.narrationSegments ?? []) {
      expect(seg.narrationText.toLowerCase()).not.toBe("narration");
      expect(seg.narrationText).not.toMatch(/Context/);
    }
  });

  it("ensurePublishableContentSync is stable for same revision", () => {
    const candidate = makeCandidate();
    const a = ensurePublishableContentSync({ candidate, forceRegenerate: true });
    const b = ensurePublishableContentSync({
      candidate,
      forceRegenerate: false,
      // no package — regenerates but deterministic body
    });
    // Without package reuse, still deterministic body
    expect(a.threads.body).toBe(b.threads.body);
    expect(a.shortform.body).toBe(b.shortform.body);
  });

  it("does not overwrite human-edited Threads body", () => {
    const candidate = makeCandidate();
    const humanBody = "부산항 크루즈는 탑승 동선만 미리 보면 훨씬 편해요.\n\n일정 짜실 때 참고해 보세요.";
    const bundle = ensurePublishableContentSync({
      candidate,
      humanDraft: { title: "부산 크루즈", body: humanBody, channel: "threads" },
      humanEditedAfterGovernance: true,
      forceRegenerate: true,
    });
    expect(bundle.threads.body).toBe(humanBody);
    expect(bundle.threads.status).toBe("human_edited");
  });

  it("applies publishable narration into ShortVideoBrief-compatible MediaBrief", () => {
    const candidate = makeCandidate();
    // Avoid incomplete assignment evidence shapes — build brief from publishable only.
    const emptyish = makeCandidate({
      contentAssignment: {
        ...makeCandidate().contentAssignment,
        facts: [],
        evidenceRefs: [],
      },
    } as Partial<CompletedMarketingCandidate>);
    const bundle = ensurePublishableContentSync({ candidate, forceRegenerate: true });
    const mediaBrief = applyPublishableContentToMediaBrief(
      buildMediaBriefFromCandidate(emptyish),
      bundle,
    );
    expect(mediaBrief.formats.text.body).toBe(bundle.threads.body);
    expect(mediaBrief.formats.shortform.narrationSegments.length).toBeGreaterThan(0);
    mediaBrief.formats.shortform.enabled = true;
    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: ["부산"],
      durationPreset: "short",
    });
    for (const scene of brief.scenes) {
      expect(scene.visual.searchQueries).not.toContain("narration");
      expect(scene.visual.subject.toLowerCase()).not.toBe("narration");
    }
  });
});
