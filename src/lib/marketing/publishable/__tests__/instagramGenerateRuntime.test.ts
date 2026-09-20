/**
 * Instagram generate runtime — regression for missing Hermes profile config
 * misclassified as invalid_json, plus approved-asset compose/persist path.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { generateChannelAsset } from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import { approveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  assertHermesSpawnSyncSuccess,
  isHermesFalseSuccessBody,
} from "@/lib/marketing/cron/hermesSpawnFailure";
import {
  buildChannelComposerPromptParts,
  classifyPublishableLlmFailure,
} from "@/lib/marketing/publishable/composerRuntime";
import {
  ensureChannelEditorHermesOneshotReady,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import { buildChannelWorkspaceAfterCanonicalApprove } from "@/lib/marketing/publishable/channelWorkspace";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import {
  composeInstagramPublishableContent,
  parseInstagramJson,
} from "@/lib/marketing/publishable/instagram/composeInstagramPublishableContent";
import { INSTAGRAM_WRITING_CONTRACT } from "@/lib/marketing/publishable/instagram/writingContract";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "ig-runtime-"));
  tempDirs.push(dir);
  return dir;
}

function durableAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_ig_runtime",
    version: 1,
    status: "draft",
    agendaId: "ag_ig",
    storyPointId: "sp_ig",
    storyPointHash: "hash_ig",
    evidenceBriefRef: "ebr_ig",
    evidenceRevision: "ev_rev",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_rev",
    sourceRevision: "src_ig",
    titleKo: "바냐 건축 디테일",
    dekKo: null,
    openingHookKo: "온천으로만 알면 놓치는 디테일이 있다",
    bodyKo:
      "공개된 후기에서 자주 보이는 건 물보다 천장과 창문 비율이다. 알고 보면 문화 맥락이 더 크다. 같은 장소를 다르게 보게 된다.",
    keyTakeawaysKo: ["건축 디테일", "문화 맥락"],
    decisionGuidanceKo: "온천이 아니라 건축·문화로 보면 다르게 읽힌다",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "관측" }],
    supportedClaimBoundaryKo: "공개 콘텐츠 관측",
    limitationsKo: ["현장 방문 확인 없음"],
    forbiddenClaimsKo: ["특정 마을 확정"],
    unresolvedQuestionsKo: [],
    storySupportVerdict: "SUPPORTED",
    generatedAt: "2026-09-18T00:00:00.000Z",
    editedAt: null,
    approvedAt: null,
    approvedVersion: null,
    humanEdited: false,
    approvalSource: null,
    approvedBy: null,
    generatedBy: ASSET_SOURCE_WRITER_ROLE,
    repairCount: 0,
    validationIssues: [],
  };
}

function candidateStub(asset: CanonicalMarketingAsset): CompletedMarketingCandidate {
  return {
    candidateId: "cmc_ig_runtime",
    businessDateKst: "2026-09-18",
    draft: { body: "draft", title: null },
    contentAssignment: {
      commercialIntent: "informational",
      facts: [{ statement: "공개 후기에서 건축 디테일이 관측된다" }],
    },
    contentPlan: {
      proposition: {
        contract: "content-proposition-v1",
        primaryAudience: "문화 여행자",
        audienceProblem: "온천으로만 알고 있음",
        audienceTension: "익숙한 이미지와 실제가 다를 수 있다",
        whyNow: null,
        contentPromise: "숨은 건축 디테일",
        readerGain: "같은 장소를 다르게 본다",
        specificTakeaways: ["건축 디테일", "문화 맥락"],
        proofRequirements: [],
        contentGapUsed: "",
        engagementMechanism: "experience_sharing_prompt",
        desiredAudienceAction: "comment",
        angle: "discovery",
        keyMessage: "건축 디테일",
        commercialIntent: "informational",
        propositionStrength: "strong",
        limitations: [],
      },
      targetChannels: ["threads", "shortform", "instagram"],
    },
    governanceDecision: { decision: "ALLOW" },
    canonicalMarketingAsset: asset,
  } as unknown as CompletedMarketingCandidate;
}

function seed(packageRoot: string): CanonicalMarketingAsset {
  const approved = approveCanonicalMarketingAsset({
    asset: durableAsset(),
    mode: "ai_original",
    approvedBy: "tester",
  });
  persistCanonicalAssetToPackage({ packageRoot, asset: approved });
  const bundle = buildChannelWorkspaceAfterCanonicalApprove({
    candidateId: "cmc_ig_runtime",
    businessDateKst: "2026-09-18",
    sourceRevision: approved.sourceRevision,
    contentPlanTargetChannels: ["threads", "shortform", "instagram"],
    commercialIntent: "informational",
    approvedAsset: approved,
    priorBundle: null,
    nowIso: "2026-09-18T01:00:00.000Z",
  });
  persistPublishableContentBundle({
    packageRoot,
    bundle,
    createdAt: "2026-09-18T01:00:00.000Z",
  });
  return approved;
}

function validInstagramJson(): string {
  return JSON.stringify({
    hook: "온천으로만 알면 놓치는 디테일이 있다.",
    body: "온천으로만 알면 놓치는 디테일이 있다.\n\n천장과 창문 비율이 먼저 보인다. 건축 디테일과 문화 맥락.\n\n#부다페스트 #바냐 #건축",
    hashtags: ["#부다페스트", "#바냐", "#건축"],
    cta: null,
    altText: "바냐 건축",
    slideHeadlines: ["놓치는 디테일", "익숙한 이미지", "천장과 창문", "다르게 보기"],
    cardPlan: [
      {
        cardId: "c1",
        role: "cover",
        headline: "놓치는 디테일",
        body: "",
        visualIntent: "hook",
        visual: {
          visualId: "social_visual_01",
          visualMode: "editorial_photo",
          generatedVisualNeeded: true,
          reusableOnThreads: true,
          visualIntent: "cover",
        },
      },
      { cardId: "c2", role: "information", headline: "익숙한 이미지", body: "", visualIntent: "o" },
      { cardId: "c3", role: "information", headline: "천장과 창문", body: "", visualIntent: "d" },
      { cardId: "c4", role: "information", headline: "다르게 보기", body: "", visualIntent: "p" },
    ],
  });
}

/** Multi-stage editorial mock: Narrative → Carousel → CardCopy → Caption. */
function editorialStageResponse(prompt: unknown): string {
  const parts = prompt as { hermesProfile?: string; user?: string; text?: string };
  const profile = (parts.hermesProfile ?? "").trim();
  if (profile === "editorial-narrative-planner") {
    return JSON.stringify({
      narrativePromise: "온천으로만 아는 바냐를 건축·문화 디테일로 다시 읽게 한다",
      audienceTakeaway: "같은 장소를 건축 비율로 다르게 본다",
      beats: [
        { beatId: "beat_01", purpose: "hook", message: "온천으로만 알면 놓치는 디테일이 있다" },
        { beatId: "beat_02", purpose: "familiar_frame", message: "익숙한 온천·목욕 이미지" },
        { beatId: "beat_03", purpose: "reframe", message: "천장과 창문 비율이 먼저 보인다" },
        { beatId: "beat_04", purpose: "payoff", message: "건축 디테일과 문화 맥락으로 다시 읽는다" },
      ],
    });
  }
  if (profile === "instagram-carousel-planner") {
    return JSON.stringify({
      cards: [
        {
          cardId: "card-01",
          role: "hook_cover",
          beatIds: ["beat_01"],
          communicationGoal: "놓치는 디테일로 스와이프 유도",
          visualPriority: "hero",
        },
        {
          cardId: "card-02",
          role: "reframe",
          beatIds: ["beat_02"],
          communicationGoal: "익숙한 온천 프레임",
          visualPriority: "useful",
        },
        {
          cardId: "card-03",
          role: "evidence_detail",
          beatIds: ["beat_03"],
          communicationGoal: "천장·창문 비율",
          visualPriority: "strong",
        },
        {
          cardId: "card-04",
          role: "closing",
          beatIds: ["beat_04"],
          communicationGoal: "건축·문화 payoff",
          visualPriority: "optional",
        },
      ],
    });
  }
  if (profile === "instagram-card-copy-writer") {
    return JSON.stringify({
      cards: [
        { cardId: "card-01", headline: "놓치는 디테일", body: "온천으로만 보면 놓칩니다" },
        { cardId: "card-02", headline: "익숙한 이미지", body: "목욕·온천 프레임이 먼저 옵니다" },
        { cardId: "card-03", headline: "천장과 창문", body: "비율이 공간을 말해 줍니다" },
        { cardId: "card-04", headline: "다르게 보기", body: "건축 디테일과 문화 맥락" },
      ],
    });
  }
  if (profile === "instagram-caption-writer") {
    return JSON.stringify({
      opening: "온천으로만 알면 놓치는 디테일이 있다.",
      body: "천장과 창문 비율이 먼저 보인다. 건축 디테일과 문화 맥락으로 같은 장소를 다시 읽는다.",
      cta: "저장해 두세요",
      hashtags: ["부다페스트", "바냐", "건축"],
      altText: "바냐 건축 디테일을 소개하는 카드뉴스",
    });
  }
  return validInstagramJson();
}

