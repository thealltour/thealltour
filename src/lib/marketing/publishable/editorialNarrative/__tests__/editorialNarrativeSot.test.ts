/**
 * Common Editorial Narrative SoT + context authority cleanup.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
} from "@/lib/marketing/canonicalAsset/contracts";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { applyPublishableContentToMediaBrief } from "@/lib/marketing/publishable/applyToMediaBrief";
import {
  CHANNEL_INPUT_AUTHORITY_VERSION,
  buildChannelComposerInputJson,
} from "@/lib/marketing/publishable/composerRuntime";
import {
  ensureEditorialNarrativePlan,
} from "@/lib/marketing/publishable/editorialNarrative/ensureEditorialNarrativePlan";
import { dedupeEvidenceRefsForPrompt } from "@/lib/marketing/publishable/editorialNarrative/evidencePromptDedup";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildCanonicalFingerprintForNarrative } from "@/lib/marketing/publishable/editorialNarrative/canonicalFingerprint";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_BUNDLE_CONTRACT } from "@/lib/marketing/publishable/contracts";
import {
  buildEditorialNarrativeSourceFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";

function approvedAsset(overrides?: Partial<CanonicalMarketingAsset>): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_narrative_sot",
    version: 1,
    status: "approved",
    agendaId: "ag_1",
    storyPointId: "sp_1",
    storyPointHash: "hash_sp_1",
    evidenceBriefRef: null,
    evidenceRevision: "ev_1",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_1",
    sourceRevision: "src_narrative_1",
    titleKo: "북부 국경 Dao족 마을, 익숙한 베트남을 다시 본다",
    dekKo: null,
    openingHookKo: "해변·리조트로 익숙한 베트남 프레임 밖에서 건축을 읽는다.",
    bodyKo: "랑선 등 북부 국경 지대 Dao족 마을의 판축 가옥은 다른 리듬을 보여준다.",
    keyTakeawaysKo: ["익숙한 휴양 프레임 밖에서 읽기", "흙다짐 주택의 생활 리듬"],
    decisionGuidanceKo: "휴양 기대와 산악 국경 경험을 구분해서 본다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [
      { evidenceId: "ev_a", noteKo: "공식 안내" },
      { evidenceId: "ev_b", noteKo: "현장 관측" },
    ],
    limitationsKo: ["개별 일정 변동 가능"],
    forbiddenClaimsKo: ["최저가 보장"],
    supportedClaimBoundaryKo: "건축·생활 리듬 관찰 범위",
    unresolvedQuestionsKo: [],
    storySupportVerdict: "SUPPORTED",
    generatedAt: "2026-09-18T00:00:00.000Z",
    editedAt: null,
    approvedAt: "2026-09-18T01:00:00.000Z",
    approvedVersion: 1,
    humanEdited: false,
    approvalSource: "ai_original",
    approvedBy: "test",
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
    editorialArchetype: "discovery",
    ...overrides,
  };
}

function proposition(): ContentProposition {
  return {
    contract: CONTENT_PROPOSITION_CONTRACT,
    primaryAudience: "베트남 여행 관심 독자",
    audienceProblem: "익숙한 휴양 프레임만 본다",
    audienceTension: "익숙함 vs 국경 산악 경험",
    whyNow: "익숙한 프레임 밖으로 시점을 옮길 때",
    contentPromise: "휴양 프레임 밖 건축·생활 리듬을 보여준다",
    readerGain: "다른 베트남 읽기 축",
    specificTakeaways: ["판축 가옥", "국경 산악 맥락"],
    proofRequirements: [],
    contentGapUsed: "휴양 프레임 밖 국경 산악 경험",
    engagementMechanism: "save_worthy_checklist",
    desiredAudienceAction: "save",
    angle: "Dao족 마을 재구성",
    keyMessage: "익숙한 베트남을 다시 본다",
    commercialIntent: "informational",
    propositionStrength: "usable",
    limitations: [],
    channelIntentHints: null,
    storyPointRef: { storyPointId: "sp_1", storyPointHash: "hash_sp_1" },
    storyPointHash: "hash_sp_1",
    storySupportVerdict: "SUPPORTED",
    supportedClaimBoundaryUsed: "건축·생활 리듬 관찰 범위",
    propositionSourceRevision: "prop_1",
  };
}

function candidate(asset: CanonicalMarketingAsset): CompletedMarketingCandidate {
  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: "cmc_narrative_sot",
    runId: "run_test",
    logicalRunKey: "daily_marketing_production_test",
    businessDateKst: "2026-09-18",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    selectedAgenda: {
      id: "agenda_1",
      title: asset.titleKo,
      summary: asset.dekKo ?? asset.titleKo,
      destinations: [],
      entities: [],
      contentObjective: "inform",
      commercialIntent: "informational",
      rationale: [],
      timelinessNote: null,
      evidenceRefs: [],
      provenance: { researchScoreAtSelection: 0.5 },
    },
    contentAssignment: {
      contract: "content-assignment-v1",
      assignmentId: "asg_1",
      selectedAgendaId: "agenda_1",
      objective: "inform",
      topic: asset.titleKo,
      audience: "여행 독자",
      commercialIntent: "informational",
      facts: [],
      evidenceRefs: [],
      formatHints: [],
      matchedProductIds: [],
      riskNotes: [],
    },
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: "asg_1",
      recommendedFormats: [],
      primaryAngle: "Dao reframe",
      keyMessage: asset.titleKo,
      targetAudience: "여행 독자",
      hook: asset.openingHookKo,
      outline: ["hook", "body"],
      ctaStrategy: "soft",
      targetChannels: ["threads", "instagram"],
      factsToAvoid: [],
      evidenceRefs: [],
      proposition: proposition(),
    },
    draft: { title: asset.titleKo, body: asset.bodyKo },
    governanceDecision: { decision: "ALLOW", unsupportedClaims: [], verifiedEvidenceRefs: [] },
    status: "ready_for_human_review",
    revisionHistory: [{ revisionNumber: 0, governanceDecision: "ALLOW" }],
    canonicalMarketingAsset: asset,
    provenance: {
      routineId: "test_routine",
      correlationId: "corr_narrative_sot",
      researchStatus: null,
      governanceReviewId: "gov_test",
    },
    observability: {
      runId: "run_test",
      logicalRunKey: "daily_marketing_production_test",
      businessDateKst: "2026-09-18",
      correlationId: "corr_narrative_sot",
      researchStatus: null,
      candidateCount: 1,
      selectedAgendaId: "agenda_1",
      assignmentId: "asg_1",
      governanceReviewId: "gov_test",
      revisionCount: 0,
      governanceDecision: "ALLOW",
      finalCandidateId: "cmc_narrative_sot",
      finalStatus: "ready_for_human_review",
      startedAt: "2026-09-18T00:00:00.000Z",
      completedAt: "2026-09-18T00:00:00.000Z",
      failureReason: null,
    },
  } as unknown as CompletedMarketingCandidate;
}

function narrativeLlmPayload() {
  return {
    narrativePromise: "익숙한 휴양 프레임을 국경 산악 Dao족 건축으로 재구성한다",
    audienceTakeaway: "베트남을 휴양지로만 읽지 않게 된다",
    beats: [
      { beatId: "b1", purpose: "hook", message: "익숙한 해변 프레임" },
      { beatId: "b2", purpose: "reframe", message: "국경 산악으로 시선 이동" },
      { beatId: "b3", purpose: "evidence", message: "판축 가옥 관찰" },
      { beatId: "b4", purpose: "payoff", message: "다른 리듬으로 읽기" },
    ],
  };
}

describe("editorialNarrative SoT", () => {
  it("ensure reuses same plan for same canonical fingerprint (invoke once)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "editorial-narrative-sot-"));
    try {
      const asset = approvedAsset();
      const composerInput = buildPublishableComposerInput(candidate(asset), {
        approvedCanonicalAsset: asset,
        packageRoot: dir,
      });
      const invoke = vi.fn(async () => JSON.stringify(narrativeLlmPayload()));

      const first = await ensureEditorialNarrativePlan({
        composerInput,
        invoke,
        packageRoot: dir,
        now: new Date("2026-09-18T02:00:00.000Z"),
      });
      expect(first.status).toBe("generated");
      expect(first.plan).not.toBeNull();
      expect(invoke).toHaveBeenCalledTimes(1);

      const second = await ensureEditorialNarrativePlan({
        composerInput,
        invoke,
        packageRoot: dir,
        now: new Date("2026-09-18T02:05:00.000Z"),
      });
      expect(second.status).toBe("reused");
      expect(second.plan?.sourceCanonicalFingerprint).toBe(
        first.plan?.sourceCanonicalFingerprint,
      );
      expect(invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("canonical change → stale / regenerate", async () => {
    const dir = mkdtempSync(join(tmpdir(), "editorial-narrative-stale-"));
    try {
      const asset = approvedAsset();
      const composerInput = buildPublishableComposerInput(candidate(asset), {
        approvedCanonicalAsset: asset,
        packageRoot: dir,
      });
      const invoke = vi.fn(async () => JSON.stringify(narrativeLlmPayload()));
      const first = await ensureEditorialNarrativePlan({
        composerInput,
        invoke,
        packageRoot: dir,
      });
      expect(first.status).toBe("generated");

      const changed = approvedAsset({
        bodyKo: asset.bodyKo + " 내용이 바뀌었다.",
        version: 2,
        approvedVersion: 2,
      });
      const changedInput = buildPublishableComposerInput(candidate(changed), {
        approvedCanonicalAsset: changed,
        packageRoot: dir,
      });

      const withoutInvoke = await ensureEditorialNarrativePlan({
        composerInput: changedInput,
        packageRoot: dir,
      });
      expect(withoutInvoke.status).toBe("stale_unavailable");
      expect(withoutInvoke.plan?.sourceCanonicalFingerprint).toBe(
        first.plan?.sourceCanonicalFingerprint,
      );

      const regenerated = await ensureEditorialNarrativePlan({
        composerInput: changedInput,
        invoke,
        packageRoot: dir,
      });
      expect(regenerated.status).toBe("generated");
      expect(regenerated.plan?.sourceCanonicalFingerprint).not.toBe(
        first.plan?.sourceCanonicalFingerprint,
      );
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("buildChannelComposerInputJson includes narrative plan + editorialAuthority", () => {
    const asset = approvedAsset();
    const composer = buildPublishableComposerInput(candidate(asset), {
      approvedCanonicalAsset: asset,
    });
    const sourceFp = buildEditorialNarrativeSourceFingerprint({
      assetId: asset.assetId,
      assetVersion: asset.version,
      canonicalFingerprint: buildCanonicalFingerprintForNarrative(asset),
      editorialArchetype: asset.editorialArchetype,
      storyLockFingerprint: null,
    });
    const withPlan = {
      ...composer,
      editorialNarrativePlan: {
        contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
        assetId: asset.assetId,
        assetVersion: asset.version,
        editorialArchetype: asset.editorialArchetype,
        narrativePromise: "promise",
        audienceTakeaway: "takeaway",
        beats: [{ beatId: "b1", purpose: "hook" as const, message: "hook msg" }],
        sourceCanonicalFingerprint: sourceFp,
        provenance: {
          sourceAssetId: asset.assetId,
          sourceVersion: asset.version,
          modelProfile: "editorial-narrative-planner",
          generatedAt: "2026-09-18T02:00:00.000Z",
        },
      },
    };
    const json = buildChannelComposerInputJson(withPlan);
    expect(json.inputAuthorityVersion).toBe(CHANNEL_INPUT_AUTHORITY_VERSION);
    expect(CHANNEL_INPUT_AUTHORITY_VERSION).toBe("channel-input-authority-v2");
    expect(json.editorialNarrativePlan).toEqual({
      narrativePromise: "promise",
      audienceTakeaway: "takeaway",
      beats: [{ beatId: "b1", purpose: "hook", message: "hook msg" }],
    });
    expect(json.editorialAuthority).toEqual({
      factualBoundary: "approved_canonical",
      narrativeSequence: "editorial_narrative_plan",
      channelStructure: "channel_worker",
      wording: "channel_worker",
    });
  });

  it("evidence dedup: same url+excerpt → one prompt id; original array unchanged", () => {
    const original = [
      {
        evidenceId: "ev_1",
        url: "https://Example.com/path/",
        excerpt: "  Hello World  ",
      },
      {
        evidenceId: "ev_2",
        url: "http://example.com/path",
        excerpt: "hello world",
      },
      {
        evidenceId: "ev_3",
        url: "https://other.com",
        excerpt: "different",
      },
    ];
    const snapshot = structuredClone(original);
    const deduped = dedupeEvidenceRefsForPrompt(original);
    expect(deduped.map((r) => r.evidenceId)).toEqual(["ev_1", "ev_3"]);
    expect(original).toEqual(snapshot);
    expect(original.map((r) => r.evidenceId)).toEqual(["ev_1", "ev_2", "ev_3"]);
  });

  it("applyPublishableContentToMediaBrief syncs targetChannels with bundle", () => {
    const mediaBrief = {
      contract: "media-brief-v1",
      candidateId: "cmc_narrative_sot",
      businessDateKst: "2026-09-18",
      sourceChannel: null,
      targetChannels: ["threads"],
      contentIntent: null,
      audience: null,
      coreMessage: null,
      factualClaims: [],
      evidenceRefs: [],
      cta: null,
      formats: {
        text: { enabled: true, title: "t", body: "old" },
        cardnews: {
          enabled: false,
          aspectRatio: "4:5",
          cards: [],
          brandingIntent: null,
        },
        shortform: {
          enabled: false,
          orientation: "vertical",
          targetDurationRange: null,
          narrationSegments: [],
          cta: null,
          voiceProfileId: null,
        },
      },
      provenance: {
        builtFrom: "completed-marketing-candidate",
        candidateContract: "completed-marketing-candidate-v1",
        assignmentId: "asg_1",
        selectedAgendaId: "agenda_1",
        governanceReviewId: "gov_test",
        evidenceRefIds: [],
      },
    } as any;

    const channelStub = {
      contract: "publishable-channel-content-v1",
      channel: "threads",
      format: "threads_text",
      title: "title",
      body: "bundle body",
      status: "generated",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceCandidateId: "cmc_narrative_sot",
      sourceRevision: "rev",
      provenance: {
        composer: "llm",
        evidenceRefIds: [],
        commercialIntent: "informational",
        generationMode: "llm",
      },
      validation: { ok: true, issues: [] },
      publishableSuccess: true,
      needsRegeneration: false,
    };

    const bundle = {
      contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
      candidateId: "cmc_narrative_sot",
      businessDateKst: "2026-09-18",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceRevision: "rev",
      targetChannels: ["threads", "instagram", "naver_blog"],
      threads: channelStub,
      shortform: {
        ...channelStub,
        channel: "shortform",
        format: "short_video_narration",
        body: "sf",
        narrationSegments: [],
        publishableSuccess: false,
      },
    } as unknown as PublishableContentBundle;

    const next = applyPublishableContentToMediaBrief(mediaBrief, bundle);
    expect(next.targetChannels).toEqual(["threads", "instagram", "naver_blog"]);
    expect(next.formats.text.body).toBe("bundle body");
  });
});
