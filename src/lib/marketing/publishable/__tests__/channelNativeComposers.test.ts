import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import { ensurePublishableContentSync } from "@/lib/marketing/publishable/ensurePublishableContentSync";
import { composeNaverBlogPublishableContent } from "@/lib/marketing/publishable/naver_blog/composeNaverBlogPublishableContent";
import { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
import { composeKakaoChannelPublishableContent } from "@/lib/marketing/publishable/kakao_channel/composeKakaoChannelPublishableContent";
import { buildPublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  assertChannelNativeStructure,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import { PUBLISHABLE_CONTENT_BUNDLE_CONTRACT } from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { resolveTargetPublishableChannels } from "@/lib/marketing/publishable/selectTargetChannels";

function busanAcrb(): AudienceContentResearchBrief {
  return {
    contract: "audience-content-research-brief-v1",
    version: 1,
    id: "acrb_busan_cg4b",
    logicalIdentity: "li_busan_cg4b",
    generatedAt: "2026-09-13T00:00:00.000Z",
    selectedAgendaId: "agenda_1",
    assignmentId: "asg_test",
    researchStatus: "complete",
    researchVerdict: "PROCEED_WITH_CAUTION",
    verdictReasons: ["useful_audience_tension", "angles_available"],
    limitations: [
      "공식 터미널·시간·수하물 규정은 단정 불가",
      "증거 대부분이 비공식 소셜",
    ],
    audience: {
      primary: [
        {
          text: "부산·경남 거주 다세대 가족",
          type: "observed_signal",
          confidence: 0.55,
          evidenceRefs: [],
        },
        {
          text: "첫 크루즈 초보",
          type: "observed_signal",
          confidence: 0.55,
          evidenceRefs: [],
        },
      ],
      secondary: [],
      motivations: [
        {
          text: "공항 이동 부담을 줄이고 부산항 출발로 진입 장벽을 낮추고 싶음",
          type: "inference",
          confidence: 0.55,
          evidenceRefs: [],
        },
      ],
      anxieties: [
        {
          text: "탑승 직전 동선·수속·짐 처리가 막막함",
          type: "inference",
          confidence: 0.6,
          evidenceRefs: [],
        },
      ],
      objections: [
        {
          text: "공개 소셜만으로는 공식 절차를 신뢰하기 어렵다",
          type: "inference",
          confidence: 0.5,
          evidenceRefs: [],
        },
      ],
      decisionTriggers: [
        {
          text: "가족 일정과 탑승 준비 체크가 맞물릴 때",
          type: "hypothesis",
          confidence: 0.45,
          evidenceRefs: [],
        },
      ],
    },
    searchIntent: {
      primaryIntent: "informational",
      secondaryIntents: ["planning"],
      queries: [
        {
          text: "부산 출발 크루즈 탑승 준비",
          type: "observed_signal",
          confidence: 0.5,
          evidenceRefs: [],
        },
      ],
      questions: [
        {
          text: "부산항 탑승 동선은?",
          type: "observed_signal",
          confidence: 0.55,
          evidenceRefs: [],
        },
        {
          text: "아이와 함께 타도 될까?",
          type: "observed_signal",
          confidence: 0.5,
          evidenceRefs: [],
        },
        {
          text: "첫 크루즈 수하물·보안검색은 공항과 어떻게 다른가요",
          type: "observed_signal",
          confidence: 0.5,
          evidenceRefs: [],
        },
      ],
    },
    marketSignals: {
      observedPatterns: [],
      competitorHooks: [],
      saturatedAngles: [],
      contentGaps: [
        {
          text: "탑승 직전 불안을 다루는 체크리스트형 각도가 비어 있음(공식 절차 단정 금지)",
          type: "inference",
          confidence: 0.55,
          evidenceRefs: [],
        },
      ],
    },
    researchFindings: [
      {
        findingId: "f_obs",
        text: "공개 콘텐츠에서 부산 출발 크루즈 탑승 동선 소개가 관측됨",
        type: "observed_signal",
        confidence: 0.5,
        evidenceRefs: [],
        sourceClass: "public_social_content",
        provenanceNote: null,
      },
    ],
    contentAngles: [
      {
        angleId: "ang_boarding",
        angle: "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
        hook: "동선·수속·짐",
        audienceTension: "동선·수속·짐에 대한 막연한 불안 vs 공식 세부 정보 부재",
        interestScore: 0.8,
        noveltyScore: 0.7,
        evidenceStrength: 0.45,
        channelFit: {
          threads: 0.8,
          shortform: 0.75,
          naver_blog: 0.82,
          naver_band: 0.7,
          kakao_channel: 0.55,
          cardnews: 0.5,
        },
        rationale: "관측 신호를 관객 긴장으로 재구성",
        supportingFindingRefs: ["f_obs"],
        limitations: ["공식 세부 단정 불가"],
      },
    ],
    recommendedAngleId: "ang_boarding",
    recommendedAngleReason: "boarding tension",
    sourceCoverage: {
      assignmentEvidence: true,
      metaEditorial: true,
      internalResearchSignals: false,
      semanticRetrieval: false,
      historicalContent: false,
      externalWebSearch: true,
      notes: [],
    },
    provenance: {
      synthesisMode: "deterministic_fallback",
      evidenceFingerprint: "fp",
      preselectionResearchBriefId: null,
      agendaCandidateId: null,
      externalResearchUsed: true,
      searchProvider: "reused",
      externalResultCount: 2,
      fetchedDocumentCount: 1,
      totalFetchedBytes: 100,
      externalResearchRuntimeMs: 0,
      officialSourceCount: 0,
      socialCommunitySourceCount: 1,
    },
  } as unknown as AudienceContentResearchBrief;
}

function makeCandidate(
  overrides?: Partial<CompletedMarketingCandidate>,
): CompletedMarketingCandidate {
  return {
    contract: "completed-marketing-candidate-v1",
    candidateId: "cmc_cg4b_test_candidate",
    runId: "run_test",
    logicalRunKey: "daily_marketing_production_2026_09_13_cg4b",
    businessDateKst: "2026-09-13",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    selectedAgenda: {
      id: "agenda_1",
      title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
      summary: "부산항 출발 크루즈 탑승 동선 참고",
      destinations: ["부산"],
      entities: ["MSC 벨리시마"],
      contentObjective: "inform_travelers",
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
          sourceName: null,
          isOfficial: false,
          evidenceType: "derived_signal",
          url: null,
          reference: null,
          excerpt: null,
          publishedAt: null,
          observedAt: "2026-09-09T15:10:00.000Z",
          credibilityHint: 0.35,
        },
      ],
      formatHints: [{ format: "threads_text", score: 0.8, rationale: "default" }],
      destinations: ["부산"],
      matchedProductIds: [],
      riskNotes: [],
      constraints: [],
      requiredOutputs: ["content_plan", "text_draft"],
      deadline: null,
      provenance: { createdFrom: "test" },
    },
    contentPlan: {
      contract: "content-plan-v1",
      assignmentId: "asg_test",
      recommendedFormats: [
        { format: "threads_text", score: 0.8, rationale: "default" },
        { format: "short_video_concept", score: 0.7, rationale: "shortform" },
        { format: "blog_article", score: 0.75, rationale: "search" },
      ],
      targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"],
      primaryAngle: "첫 크루즈, 배 안보다 탑승 직전이 더 헷갈린다",
      keyMessage: "탑승 직전 불안을 정리",
      targetAudience: "부산·경남 첫 크루즈 가족",
      hook: "배 안보다 탑승 직전",
      outline: ["context"],
      factsToUse: ["부산항에서 출발하는 크루즈 탑승 동선 정보가 공개 콘텐츠에 소개되고 있습니다."],
      factsToAvoid: [],
      ctaStrategy: "informational",
      productLinkageStrategy: "none",
      evidenceRefs: [],
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    },
    draft: {
      title: "부산 크루즈",
      body: "draft",
      channel: "threads",
      agenda: null,
      sourceReferences: [],
      contentPlan: null,
      assignmentId: "asg_test",
    },
    governanceDecision: {
      decision: "ALLOW",
      riskScore: 0.2,
      reasons: [],
      revisionHints: [],
      requiredRevisions: [],
      humanApprovalRequired: false,
      semanticAvailable: true,
      unsupportedClaims: [],
      verifiedEvidenceRefs: [],
    },
    status: "READY_FOR_HUMAN_REVIEW",
    revisionHistory: [],
    provenance: {
      routineId: "r",
      correlationId: "c",
      researchStatus: "complete",
      governanceReviewId: null,
    },
    observability: {
      stages: {},
      timingsMs: {},
      modelCalls: 0,
    },
    ...overrides,
  } as CompletedMarketingCandidate;
}