function baseComposer(approved: CanonicalMarketingAsset): PublishableComposerInput {
  return {
    candidateId: "cmc_ig_runtime",
    businessDateKst: "2026-09-18",
    topic: approved.titleKo,
    audience: "문화 여행자",
    commercialIntent: "informational",
    hookHint: approved.openingHookKo,
    keyMessage: approved.titleKo,
    destinations: [],
    entities: [],
    usableFacts: [
      {
        statement: "공개 후기에서 건축 디테일이 관측된다",
        confidence: "high",
        evidenceRefIds: ["ev1"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: [],
    governanceDecision: "ALLOW",
    sourceRevision: approved.sourceRevision,
    evidenceRefIds: ["ev1"],
    research: null,
    targetChannels: ["threads", "instagram"],
    contentProposition: candidateStub(approved).contentPlan!.proposition as never,
    approvedCanonicalAsset: approved,
    storyLock: {
      role: "STORY_LOCK_READ_ONLY",
      storyPointId: "sp_ig",
      storyPointHash: "hash_ig",
      storyTitleKo: approved.titleKo,
      storyQuestionKo: "온천으로만 보면 무엇을 놓칠까?",
      audienceProblemKo: "온천으로만 알고 있음",
      decisionAtStakeKo: null,
      audienceTensionKo: "익숙한 이미지와 실제가 다를 수 있다",
      readerPayoffKo: "같은 장소를 다르게 본다",
      editorialArchetype: "discovery",
    },
    compositionMode: "approved_asset_adapter",
  };
}

describe("Instagram generate runtime", () => {
  it("1. generateChannelAsset(instagram) invokes only the Instagram composer", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_ig_runtime");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seed(packageRoot);

    const invoke = vi.fn(async (prompt: unknown) => {
      const parts = prompt as { channel?: string };
      expect(parts.channel ?? "threads").toBe("instagram");
      return editorialStageResponse(prompt);
    });

    const bundle = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "instagram",
      invoke,
      approvedCanonicalAsset: approved,
    });

    // Common Narrative + Carousel + CardCopy + Caption (bounded repair may add calls).
    expect(invoke.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(invoke.mock.calls.length).toBeLessThanOrEqual(8);
    expect(invoke.mock.calls.every((call) => {
      const p = call[0] as { channel?: string };
      return p?.channel === "instagram";
    })).toBe(true);
    expect(bundle.instagram?.publishableSuccess).toBe(true);
    expect(bundle.instagram?.status).toBe("generated");
    expect(bundle.instagram?.status).not.toBe("not_generated");
  });

  it("2. approved Canonical Instagram prompt has non-empty Channel Editor system", () => {
    const approved = approveCanonicalMarketingAsset({
      asset: durableAsset(),
      mode: "ai_original",
      approvedBy: "tester",
    });
    const parts = buildChannelComposerPromptParts({
      channel: "instagram",
      writingContract: INSTAGRAM_WRITING_CONTRACT,
      composerInput: baseComposer(approved),
    });
    expect(parts.system.trim().length).toBeGreaterThan(40);
    expect(parts.system).toMatch(/Channel Adapter|Channel Editor/i);
    expect(parts.user).toContain("approvedCanonicalAsset");
    expect(parts.user).toContain('"editorialArchetype":"discovery"');
  });

  it("3. valid Instagram LLM response with cardPlan parses", () => {
    const parsed = parseInstagramJson(validInstagramJson());
    expect(parsed?.body).toBeTruthy();
    expect(parsed?.meta.cardPlan?.length).toBe(4);
    expect(parsed?.meta.cardPlan?.[0]?.visual?.visualId).toBe("social_visual_01");
    expect(parsed?.meta.slideHeadlines).toHaveLength(4);
  });

  it("4. generated Instagram persists into publishable-content.json", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_ig_runtime");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seed(packageRoot);

    await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "instagram",
      invoke: async (prompt) => editorialStageResponse(prompt),
      approvedCanonicalAsset: approved,
    });

    const disk = JSON.parse(
      readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
    ) as {
      instagram?: {
        status: string;
        body: string;
        publishableSuccess?: boolean;
        instagramMeta?: { cardPlan?: unknown[]; slideHeadlines?: string[] };
        sourceAssetVersion?: number | null;
        provenance?: { composer?: string; compositionMode?: string };
      };
    };
    expect(disk.instagram?.status).toBe("generated");
    expect(disk.instagram?.body.length).toBeGreaterThan(20);
    expect(disk.instagram?.publishableSuccess).toBe(true);
    expect(disk.instagram?.instagramMeta?.slideHeadlines?.length).toBeGreaterThanOrEqual(4);
    expect(disk.instagram?.instagramMeta?.cardPlan).toBeTruthy();
    expect(disk.instagram?.provenance?.composer).toBe("llm");
    expect(disk.instagram?.sourceAssetVersion).toBe(approved.approvedVersion);
    expect(
      readFileSync(join(packageRoot, "context", "editorial-narrative-plan.json"), "utf8"),
    ).toContain("editorial-narrative-plan-v1");
  });

  it("5. Instagram failure leaves other channels unchanged", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_ig_runtime");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seed(packageRoot);

    await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "threads",
      invoke: async () =>
        JSON.stringify({
          title: null,
          body: "성공한 스레드 본문입니다. 건축 디테일과 문화 맥락을 함께 보세요. 온천으로만 알면 놓칩니다.",
        }),
      approvedCanonicalAsset: approved,
    });
    const before = JSON.parse(
      readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
    ) as { threads: { body: string } };
    const threadsBefore = before.threads.body;

    const failed = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "instagram",
      invoke: async () => {
        throw new Error("instagram_boom");
      },
      approvedCanonicalAsset: approved,
    });
    expect(failed.threads.body).toBe(threadsBefore);
    expect(failed.instagram?.publishableSuccess).not.toBe(true);
  });

  it("6. UI/state contract: not_generated → generated or failed (not silent)", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_ig_runtime");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seed(packageRoot);
    const before = JSON.parse(
      readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
    ) as { instagram?: { status: string } };
    expect(before.instagram?.status).toBe("not_generated");

    const ok = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "instagram",
      invoke: async (prompt) => editorialStageResponse(prompt),
      approvedCanonicalAsset: approved,
    });
    expect(["generated", "validation_failed", "generation_failed"]).toContain(ok.instagram?.status);
    expect(ok.instagram?.status).not.toBe("not_generated");
    expect(ok.instagram?.status).toBe("generated");
  });

  it("7. Threads regression still passes compose path", async () => {
    const approved = approveCanonicalMarketingAsset({
      asset: durableAsset(),
      mode: "ai_original",
      approvedBy: "tester",
    });
    const content = await composeThreadsPublishableContent({
      composerInput: baseComposer(approved),
      invoke: async (prompt) => {
        const text = typeof prompt === "string" ? prompt : prompt.text;
        expect(text).toContain(THREADS_WRITING_CONTRACT.slice(0, 24));
        return JSON.stringify({
          title: null,
          body: "온천으로만 알면 놓치는 디테일이 있다. 천장과 창문 비율이 먼저 보인다. 건축 디테일과 문화 맥락. 같은 장소를 다르게 본다.",
        });
      },
      allowDeterministicFallback: false,
    });
    expect(content.publishableSuccess).toBe(true);
    expect(content.channel).toBe("threads");
  });

  it("missing Hermes config is repaired from donor; empty stdout not invalid_json", () => {
    const hermesHome = tempRoot();
    const donorDir = join(hermesHome, "profiles", "channel-editor-threads");
    mkdirSync(donorDir, { recursive: true });
    writeFileSync(join(donorDir, "config.yaml"), "model:\n  default: theallcloud/auto\n", "utf8");

    const igDir = join(hermesHome, "profiles", "channel-editor-instagram");
    mkdirSync(igDir, { recursive: true });
    // SOUL only — the production failure mode
    writeFileSync(join(igDir, "SOUL.md"), "# Channel Editor (instagram)\n", "utf8");

    const ready = ensureChannelEditorHermesOneshotReady("instagram", hermesHome);
    expect(ready.repaired).toBe(true);
    expect(readFileSync(ready.configPath, "utf8")).toContain("theallcloud/auto");

    expect(isHermesFalseSuccessBody("")).toBe(true);
    expect(isHermesFalseSuccessBody("HTTP 401: unauthorized")).toBe(true);
    expect(() =>
      assertHermesSpawnSyncSuccess(
        "channel-editor-instagram",
        {
          status: 0,
          signal: null,
          error: null,
          stdout: "",
          stderr: "No LLM provider configured",
        },
        60_000,
      ),
    ).toThrow(/no usable model output/i);

    const classified = classifyPublishableLlmFailure(
      new Error("channel-editor-instagram returned no usable model output (No LLM provider configured)"),
    );
    expect(classified.category).toBe("auth");
    expect(classified.category).not.toBe("invalid_json");
  });

  it("composeInstagram uses buildChannelComposerPromptParts (approved path)", async () => {
    const approved = approveCanonicalMarketingAsset({
      asset: durableAsset(),
      mode: "ai_original",
      approvedBy: "tester",
    });
    await composeInstagramPublishableContent({
      composerInput: baseComposer(approved),
      invoke: async (prompt) => {
        expect(typeof prompt).toBe("object");
        const parts = prompt as { system: string; user: string; text: string; channel: string };
        expect(parts.channel).toBe("instagram");
        expect(parts.system.length).toBeGreaterThan(0);
        expect(parts.text).toContain("CHANNEL_EDITOR_IDENTITY");
        return validInstagramJson();
      },
      allowDeterministicFallback: false,
    });
  });
});
