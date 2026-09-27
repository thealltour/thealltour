/**
 * Threads Copy Specialist — authority, contract, lifecycle, fail-closed.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { buildChannelComposerInputJson } from "@/lib/marketing/publishable/composerRuntime";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import {
  THREADS_COPY_CONTRACT,
  THREADS_COPY_WRITER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/threadsCopy/contracts";
import { THREADS_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/threadsCopy/hermesIdentity";
import { hasForcedThreadsCta, materializeThreadsCopy } from "@/lib/marketing/publishable/threadsCopy/materialize";
import { persistThreadsCopy, readThreadsCopyFromPackage } from "@/lib/marketing/publishable/threadsCopy/persist";
import { runThreadsCopySpecialist } from "@/lib/marketing/publishable/threadsCopy/pipeline";
import { THREADS_BODY_MAX_CHARS } from "@/lib/marketing/publishable/validate";

function approvedAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_threads_copy",
    version: 1,
    status: "approved",
    agendaId: "ag_1",
    storyPointId: "sp_1",
    storyPointHash: "hash_1",
    evidenceBriefRef: null,
    evidenceRevision: "ev_1",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_1",
    sourceRevision: "src_1",
    titleKo: "북부 국경 Dao족 마을, 익숙한 베트남을 다시 본다",
    dekKo: null,
    openingHookKo: "해변·리조트로 익숙한 베트남 프레임 밖에서 건축을 읽는다.",
    bodyKo:
      "랑선 등 북부 국경 지대 Dao족 마을의 판축 가옥(nhà trình tường)은 다른 리듬을 보여준다. 개별 일정은 변동 가능하다.",
    keyTakeawaysKo: ["익숙한 휴양 프레임 밖에서 읽기", "흙다짐 주택의 생활 리듬"],
    decisionGuidanceKo: "휴양 기대와 산악 국경 경험을 구분해서 본다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev_dao", noteKo: "건축 관측" }],
    limitationsKo: ["개별 일정 변동 가능"],
    forbiddenClaimsKo: ["최저가 보장", "현장 체험 확정"],
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
  };
}

function narrative(asset: CanonicalMarketingAsset): EditorialNarrativePlan {
  return {
    contract: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    assetId: asset.assetId,
    assetVersion: asset.version,
    editorialArchetype: "discovery",
    narrativePromise: "휴양 프레임을 북부 국경 Dao족·흙다짐 주택으로 재구성한다",
    audienceTakeaway: "해변 리조트만이 베트남이 아니다",
    beats: [
      { beatId: "beat_01", purpose: "hook", message: "익숙한 해변 이미지를 떠올린다" },
      { beatId: "beat_02", purpose: "reframe", message: "북부 국경은 풍경부터 다르다" },
      {
        beatId: "beat_03",
        purpose: "detail",
        message: "nhà trình tường 판축 가옥",
        evidenceRefs: ["ev_dao"],
      },
      { beatId: "beat_04", purpose: "payoff", message: "다른 결로 읽히는 베트남" },
    ],
    sourceCanonicalFingerprint: "fp_canon_test",
    provenance: {
      sourceAssetId: asset.assetId,
      sourceVersion: asset.version,
      modelProfile: "editorial-narrative-planner",
      generatedAt: "2026-09-18T01:00:00.000Z",
    },
  };
}

function composerInput(
  asset: CanonicalMarketingAsset,
  plan: EditorialNarrativePlan,
): PublishableComposerInput {
  return {
    candidateId: "cmc_threads_copy",
    businessDateKst: "2026-09-18",
    topic: asset.titleKo,
    audience: "여행 독자",
    commercialIntent: "informational",
    hookHint: "저장해두고 비교해보세요", // legacy ContentPlan-style — must NOT override
    keyMessage: asset.titleKo,
    destinations: [],
    entities: [],
    usableFacts: [
      {
        statement: "판축 가옥이 관측된다",
        confidence: "high",
        evidenceRefIds: ["ev_dao"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: ["현장 체험 확정"],
    governanceDecision: "ALLOW",
    sourceRevision: "src_1",
    evidenceRefIds: ["ev_dao"],
    research: null,
    targetChannels: ["threads"],
    approvedCanonicalAsset: asset,
    editorialNarrativePlan: plan,
    compositionMode: "approved_asset_adapter",
    storyLock: {
      role: "STORY_LOCK_READ_ONLY",
      storyPointId: "sp_1",
      storyPointHash: "hash_1",
      storyTitleKo: asset.titleKo,
      storyQuestionKo: null,
      audienceProblemKo: null,
      decisionAtStakeKo: null,
      audienceTensionKo: null,
      readerPayoffKo: null,
      editorialArchetype: "discovery",
    },
  };
}

function goodLlmBody(): string {
  return [
    "해변과 리조트, 대도시로만 베트남을 떠올렸다면 시선을 북부 국경지대로 옮겨 보세요.",
    "",
    "랑선 일대 Dao족과 nhà trình tường(전통 흙다짐 주택) 기록은, 익숙한 휴양·도시 이미지와 다른 건축·생활문화 맥락을 보여줍니다.",
    "",
    "같은 나라 안에도 서로 다른 여행 경험이 있다는 단서입니다.",
  ].join("\n");
}

describe("threadsCopy specialist", () => {
  it("A. composer INPUT_JSON carries Canonical + Narrative; ContentPlan hook is not authority", () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const json = buildChannelComposerInputJson(composerInput(asset, plan));
    expect(json.approvedCanonicalAsset).toBeTruthy();
    expect(json.editorialNarrativePlan).toMatchObject({
      narrativePromise: plan.narrativePromise,
    });
    expect(json.editorialAuthority).toMatchObject({
      factualBoundary: "approved_canonical",
      narrativeSequence: "editorial_narrative_plan",
    });
    // hookHint may appear as adapter field but ContentPlan is not narrative authority
    expect(json.editorialAuthority).not.toHaveProperty("contentPlan");
  });

  it("B. style/contract: body<=500, title null, no forced CTA/hashtag", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    const copy = materializeThreadsCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      narrative: plan,
      llm: {
        body: goodLlmBody(),
        selectedNarrativeBeats: ["beat_01", "beat_03", "beat_04"],
        endingIntent: "observation",
        evidenceRefs: ["ev_dao"],
        mediaPlan: null,
      },
    });
    expect(copy.contract).toBe(THREADS_COPY_CONTRACT);
    expect(copy.body.length).toBeLessThanOrEqual(THREADS_BODY_MAX_CHARS);
    expect(copy.body).not.toMatch(/#/);
    expect(hasForcedThreadsCta(copy.body)).toBe(false);
    expect(() =>
      materializeThreadsCopy({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceNarrativeFingerprint: narrativeFp,
        narrative: plan,
        llm: {
          body: "좋아요. 저장해두고 비교해보세요.",
          selectedNarrativeBeats: ["beat_01"],
          endingIntent: "observation",
        },
      }),
    ).toThrow(/forced engagement\/CTA|forced_cta/i);

    const dir = mkdtempSync(join(tmpdir(), "threads-copy-"));
    try {
      const content = await composeThreadsPublishableContent({
        composerInput: composerInput(asset, plan),
        packageRoot: dir,
        useThreadsCopySpecialist: true,
        allowDeterministicFallback: false,
        invoke: async () =>
          JSON.stringify({
            body: goodLlmBody(),
            selectedNarrativeBeats: ["beat_01", "beat_03", "beat_04"],
            endingIntent: "observation",
            evidenceRefs: ["ev_dao"],
            mediaPlan: null,
          }),
      });
      expect(content.title).toBeNull();
      expect(content.body.length).toBeLessThanOrEqual(THREADS_BODY_MAX_CHARS);
      expect(content.body).not.toMatch(/클릭|링크를 눌러/);
      expect(content.publishableSuccess).toBe(true);
      expect(content.provenance.modelProfile).toBe(THREADS_COPY_WRITER_HERMES_PROFILE);
      expect(readFileSync(join(dir, "context/threads-copy.json"), "utf8")).toContain(
        THREADS_COPY_CONTRACT,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C. lifecycle: same Narrative reuses; Narrative change regenerates", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "threads-copy-life-"));
    const invoke = vi.fn(async () =>
      JSON.stringify({
        body: goodLlmBody(),
        selectedNarrativeBeats: ["beat_01", "beat_03"],
        endingIntent: "thought",
        evidenceRefs: ["ev_dao"],
      }),
    );
    try {
      const first = await runThreadsCopySpecialist({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(first.status).toBe("generated");
      expect(invoke).toHaveBeenCalledTimes(1);

      const second = await runThreadsCopySpecialist({
        composerInput: composerInput(asset, plan),
        invoke,
        packageRoot: dir,
      });
      expect(second.status).toBe("reused");
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(readThreadsCopyFromPackage(dir)?.body).toBe(first.copy?.body);

      const mutated = {
        ...plan,
        narrativePromise: "changed promise",
        audienceTakeaway: "changed takeaway",
      };
      const third = await runThreadsCopySpecialist({
        composerInput: composerInput(asset, mutated),
        invoke: async () =>
          JSON.stringify({
            body: "북부 국경지대로 시선을 옮기면 풍경부터 달라집니다.\n\nDao족과 nhà trình tường 기록이 그 맥락을 보여줍니다.",
            selectedNarrativeBeats: ["beat_02", "beat_03"],
            endingIntent: "observation",
            evidenceRefs: ["ev_dao"],
          }),
        packageRoot: dir,
      });
      expect(third.status).toBe("generated");
      expect(third.copy?.body).not.toBe(first.copy?.body);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("F. mixed-region Canonical examples must not be generalized into invented geographic categories", () => {
    const asset = approvedAsset();
    // Mixed familiar frame: beach + resort + major cities (not "남부" alone).
    asset.openingHookKo =
      "다낭의 해변, 푸꾸옥의 리조트, 호치민과 하노이의 도시 풍경. 한국 여행자에게 익숙한 베트남의 모습입니다.";
    asset.bodyKo =
      "해변 휴양이나 대도시 중심의 여행 풍경과 달리, 북부 국경지대 Dao족과 nhà trình tường 기록이 다른 문화적 맥락을 보여줍니다.";
    asset.supportedClaimBoundaryKo =
      "다낭·푸꾸옥·호치민·하노이로 익숙한 베트남과 북부 국경지대 Dao족 맥락 — 증거 범위 안에서만";

    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Geographic grouping must stay faithful/i);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/남부 프레임/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/휴양 광고가 아니라/);

    const safeBody = [
      "다낭·푸꾸옥의 휴양과 호치민·하노이 도시 풍경으로만 알았다면, 북부 국경지대로 시선을 옮겨 보세요.",
      "",
      "Dao족과 nhà trình tường(전통 흙다짐 주택) 기록은 익숙한 해변·대도시 이미지와 다른 건축·생활문화 맥락을 보여줍니다.",
    ].join("\n");
    expect(safeBody).not.toMatch(/남부\s*프레임|남부만|북부 외/);
    expect(safeBody).not.toMatch(/휴양 광고가 아니라|관광 광고가 아니라/);
    expect(safeBody).toMatch(/다낭|푸꾸옥|호치민|하노이/);
    expect(safeBody).toMatch(/북부 국경/);

    const unsafeGeneralization =
      "남부 프레임 밖의 베트남을 보세요. 휴양 광고가 아니라 진짜 생활양식입니다.";
    expect(unsafeGeneralization).toMatch(/남부\s*프레임/);
    expect(unsafeGeneralization).toMatch(/휴양 광고가 아니라/);
    // Contract: specialist SOUL forbids inventing these categories/readings as facts.
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Do NOT invent a new geographic category/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Do NOT invent interpretive contrasts/);
  });

  it("D. failure is fail-closed — no silent generic fallback", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const content = await composeThreadsPublishableContent({
      composerInput: composerInput(asset, plan),
      packageRoot: mkdtempSync(join(tmpdir(), "threads-copy-fail-")),
      useThreadsCopySpecialist: true,
      allowDeterministicFallback: true,
      invoke: async () => {
        throw new Error("boom");
      },
    });
    expect(content.publishableSuccess).toBe(false);
    expect(content.needsRegeneration).toBe(true);
    expect(content.body).toBe("[generation failed]");
    expect(content.provenance.composer).toBe("llm");
  });

  it("E. assemble keeps mediaPlan contract when provided", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "threads-copy-media-"));
    try {
      const content = await composeThreadsPublishableContent({
        composerInput: composerInput(asset, plan),
        packageRoot: dir,
        useThreadsCopySpecialist: true,
        allowDeterministicFallback: false,
        invoke: async () =>
          JSON.stringify({
            body: goodLlmBody(),
            selectedNarrativeBeats: ["beat_01", "beat_03", "beat_04"],
            endingIntent: "observation",
            evidenceRefs: ["ev_dao"],
            mediaPlan: {
              recommended: true,
              assetFamily: "social_static",
              imageCount: 1,
              visuals: [
                {
                  visualId: "social_visual_01",
                  role: "cover_context",
                  visualIntent: "northern highland context",
                  reusableOnInstagram: true,
                },
              ],
            },
          }),
      });
      expect(content.mediaPlan?.recommended).toBe(true);
      expect(content.mediaPlan?.visuals?.[0]?.visualId).toBe("social_visual_01");
      persistThreadsCopy({
        packageRoot: dir,
        copy: readThreadsCopyFromPackage(dir)!,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("threadsCopy specialist — ending / planner / advisory regressions", () => {
  function materializeOk(body: string, endingIntent: string) {
    const asset = approvedAsset();
    const plan = narrative(asset);
    return materializeThreadsCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(plan),
      narrative: plan,
      llm: {
        body,
        selectedNarrativeBeats: ["beat_01", "beat_03"],
        endingIntent,
        evidenceRefs: ["ev_dao"],
        mediaPlan: null,
      },
    });
  }

  it("A. concrete observation ending is accepted", () => {
    const body = [
      "다낭·푸꾸옥·호치민은 익숙한 베트남 풍경입니다.",
      "",
      "북부 국경지대 기록에는 Dao족과 nhà trình tường이 등장합니다.",
      "",
      "해변·대도시와는 출발점이 다른 지역의 모습입니다.",
    ].join("\n");
    const copy = materializeOk(body, "observation");
    expect(copy.endingIntent).toBe("observation");
    expect(copy.body.length).toBeLessThanOrEqual(THREADS_BODY_MAX_CHARS);
  });

  it("B. no separate ending (endingIntent=none) is accepted", () => {
    const body = [
      "다낭·푸꾸옥의 휴양과 호치민 도심이 익숙하다면,",
      "북부 국경지대 Dao족과 nhà trình tường 기록부터 다른 풍경이 열립니다.",
    ].join("\n");
    const copy = materializeOk(body, "none");
    expect(copy.endingIntent).toBe("none");
  });

  it("C. light question ending is accepted", () => {
    const body = [
      "해변·리조트로만 베트남을 떠올렸다면,",
      "북부 국경지대 Dao족 마을의 흙다짐 주택은 어떻게 다를까요?",
    ].join("\n");
    const copy = materializeOk(body, "soft_question");
    expect(copy.endingIntent).toBe("soft_question");
    expect(hasForcedThreadsCta(copy.body)).toBe(false);
  });

  it("D. SOUL: planner lexical boundary — preserve beat, rewrite phrasing", () => {
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /Editorial Narrative Plan is semantic guidance, not a lexical source/i,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /rewrite planner wording into natural[\s\S]*conversational Korean/i,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /rather than copying abstract planner phrasing/i,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /"rhythm" is an internal writing concept, not suggested surface vocabulary/,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /Prefer direct, everyday Korean over abstract editorial phrasing/,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /Do not replace a concrete fact or contrast with meta-language/,
    );
    expect(THREADS_COPY_WRITER_SOUL).toMatch(
      /never invent an abstract lesson[\s\S]*comparison criterion/i,
    );
    expect(THREADS_COPY_WRITER_SOUL).not.toMatch(
      /Ending: natural observation, soft thought, or light question — never forced CTA/,
    );
  });

  it("E. desiredAudienceAction=compare must not force abstract comparison-criterion close", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    let capturedUser = "";
    await runThreadsCopySpecialist({
      composerInput: {
        ...composerInput(asset, plan),
        corePack: {
          desiredAudienceAction: "compare",
          engagementMechanism: "save_worthy_checklist",
        } as PublishableComposerInput["corePack"],
      },
      invoke: async (parts) => {
        capturedUser = typeof parts === "string" ? parts : parts.user;
        return JSON.stringify({
          body: [
            "다낭·푸꾸옥·호치민은 익숙한 풍경입니다.",
            "",
            "북부 국경지대에는 Dao족과 nhà trình tường 기록이 있습니다.",
          ].join("\n"),
          selectedNarrativeBeats: ["beat_01", "beat_03"],
          endingIntent: "observation",
          evidenceRefs: ["ev_dao"],
        });
      },
    });
    expect(capturedUser).toMatch(/desiredAudienceAction/);
    expect(capturedUser).toMatch(/Advisory only/);
    expect(capturedUser).toMatch(/Do not emit save\/compare\/checklist CTA phrasing/);
    expect(capturedUser).toMatch(
      /Do not turn desiredAudienceAction or engagementMechanism into/,
    );
    expect(capturedUser).toMatch(
      /closing lesson, reader payoff, comparison criterion, or abstract takeaway/,
    );
    // Instruction target: ban criterion/payoff synthesis closings — not factual contrast.
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Never force CTA/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/비교 기준/);
  });

  it("F. natural factual comparison language is still allowed", () => {
    const body = [
      "해변 휴양지와 북부 국경 산악 마을의 풍경을 나란히 보면 차이가 분명합니다.",
      "",
      "Dao족과 nhà trình tường 기록이 그 차이를 보여줍니다.",
    ].join("\n");
    expect(hasForcedThreadsCta(body)).toBe(false);
    const copy = materializeOk(body, "observation");
    expect(copy.body).toMatch(/나란히 보면|차이/);
  });

  it("G. forced CTA regression still fail-closed", () => {
    expect(() =>
      materializeOk("좋아요. 저장해두고 비교해보세요.", "observation"),
    ).toThrow(/forced engagement\/CTA|forced_cta/i);
    expect(hasForcedThreadsCta("댓글로 남겨주세요")).toBe(true);
    expect(hasForcedThreadsCta("링크를 클릭해 보세요")).toBe(true);
  });

  it("H. geographic compression hard rules unchanged", () => {
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Geographic grouping must stay faithful/i);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/남부 프레임/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Do NOT invent a new geographic category/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Do NOT invent interpretive contrasts/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/다낭·푸꾸옥·호치민·하노이/);
  });

  it("I. hard max 500 unchanged; preferred band 180–420", () => {
    expect(THREADS_BODY_MAX_CHARS).toBe(500);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Preferred:\s*180–420/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/Hard maximum:\s*500/);
    const long = "가".repeat(THREADS_BODY_MAX_CHARS + 1);
    expect(() => materializeOk(long, "observation")).toThrow(/exceeds|too_long/i);
  });

  it("semanticRegistry: canonical required + current specialist notes", async () => {
    const { requireMarketingAgentSemanticContract } = await import(
      "@/lib/marketing/agentContracts/semanticRegistry"
    );
    const threads = requireMarketingAgentSemanticContract("threads-copy-writer");
    expect(threads.inputs.required).toEqual(
      expect.arrayContaining([
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    expect(threads.inputs.optional ?? []).not.toContain("canonical.factualBoundary");
    expect(threads.docs?.notes?.join("\n") ?? "").not.toMatch(/Phase 3A metadata only/);
    expect(threads.docs?.notes?.join("\n") ?? "").toMatch(/semantic guidance, not a lexical source/i);
    expect(threads.docs?.notes?.join("\n") ?? "").toMatch(/fail-closed/i);
  });
});