describe("CG-4B channel-native composers", () => {
  it("defaults to the full configured publishable channel set when targetChannels unset", () => {
    const channels = resolveTargetPublishableChannels({
      contentPlanTargetChannels: null,
    });
    expect(channels).toEqual([
      "threads",
      "shortform",
      "naver_blog",
      "naver_band",
      "kakao_channel",
      "instagram",
    ]);
  });

  it("does not silently collapse baseline-only contentPlan to threads+shortform", () => {
    const channels = resolveTargetPublishableChannels({
      contentPlanTargetChannels: ["threads", "shortform"],
    });
    expect(channels).toEqual([
      "threads",
      "shortform",
      "naver_blog",
      "naver_band",
      "kakao_channel",
      "instagram",
    ]);
  });

  it("multi-channel bundle parse remains threads/shortform compatible", () => {
    const acrb = busanAcrb();
    const candidate = makeCandidate();
    const bundle = ensurePublishableContentSync({
      candidate,
      audienceContentResearchBrief: acrb,
      forceRegenerate: true,
    });
    expect(bundle.contract).toBe(PUBLISHABLE_CONTENT_BUNDLE_CONTRACT);
    expect(bundle.threads.body.length).toBeGreaterThan(20);
    expect(bundle.shortform.body.length).toBeGreaterThan(10);
    expect(bundle.naver_blog?.body).toBeTruthy();
    expect(bundle.naver_band?.body).toBeTruthy();
    expect(bundle.kakao_channel?.body).toBeTruthy();
  });

  it("does not generate optional channels when explicitly narrowed to baseline", () => {
    const candidate = makeCandidate({
      contentPlan: {
        ...makeCandidate().contentPlan!,
        targetChannels: ["threads", "shortform"],
      },
    });
    const bundle = ensurePublishableContentSync({
      candidate,
      audienceContentResearchBrief: busanAcrb(),
      forceRegenerate: true,
      explicitTargetChannels: ["threads", "shortform"],
    });
    expect(bundle.naver_blog).toBeUndefined();
    expect(bundle.naver_band).toBeUndefined();
    expect(bundle.kakao_channel).toBeUndefined();
  });

  it("blog consumes ACRB searchIntent/questions/gaps and guards facts", async () => {
    const acrb = busanAcrb();
    const composerInput = buildPublishableComposerInput(makeCandidate(), { acrb });
    const blog = await composeNaverBlogPublishableContent({ composerInput });
    expect(blog.title).toBeTruthy();
    expect(blog.blogMeta?.titleCandidates.length).toBeGreaterThanOrEqual(3);
    expect(blog.blogMeta?.searchIntent).toBe("informational");
    expect(blog.body).toMatch(/##\s+/);
    expect(blog.body).toMatch(/부산항 탑승 동선|아이와 함께|수하물/);
    expect(blog.body).toMatch(/체크리스트|공백|공식/);
    expect(blog.body).not.toMatch(/반드시 오후 1시까지/);
    expect(blog.body).not.toMatch(/f4e6f641/);
    expect(validatePublishableText(blog.body, {
      channel: "naver_blog",
      title: blog.title,
      primaryTopic: blog.blogMeta?.primaryTopic,
      allowHeadings: true,
    }).ok).toBe(true);
  });

  it("band is community-native and not copied from blog", async () => {
    const acrb = busanAcrb();
    const composerInput = buildPublishableComposerInput(makeCandidate(), { acrb });
    const blog = await composeNaverBlogPublishableContent({ composerInput });
    const band = await composeNaverBandPublishableContent({ composerInput });
    expect(band.body).not.toBe(blog.body);
    expect(band.body).not.toMatch(/^#\s/m);
    expect(band.body).toMatch(/[?？]|궁금|경험|의견/);
    expect(band.body.length).toBeLessThan(blog.body.length);
  });

  it("kakao is concise, uses commercialIntent, blocks fake urgency/price", async () => {
    const acrb = busanAcrb();
    const composerInput = buildPublishableComposerInput(makeCandidate(), { acrb });
    const kakao = await composeKakaoChannelPublishableContent({ composerInput });
    expect(kakao.body.length).toBeLessThan(900);
    expect(kakao.body).not.toMatch(/놓치지 마세요|지금 바로|마감 임박/);
    expect(kakao.body).not.toMatch(/\d{1,3}(?:,\d{3})+\s*원/);
    expect(kakao.body).toMatch(/공식|확인|체크/);

    const commercial = await composeKakaoChannelPublishableContent({
      composerInput: {
        ...composerInput,
        commercialIntent: "commercial",
      },
    });
    expect(commercial.body).toMatch(/상담/);
  });

  it("structural differentiation across channels", async () => {
    const acrb = busanAcrb();
    const composerInput = buildPublishableComposerInput(makeCandidate(), { acrb });
    const blog = await composeNaverBlogPublishableContent({ composerInput });
    const band = await composeNaverBandPublishableContent({ composerInput });
    const kakao = await composeKakaoChannelPublishableContent({ composerInput });
    const diff = assertChannelNativeStructure({
      blogBody: blog.body,
      bandBody: band.body,
      kakaoBody: kakao.body,
    });
    expect(diff.ok).toBe(true);
  });

  it("channel-scoped regenerate does not overwrite other human-edited channels", () => {
    const dir = mkdtempSync(join(tmpdir(), "cg4b-scope-"));
    try {
      const acrb = busanAcrb();
      const candidate = makeCandidate();
      const first = ensurePublishableContentSync({
        candidate,
        audienceContentResearchBrief: acrb,
        forceRegenerate: true,
      });
      const humanBand = {
        ...first.naver_band!,
        body: "사람이 고친 밴드 글입니다. 경험 있으신가요?",
        status: "human_edited" as const,
      };
      const mutated = { ...first, naver_band: humanBand };
      mkdirSync(join(dir, "context"), { recursive: true });
      writeFileSync(join(dir, PUBLISHABLE_CONTENT_RELATIVE_PATH), JSON.stringify(mutated), "utf8");

      const second = ensurePublishableContentSync({
        candidate,
        packageRoot: dir,
        audienceContentResearchBrief: acrb,
        forceRegenerateChannels: ["naver_blog"],
      });
      expect(second.naver_band?.body).toContain("사람이 고친 밴드");
      expect(second.naver_band?.status).toBe("human_edited");
      expect(second.naver_blog?.body).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("package export writes selected channel artifacts only and is idempotent", () => {
    const dir = mkdtempSync(join(tmpdir(), "cg4b-pkg-"));
    try {
      const acrb = busanAcrb();
      const candidate = makeCandidate();
      const bundle = ensurePublishableContentSync({
        candidate,
        audienceContentResearchBrief: acrb,
        forceRegenerate: true,
        allowDeterministicGeneration: true,
      });
      const first = exportMarketingCandidatePackage({
        candidate,
        assetRoot: dir,
        audienceContentResearchBrief: acrb,
        publishableBundle: bundle,
      });
      const packageDir = first.packageRoot;
      const paths = first.manifest.artifacts.map((a) => a.relativePath);
      expect(paths).toContain("copy/post.txt");
      expect(paths).toContain("copy/naver-blog.md");
      expect(paths).toContain("copy/naver-band.txt");
      expect(paths).toContain("copy/kakao-channel.txt");
      const blog = readFileSync(join(packageDir, "copy/naver-blog.md"), "utf8");
      expect(blog).toMatch(/^#\s+|DEGRADED/m);
      expect(blog).not.toMatch(/f4e6f641|\[object Object\]|ACRB/);

      const second = exportMarketingCandidatePackage({
        candidate,
        assetRoot: dir,
        audienceContentResearchBrief: acrb,
        publishableBundle: bundle,
      });
      expect(second.manifest.integrity.digest).toBe(first.manifest.integrity.digest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("unselected channels create no empty artifacts", () => {
    const dir = mkdtempSync(join(tmpdir(), "cg4b-noselect-"));
    try {
      const candidate = makeCandidate({
        contentPlan: {
          ...makeCandidate().contentPlan!,
          targetChannels: ["threads", "shortform"],
        },
      });
      const result = exportMarketingCandidatePackage({
        candidate,
        assetRoot: dir,
        audienceContentResearchBrief: busanAcrb(),
        forcePublishableRegenerate: true,
      });
      const paths = result.manifest.artifacts.map((a) => a.relativePath);
      expect(paths).toContain("copy/post.txt");
      expect(paths).not.toContain("copy/naver-blog.md");
      expect(paths).not.toContain("copy/naver-band.txt");
      expect(paths).not.toContain("copy/kakao-channel.txt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
