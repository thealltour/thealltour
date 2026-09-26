/**
 * Naver Blog Structure — Purpose Enum Repair (fixtures A–E).
 */
import { readFileSync } from "node:fs";
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
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import { NAVER_BLOG_SECTION_PURPOSES } from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { NAVER_BLOG_STRUCTURE_PLANNER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import {
  NaverBlogEditorialMaterializeError,
  materializeNaverBlogStructurePlan,
} from "@/lib/marketing/publishable/naverBlogEditorial/materialize";
import { runNaverBlogEditorialPipeline } from "@/lib/marketing/publishable/naverBlogEditorial/pipeline";
import {
  NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE,
  NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX,
  buildNaverBlogStructurePurposeRepairHint,
  listInvalidSectionPurposes,
  structureLlmHasInvalidPurposes,
} from "@/lib/marketing/publishable/naverBlogEditorial/purposeRepair";
import { buildEditorialNarrativeContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";

function approvedAsset(): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_blog_purpose_repair",
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
    titleKo: "북부 국경지대 기록이 보여주는 다른 베트남",
    dekKo: null,
    openingHookKo: "다낭·푸꾸옥·호치민으로만 알았다면.",
    bodyKo:
      "공식 기록에는 북부 국경지대 Dao족과 nhà trình tường가 등장합니다. 세부 마을 위치는 단정하지 않습니다.",
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
    sourceCanonicalFingerprint: "fp_purpose_repair",
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
    candidateId: "cmc_blog_purpose_repair",
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
    targetChannels: ["naver_blog"],
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

function structureSkeleton(purposes: [string, string, string]) {
  return {
    titleStrategy: "공식 기록으로 보는 지역 차이",
    selectedTitle: "다낭·푸꾸옥 밖의 북부 국경지대 기록",
    titleCandidates: ["다낭·푸꾸옥 밖의 북부 국경지대 기록"],
    sectionPlan: [
      {
        sectionId: "sec_01",
        purpose: purposes[0],
        heading: "익숙한 해변과 대도시 이미지",
        narrativeBeatRefs: ["beat_01"],
        evidenceRefs: [],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_02",
        purpose: purposes[1],
        heading: "북부 국경지대 Dao족과 전통 주거 기록",
        narrativeBeatRefs: ["beat_02"],
        evidenceRefs: ["ev_dao"],
        targetDepth: "standard",
      },
      {
        sectionId: "sec_03",
        purpose: purposes[2],
        heading: "지금 자료로 확인할 수 있는 것",
        narrativeBeatRefs: ["beat_03"],
        evidenceRefs: [],
        targetDepth: "brief",
      },
    ],
    openingIntent: "익숙한 이미지를 환기",
    conclusionIntent: "확인 가능한 범위만 정리",
    ctaIntent: null,
    faqPlan: [],
    searchIntent: null,
    primaryTopic: "베트남 북부 국경지대 기록",
    evidenceCoverage: "공식 기록 범위",
  };
}

function copyFromStructure(structure: {
  selectedTitle: string;
  sectionPlan: Array<{ sectionId: string; heading: string }>;
}) {
  const sectionOutputs = structure.sectionPlan.map((s) => ({
    sectionId: s.sectionId,
    heading: s.heading,
    bodyMarkdown: `${s.heading}에 대한 공식 기록 범위의 설명입니다.`,
  }));
  const bodyMarkdown = [
    `# ${structure.selectedTitle}`,
    "",
    ...sectionOutputs.flatMap((s) => [`## ${s.heading}`, "", s.bodyMarkdown, ""]),
  ].join("\n");
  return {
    title: structure.selectedTitle,
    bodyMarkdown,
    sectionOutputs,
    faq: [],
    cta: null,
    evidenceRefs: ["ev_dao"],
  };
}

function promptBlob(parts: unknown): string {
  if (typeof parts === "string") return parts;
  const p = parts as { text?: string; user?: string; hermesProfile?: string };
  return `${p.hermesProfile ?? ""}\n${p.text ?? ""}\n${p.user ?? ""}`;
}

function isPurposeRepairPrompt(parts: unknown): boolean {
  return promptBlob(parts).includes("PURPOSE_REPAIR");
}

function isCopyPrompt(parts: unknown): boolean {
  if (typeof parts === "string") return false;
  const profile = (parts as { hermesProfile?: string }).hermesProfile ?? "";
  return profile.includes("copy-writer") || profile.endsWith("copy-writer");
}

describe("Naver Blog Structure purpose enum repair", () => {
  it("planner SOUL encodes hard purpose enum (no free-form)", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/section\.purpose enum \(hard\)/i);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toContain(NAVER_BLOG_SECTION_PURPOSE_ENUM_LINE);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Free-form purpose labels are forbidden/);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/never `conclusion`/);
    // No hardcoded alias map in repair helpers / pipeline
    const purposeSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/purposeRepair.ts"),
      "utf8",
    );
    const pipelineSrc = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/naverBlogEditorial/pipeline.ts"),
      "utf8",
    );
    expect(purposeSrc).not.toMatch(/PURPOSE_ALIAS|purposeAliasMap|aliasMap/);
    expect(pipelineSrc).not.toMatch(/PURPOSE_ALIAS|purposeAliasMap|aliasMap/);
    expect(purposeSrc).toMatch(/NO alias table/i);
    expect(NAVER_BLOG_STRUCTURE_PURPOSE_REPAIR_MAX).toBe(2);
    expect(NAVER_BLOG_SECTION_PURPOSES).toEqual([
      "opening",
      "context",
      "evidence",
      "detail",
      "contrast",
      "limitation",
      "closing",
      "faq_support",
    ]);
  });

  it("A. conclusion → repair → closing → materialize PASS", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const invalid = structureSkeleton(["opening", "context", "conclusion"]);
    expect(listInvalidSectionPurposes(invalid).map((r) => r.purpose)).toEqual(["conclusion"]);
    const repaired = structureSkeleton(["opening", "context", "closing"]);

    const invoke = vi.fn(async (parts: unknown) => {
      if (isPurposeRepairPrompt(parts)) return JSON.stringify(repaired);
      if (isCopyPrompt(parts)) return JSON.stringify(copyFromStructure(repaired));
      return JSON.stringify(invalid);
    });

    const result = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      forceRegenerate: true,
    });
    expect(result.status).toBe("generated");
    expect(result.structure?.sectionPlan.map((s) => s.purpose)).toEqual([
      "opening",
      "context",
      "closing",
    ]);
    expect(result.content.publishableSuccess).toBe(true);
    expect(invoke.mock.calls.length).toBeGreaterThanOrEqual(2);
    const repairCall = invoke.mock.calls.find((c) => isPurposeRepairPrompt(c[0] ?? {}));
    expect(repairCall).toBeTruthy();
    expect(buildNaverBlogStructurePurposeRepairHint([{ sectionId: "sec_03", purpose: "conclusion" }])).not.toMatch(
      /conclusion\s*→\s*closing/,
    );
  });

  it("B. development → repair chooses context/detail/evidence/contrast → PASS", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const invalid = structureSkeleton(["opening", "development", "closing"]);
    expect(structureLlmHasInvalidPurposes(invalid)).toBe(true);
    // Semantic choice for a records/detail mid-section — not a hardcoded alias.
    const repaired = structureSkeleton(["opening", "detail", "closing"]);

    const invoke = vi.fn(async (parts: unknown) => {
      if (isPurposeRepairPrompt(parts)) return JSON.stringify(repaired);
      if (isCopyPrompt(parts)) return JSON.stringify(copyFromStructure(repaired));
      return JSON.stringify(invalid);
    });

    const result = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      forceRegenerate: true,
    });
    expect(result.status).toBe("generated");
    const mid = result.structure?.sectionPlan[1]?.purpose;
    expect(["context", "detail", "evidence", "contrast"]).toContain(mid);
    expect(result.structure?.sectionPlan[1]?.purpose).toBe("detail");
  });

  it("C. reframe → repair → allowed enum → PASS", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const invalid = structureSkeleton(["opening", "reframe", "closing"]);
    const repaired = structureSkeleton(["opening", "contrast", "closing"]);
    const invoke = vi.fn(async (parts: unknown) => {
      if (isPurposeRepairPrompt(parts)) return JSON.stringify(repaired);
      if (isCopyPrompt(parts)) return JSON.stringify(copyFromStructure(repaired));
      return JSON.stringify(invalid);
    });
    const result = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      forceRegenerate: true,
    });
    expect(result.status).toBe("generated");
    expect(NAVER_BLOG_SECTION_PURPOSES).toContain(result.structure!.sectionPlan[1].purpose);
    expect(result.structure!.sectionPlan[1].purpose).toBe("contrast");
  });

  it("D. repair still invalid → fail-closed invalid_purpose semantics", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const invalid = structureSkeleton(["opening", "development", "conclusion"]);
    const stillBad = structureSkeleton(["opening", "development", "closing"]);
    const invoke = vi.fn(async (parts: unknown) => {
      if (isCopyPrompt(parts)) {
        throw new Error("copy_writer_must_not_run_when_structure_fails");
      }
      if (isPurposeRepairPrompt(parts)) return JSON.stringify(stillBad);
      return JSON.stringify(invalid);
    });
    const result = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      forceRegenerate: true,
    });
    expect(result.status).toBe("failed");
    expect(result.structure).toBeNull();
    expect(result.copy).toBeNull();
    expect(result.content.publishableSuccess).toBe(false);
    expect(result.content.provenance.failureMessage).toMatch(/Invalid purpose/i);
    // Copy writer must not run when structure materialize fails
    const copyCalls = invoke.mock.calls.filter((c) => isCopyPrompt(c[0] ?? {}));
    expect(copyCalls).toHaveLength(0);
    // Direct materialize still fail-closed
    expect(() =>
      materializeNaverBlogStructurePlan({
        assetId: asset.assetId,
        assetVersion: asset.version,
        sourceNarrativeFingerprint: buildEditorialNarrativeContentFingerprint(plan),
        narrative: plan,
        llm: stillBad,
      }),
    ).toThrow(NaverBlogEditorialMaterializeError);
  });

  it("E. already-valid purpose set → no purpose repair → PASS", async () => {
    const asset = approvedAsset();
    const plan = narrative(asset);
    const valid = structureSkeleton(["opening", "evidence", "closing"]);
    expect(structureLlmHasInvalidPurposes(valid)).toBe(false);
    const invoke = vi.fn(async (parts: unknown) => {
      if (isPurposeRepairPrompt(parts)) {
        throw new Error("purpose_repair_must_not_run_for_valid_purposes");
      }
      if (isCopyPrompt(parts)) return JSON.stringify(copyFromStructure(valid));
      return JSON.stringify(valid);
    });
    const result = await runNaverBlogEditorialPipeline({
      composerInput: composerInput(asset, plan),
      invoke,
      forceRegenerate: true,
    });
    expect(result.status).toBe("generated");
    const purposeRepairs = invoke.mock.calls.filter((c) => isPurposeRepairPrompt(c[0] ?? {}));
    expect(purposeRepairs).toHaveLength(0);
    expect(result.structure?.sectionPlan.map((s) => s.purpose)).toEqual([
      "opening",
      "evidence",
      "closing",
    ]);
  });
});
