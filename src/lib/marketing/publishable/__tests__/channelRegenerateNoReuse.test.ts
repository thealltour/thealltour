/**
 * Channel-scoped regenerate must never reuse specialist package artifacts.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  ASSET_SOURCE_WRITER_ROLE,
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  EDITORIAL_NARRATIVE_PLAN_CONTRACT,
  type EditorialNarrativePlan,
} from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { composeNaverBandPublishableContent } from "@/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent";
import { NAVER_BAND_COPY_CONTRACT } from "@/lib/marketing/publishable/naverBandCopy/contracts";
import { runNaverBandCopySpecialist } from "@/lib/marketing/publishable/naverBandCopy/pipeline";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { buildNaverBlogStructureContentFingerprint } from "@/lib/marketing/publishable/naverBlogEditorial/fingerprint";
import { runNaverBlogEditorialPipeline } from "@/lib/marketing/publishable/naverBlogEditorial/pipeline";
import { THREADS_COPY_CONTRACT } from "@/lib/marketing/publishable/threadsCopy/contracts";
import { runThreadsCopySpecialist } from "@/lib/marketing/publishable/threadsCopy/pipeline";

function approvedAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_no_reuse",
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
    titleKo: "북부 국경지대 기록으로 보는 다른 베트남",
    dekKo: null,
    openingHookKo: "다낭·푸꾸옥만 알았다면.",
    bodyKo: "공식 기록에는 Dao족과 nhà trình tường가 등장합니다. 세부 위치는 단정하지 않습니다.",
    keyTakeawaysKo: ["공식 기록 범위의 지역 차이"],
    decisionGuidanceKo: "공식 기록 범위에서만 비교한다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev_dao", noteKo: "공식 기록" }],
    limitationsKo: ["세부 마을 위치 미확정"],
    forbiddenClaimsKo: ["꼭 가봐야 할"],
    supportedClaimBoundaryKo: "공식 기록 범위",
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
    narrativePromise: "익숙한 프레임을 북부 국경 기록으로 재구성",
    audienceTakeaway: "같은 나라 안에도 다른 맥락이 있다",
    beats: [
      { beatId: "beat_01", purpose: "hook", message: "익숙한 해변·도시" },
      { beatId: "beat_02", purpose: "context", message: "북부 국경 기록" },
      { beatId: "beat_03", purpose: "closing", message: "확인 가능/불가능" },
    ],
    sourceCanonicalFingerprint: "fp_no_reuse",
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
    candidateId: "cmc_no_reuse",
    businessDateKst: "2026-09-18",
    topic: asset.titleKo,
    audience: "여행 독자",
    commercialIntent: "informational",
    hookHint: null,
    keyMessage: asset.titleKo,
    destinations: [],
    entities: [],
    usableFacts: [
      {
        statement: "공식 기록에 Dao족과 nhà trình tường가 등장한다",
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
    targetChannels: ["threads", "naver_blog", "naver_band"],
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

function isCopyPrompt(parts: unknown): boolean {
  const profile =
    typeof parts === "object" && parts && "hermesProfile" in parts
      ? String((parts as { hermesProfile?: string }).hermesProfile ?? "")
      : "";
  return profile.includes("copy");
}

function isStructurePrompt(parts: unknown): boolean {
  const profile =
    typeof parts === "object" && parts && "hermesProfile" in parts
      ? String((parts as { hermesProfile?: string }).hermesProfile ?? "")
      : "";
  return profile.includes("structure");
}

describe("channel regenerate no specialist reuse", () => {
  it("wiring: ensurePublishableContent + composers forward forceRegenerate", () => {
    const root = process.cwd();
    const ensureSrc = readFileSync(
      join(root, "src/lib/marketing/publishable/ensurePublishableContent.ts"),
      "utf8",
    );
    expect(ensureSrc).toMatch(/forceRegenerateChannels\.includes\(channel\)/);
    expect(ensureSrc).toMatch(/forceRegenerate,/);
    for (const rel of [
      "src/lib/marketing/publishable/naver_blog/composeNaverBlogPublishableContent.ts",
      "src/lib/marketing/publishable/naver_band/composeNaverBandPublishableContent.ts",
      "src/lib/marketing/publishable/threads/composeThreadsPublishableContent.ts",
    ]) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src).toMatch(/forceRegenerate: Boolean\(input\.forceRegenerate\)/);
    }
  });

  it("Band: forceRegenerate=true bypasses matching package artifact reuse", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "band-no-reuse-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    const staleBody = "STALE_BAND_BODY_SHOULD_NOT_REUSE";
    writeFileSync(
      join(dir, "context/naver-band-copy.json"),
      JSON.stringify({
        contract: NAVER_BAND_COPY_CONTRACT,
        assetId: asset.assetId,
        assetVersion: asset.version,
        title: "stale",
        body: staleBody,
        openingIntent: "hook",
        keyPoints: ["a", "b"],
        endingIntent: "none",
        selectedNarrativeBeats: ["beat_01"],
        evidenceRefs: [],
        sourceNarrativeFingerprint: narrativeFp,
        provenance: {
          sourceAssetId: asset.assetId,
          sourceVersion: asset.version,
          modelProfile: "naver-band-copy-writer",
          generatedAt: "2026-09-01T00:00:00.000Z",
          sourceUpstreamFingerprint: narrativeFp,
        },
      }),
      "utf8",
    );

    const freshBody = "FRESH_BAND_BODY_AFTER_FORCE";
    const invoke = vi.fn(async () =>
      JSON.stringify({
        title: "fresh",
        body: freshBody,
        openingIntent: "hook",
        keyPoints: ["공식 기록 범위", "지역 차이"],
        selectedNarrativeBeats: ["beat_01", "beat_02"],
        endingIntent: "observation",
        evidenceRefs: ["ev_dao"],
      }),
    );

    const reused = await runNaverBandCopySpecialist({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: false,
    });
    expect(reused.status).toBe("reused");
    expect(reused.content.body).toBe(staleBody);
    expect(invoke).not.toHaveBeenCalled();

    const forced = await runNaverBandCopySpecialist({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: true,
    });
    expect(forced.status).toBe("generated");
    expect(forced.content.body).toBe(freshBody);
    expect(invoke).toHaveBeenCalled();

    // Composer layer also forwards the flag
    invoke.mockClear();
    const composed = await composeNaverBandPublishableContent({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      useNaverBandCopySpecialist: true,
      forceRegenerate: true,
      allowDeterministicFallback: false,
    });
    expect(composed.body).toBe(freshBody);
    expect(invoke).toHaveBeenCalled();
    rmSync(dir, { recursive: true, force: true });
  });

  it("Threads: forceRegenerate=true bypasses matching package artifact reuse", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "threads-no-reuse-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);
    const staleBody = "STALE_THREADS_BODY_SHOULD_NOT_REUSE";
    writeFileSync(
      join(dir, "context/threads-copy.json"),
      JSON.stringify({
        contract: THREADS_COPY_CONTRACT,
        assetId: asset.assetId,
        assetVersion: asset.version,
        body: staleBody,
        selectedNarrativeBeats: ["beat_01"],
        endingIntent: "none",
        evidenceRefs: [],
        mediaPlan: null,
        sourceNarrativeFingerprint: narrativeFp,
        provenance: {
          sourceAssetId: asset.assetId,
          sourceVersion: asset.version,
          modelProfile: "threads-copy-writer",
          generatedAt: "2026-09-01T00:00:00.000Z",
          sourceUpstreamFingerprint: narrativeFp,
        },
      }),
      "utf8",
    );
    const freshBody = "FRESH_THREADS_BODY_AFTER_FORCE";
    const invoke = vi.fn(async () =>
      JSON.stringify({
        body: freshBody,
        selectedNarrativeBeats: ["beat_01"],
        endingIntent: "observation",
        evidenceRefs: ["ev_dao"],
        mediaPlan: null,
      }),
    );

    const reused = await runThreadsCopySpecialist({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: false,
    });
    expect(reused.status).toBe("reused");
    expect(reused.content.body).toBe(staleBody);

    const forced = await runThreadsCopySpecialist({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: true,
    });
    expect(forced.status).toBe("generated");
    expect(forced.content.body).toBe(freshBody);
    rmSync(dir, { recursive: true, force: true });
  });

  it("Blog: forceRegenerate=true regenerates even when structure+copy fingerprints match", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const dir = mkdtempSync(join(tmpdir(), "blog-no-reuse-"));
    mkdirSync(join(dir, "context"), { recursive: true });
    const narrativeFp = buildEditorialNarrativeContentFingerprint(plan);

    const structure = {
      contract: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
      assetId: asset.assetId,
      assetVersion: asset.version,
      titleStrategy: "stale",
      selectedTitle: "STALE_BLOG_TITLE",
      titleCandidates: ["STALE_BLOG_TITLE"],
      sectionPlan: [
        {
          sectionId: "sec_01",
          purpose: "opening",
          heading: "stale opening",
          narrativeBeatRefs: ["beat_01"],
          evidenceRefs: [],
          targetDepth: "standard",
        },
        {
          sectionId: "sec_02",
          purpose: "context",
          heading: "stale context",
          narrativeBeatRefs: ["beat_02"],
          evidenceRefs: [],
          targetDepth: "standard",
        },
        {
          sectionId: "sec_03",
          purpose: "closing",
          heading: "stale closing",
          narrativeBeatRefs: ["beat_03"],
          evidenceRefs: [],
          targetDepth: "brief",
        },
      ],
      openingIntent: "stale",
      conclusionIntent: "stale",
      ctaIntent: null,
      faqPlan: [],
      searchIntent: null,
      primaryTopic: "stale",
      evidenceCoverage: "stale",
      sourceNarrativeFingerprint: narrativeFp,
      provenance: {
        sourceAssetId: asset.assetId,
        sourceVersion: asset.version,
        modelProfile: "naver-blog-structure-planner",
        generatedAt: "2026-09-01T00:00:00.000Z",
        sourceUpstreamFingerprint: narrativeFp,
      },
    };
    writeFileSync(join(dir, "context/naver-blog-structure-plan.json"), JSON.stringify(structure), "utf8");
    const structureFp = buildNaverBlogStructureContentFingerprint(structure as never);
    writeFileSync(
      join(dir, "context/naver-blog-copy.json"),
      JSON.stringify({
        contract: NAVER_BLOG_COPY_CONTRACT,
        assetId: asset.assetId,
        assetVersion: asset.version,
        title: "STALE_BLOG_TITLE",
        bodyMarkdown: "# STALE_BLOG_TITLE\n\n## stale opening\n\nstale body\n",
        sectionOutputs: structure.sectionPlan.map((s) => ({
          sectionId: s.sectionId,
          heading: s.heading,
          bodyMarkdown: "stale body",
        })),
        faq: [],
        cta: null,
        evidenceRefs: [],
        sourceStructureFingerprint: structureFp,
        provenance: {
          sourceAssetId: asset.assetId,
          sourceVersion: asset.version,
          modelProfile: "naver-blog-copy-writer",
          generatedAt: "2026-09-01T00:00:00.000Z",
          sourceUpstreamFingerprint: structureFp,
        },
      }),
      "utf8",
    );

    const invoke = vi.fn(async (parts: unknown) => {
      if (isStructurePrompt(parts)) {
        return JSON.stringify({
          titleStrategy: "fresh",
          selectedTitle: "FRESH_BLOG_TITLE",
          titleCandidates: ["FRESH_BLOG_TITLE"],
          sectionPlan: structure.sectionPlan.map((s) => ({
            ...s,
            heading: s.heading.replace("stale", "fresh"),
          })),
          openingIntent: "fresh",
          conclusionIntent: "fresh",
          ctaIntent: null,
          faqPlan: [],
          searchIntent: null,
          primaryTopic: "fresh",
          evidenceCoverage: "fresh",
        });
      }
      if (isCopyPrompt(parts)) {
        return JSON.stringify({
          title: "FRESH_BLOG_TITLE",
          bodyMarkdown:
            "# FRESH_BLOG_TITLE\n\n## fresh opening\n\nfresh body\n\n## fresh context\n\nfresh body\n\n## fresh closing\n\nfresh body\n",
          sectionOutputs: structure.sectionPlan.map((s) => ({
            sectionId: s.sectionId,
            heading: s.heading.replace("stale", "fresh"),
            bodyMarkdown: "fresh body",
          })),
          faq: [],
          cta: null,
          evidenceRefs: ["ev_dao"],
        });
      }
      return "{}";
    });

    const reused = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: false,
    });
    expect(reused.status).toBe("reused");
    expect(reused.content.title).toBe("STALE_BLOG_TITLE");
    expect(invoke).not.toHaveBeenCalled();

    const forced = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      packageRoot: dir,
      forceRegenerate: true,
    });
    expect(forced.status).toBe("generated");
    expect(forced.content.title).toBe("FRESH_BLOG_TITLE");
    expect(invoke).toHaveBeenCalled();
    rmSync(dir, { recursive: true, force: true });
  });
});
