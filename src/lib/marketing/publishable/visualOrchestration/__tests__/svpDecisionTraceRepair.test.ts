/**
 * SVP decision-trace repair enforcement — regression tests A–I.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { getArtifactFailurePolicy } from "@/lib/marketing/agentContracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
  type PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";
import {
  INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
  type InstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { persistInstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  persistSharedVisualPlan,
  readSharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  formatSharedVisualDecisionTraceRepairHint,
  generateSharedVisualPlanWithLlm,
} from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import {
  materializeSharedVisualPlanFromLlm,
  SharedVisualPlannerValidationError,
} from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { SHARED_VISUAL_PLANNER_SOUL } from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";

const approvedAsset = {
  assetId: "cma_dao_repair",
  version: 1,
  approvedVersion: 1,
  titleKo: "북부 국경 Dao족",
  bodyKo: "랑선 일대",
  forbiddenClaimsKo: ["특정 마을 단정"],
  limitationsKo: ["현장 미확인"],
  supportedClaimBoundaryKo: "공식 소개",
  storySupportVerdict: "supported",
} as unknown as CanonicalMarketingAsset;

const CONCRETE =
  "북부 산악 국경지대의 지형과 전통 흙다짐 주거 환경을 차분한 여행 에디토리얼 맥락으로 보여주는 scene";

function channel(
  overrides: Partial<PublishableChannelContent> & { channel: PublishableChannelContent["channel"] },
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    format: "threads_text",
    title: null,
    body: "본문",
    status: "generated",
    generatedAt: "2026-09-25T00:00:00.000Z",
    sourceCandidateId: "cmc_dao_repair",
    sourceRevision: "rev1",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: null,
      generationMode: "llm",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    mediaPlan: null,
    ...overrides,
  };
}

function card(
  partial: Partial<PublishableInstagramCardPlan> & { cardId: string },
): PublishableInstagramCardPlan {
  return {
    role: "cover",
    headline: "H",
    body: "B",
    visualIntent: "legacy",
    ...partial,
  };
}

function daoBundle(): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_dao_repair",
    businessDateKst: "2026-09-25",
    generatedAt: "2026-09-25T00:00:00.000Z",
    sourceRevision: "rev",
    targetChannels: ["threads", "instagram"],
    sourceAssetId: approvedAsset.assetId,
    sourceAssetVersion: 1,
    threads: channel({
      channel: "threads",
      body: "스레드 본문",
      mediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [],
      },
    }),
    shortform: channel({ channel: "shortform", format: "short_video_narration", body: "n" }),
    instagram: channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "캡션",
      instagramMeta: {
        hook: "북부",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: ["card-01", "card-02", "card-03", "card-04", "card-05"].map((cardId, i) =>
          card({ cardId, headline: `H${i}`, body: `B${i}` }),
        ),
      },
    }),
  };
}

/** Live-shaped VRA: architecture_detail prefers editorial_photo. */
function liveShapedVra(): InstagramVisualRolePlan {
  return {
    contract: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    assetId: approvedAsset.assetId,
    assetVersion: approvedAsset.version,
    sourceCarouselFingerprint: "fp_c",
    sourceCardCopyFingerprint: "fp_cc",
    rhythmSummary: "5-card rhythm for repair tests",
    cards: [
      {
        cardId: "card-01",
        visualRole: "hero_cover",
        visualPurpose: "hero",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent: "Resort beach establishing",
        evidenceRefs: [],
      },
      {
        cardId: "card-02",
        visualRole: "bridge_statement",
        visualPurpose: "bridge",
        visualPriority: "strong",
        visualDensity: "strong",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "image_backed_statement",
        reusePreference: "reusable",
        concreteVisualIntent: "Mountain bridge",
        evidenceRefs: [],
      },
      {
        cardId: "card-03",
        visualRole: "cultural_context",
        visualPurpose: "culture",
        visualPriority: "useful",
        visualDensity: "balanced",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "photo_top",
        reusePreference: "reusable",
        concreteVisualIntent: "Village context",
        evidenceRefs: [],
      },
      {
        cardId: "card-04",
        visualRole: "architecture_detail",
        visualPurpose: "detail",
        visualPriority: "strong",
        visualDensity: "strong",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "detail_focus",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent: "Rammed-earth wall close-up",
        evidenceRefs: ["ev"],
      },
      {
        cardId: "card-05",
        visualRole: "closing_mood",
        visualPurpose: "close",
        visualPriority: "optional",
        visualDensity: "subtle",
        visualModePreference: "editorial_photo",
        generationPreference: "optional",
        presentationPreference: "background_mood",
        reusePreference: "reusable",
        concreteVisualIntent: "Twilight mood",
        evidenceRefs: [],
      },
    ],
    provenance: {
      sourceAssetId: approvedAsset.assetId,
      sourceVersion: 1,
      modelProfile: "instagram-visual-role-architect",
      generatedAt: "2026-09-25T00:00:00.000Z",
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
    },
  };
}

function fullCoverageLlm(input: {
  card04Mode: "editorial_photo" | "object_or_detail";
  decisionTrace?: unknown;
}): Record<string, unknown> {
  return {
    strategySummary:
      "Five dedicated masters matching VRA rhythm; architecture detail may use object_or_detail with explicit override when needed for close-up fidelity.",
    decisionTrace: input.decisionTrace ?? { overrides: [] },
    visuals: [
      {
        role: "hero_cover",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent: CONCRETE,
        usages: [
          { channel: "threads", slotIndex: 0 },
          { channel: "instagram", cardId: "card-01" },
        ],
      },
      {
        role: "bridge_statement",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent: "산악 능선 bridge statement treatment for northern borderlands",
        usages: [{ channel: "instagram", cardId: "card-02" }],
      },
      {
        role: "cultural_context",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent: "Dao settlement context without identifying a specific village signboard",
        usages: [{ channel: "instagram", cardId: "card-03" }],
      },
      {
        role: "architecture_detail",
        visualMode: input.card04Mode,
        generatedVisualNeeded: true,
        visualIntent: "판축 흙다짐 벽면 구조 디테일 close-up — nhà trình tường",
        usages: [{ channel: "instagram", cardId: "card-04" }],
      },
      {
        role: "closing_mood",
        visualMode: "editorial_photo",
        generatedVisualNeeded: false,
        visualIntent: "고요한 고지대 twilight mood without resort framing",
        usages: [{ channel: "instagram", cardId: "card-05" }],
      },
    ],
  };
}

const VALID_MODE_TRACE = {
  overrides: [
    {
      cardId: "card-04",
      field: "visualModePreference",
      requested: "editorial_photo",
      final: "object_or_detail",
      reason: "Close-up rammed-earth wall needs object_or_detail framing",
    },
  ],
};

describe("SVP decision-trace repair enforcement", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function tmpPkg(): string {
    const dir = mkdtempSync(join(tmpdir(), "svp-repair-"));
    dirs.push(dir);
    mkdirSync(join(dir, "context"), { recursive: true });
    persistInstagramVisualRolePlan({
      packageRoot: dir,
      plan: liveShapedVra(),
      createdAt: "2026-09-25T00:00:00.000Z",
    });
    return dir;
  }

  function seedPreviousPlan(packageRoot: string): void {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: fullCoverageLlm({ card04Mode: "editorial_photo" }),
      instagramVisualRolePlan: liveShapedVra(),
      now: new Date("2026-09-24T14:29:56.927Z"),
      sourceInstagramVisualRoleFingerprint: "fp_prev",
    });
    persistSharedVisualPlan({
      packageRoot,
      plan: { ...plan, generatedAt: "2026-09-24T14:29:56.927Z" },
      createdAt: "2026-09-24T14:29:56.927Z",
    });
  }

  it("SOUL documents mode-override trace example without directing a mode change", () => {
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/architecture_detail/);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/object_or_detail/);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/decisionTrace/);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/not a directive|trace requirement only/i);
  });

  it("artifact contract: materializeInRepairLoop=true, repairAttempts=2, preserve_previous", () => {
    const policy = getArtifactFailurePolicy(SHARED_VISUAL_PLAN_CONTRACT);
    expect(policy.materializeInRepairLoop).toBe(true);
    expect(policy.repairAttempts).toBe(2);
    expect(policy.onGenerateFail).toBe("preserve_previous");
  });

  it("A: attempt1 missing mode trace → repair; attempt2 with valid trace → PASS", async () => {
    const pkg = tmpPkg();
    const invoke = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(fullCoverageLlm({ card04Mode: "object_or_detail" })))
      .mockResolvedValueOnce(
        JSON.stringify(
          fullCoverageLlm({
            card04Mode: "object_or_detail",
            decisionTrace: VALID_MODE_TRACE,
          }),
        ),
      );

    const result = await generateSharedVisualPlanWithLlm({
      packageRoot: pkg,
      bundle: daoBundle(),
      approvedCanonicalAsset: approvedAsset,
      invoke,
      skipVisualRoleArchitect: true,
    });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(String(invoke.mock.calls[1]?.[0])).toMatch(/visual_mode_override_missing/);
    expect(String(invoke.mock.calls[1]?.[0])).toMatch(/card-04/);
    expect(String(invoke.mock.calls[1]?.[0])).toMatch(/editorial_photo/);
    expect(String(invoke.mock.calls[1]?.[0])).toMatch(/object_or_detail/);
    if (result.ok) {
      expect(result.invokeCount).toBe(2);
      const card04 = result.plan.visuals.find((v) =>
        v.usages.some((u) => u.channel === "instagram" && u.cardId === "card-04"),
      );
      expect(card04?.visualMode).toBe("object_or_detail");
      expect(result.plan.decisionTrace?.overrides.some((o) => o.field === "visualModePreference")).toBe(
        true,
      );
    }
  });

  it("B: both attempts missing trace → fail + preserve previous", async () => {
    const pkg = tmpPkg();
    seedPreviousPlan(pkg);
    const before = readSharedVisualPlan(pkg);
    expect(before?.generatedAt).toBe("2026-09-24T14:29:56.927Z");

    const invoke = vi
      .fn()
      .mockResolvedValue(JSON.stringify(fullCoverageLlm({ card04Mode: "object_or_detail" })));

    const result = await generateSharedVisualPlanWithLlm({
      packageRoot: pkg,
      bundle: daoBundle(),
      approvedCanonicalAsset: approvedAsset,
      invoke,
      skipVisualRoleArchitect: true,
    });

    expect(result.ok).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(2);
    if (!result.ok) {
      expect(result.error.code).toBe("visual_mode_override_missing");
      expect(result.previousPlanPreserved).toBe(true);
      expect(result.previousPlan?.generatedAt).toBe("2026-09-24T14:29:56.927Z");
    }
    const after = readSharedVisualPlan(pkg);
    expect(after?.generatedAt).toBe("2026-09-24T14:29:56.927Z");
  });

  it("C: valid trace on first attempt → no repair invoke", async () => {
    const pkg = tmpPkg();
    const invoke = vi.fn().mockResolvedValue(
      JSON.stringify(
        fullCoverageLlm({
          card04Mode: "object_or_detail",
          decisionTrace: VALID_MODE_TRACE,
        }),
      ),
    );

    const result = await generateSharedVisualPlanWithLlm({
      packageRoot: pkg,
      bundle: daoBundle(),
      approvedCanonicalAsset: approvedAsset,
      invoke,
      skipVisualRoleArchitect: true,
    });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    if (result.ok) expect(result.invokeCount).toBe(1);
  });

  it("D: requested/final same mode → trace not required", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: fullCoverageLlm({ card04Mode: "editorial_photo" }),
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).not.toThrow();
  });

  it("E: wrong cardId in trace still fails", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: fullCoverageLlm({
          card04Mode: "object_or_detail",
          decisionTrace: {
            overrides: [
              {
                cardId: "card-99",
                field: "visualModePreference",
                requested: "editorial_photo",
                final: "object_or_detail",
                reason: "Wrong card id should not satisfy card-04",
              },
            ],
          },
        }),
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).toThrow(SharedVisualPlannerValidationError);
  });

  it("F: wrong field in trace still fails", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: fullCoverageLlm({
          card04Mode: "object_or_detail",
          decisionTrace: {
            overrides: [
              {
                cardId: "card-04",
                field: "generationPreference",
                requested: "editorial_photo",
                final: "object_or_detail",
                reason: "Wrong field should not satisfy mode override",
              },
            ],
          },
        }),
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).toThrow(/visual_mode_override_missing|visualModePreference/);
  });

  it("G: reason below minimum length still fails", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: fullCoverageLlm({
          card04Mode: "object_or_detail",
          decisionTrace: {
            overrides: [
              {
                cardId: "card-04",
                field: "visualModePreference",
                requested: "editorial_photo",
                final: "object_or_detail",
                reason: "short",
              },
            ],
          },
        }),
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).toThrow(/visual_mode_override_missing|visualModePreference/);
  });

  it("H: generation/reuse override validation still enforced", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: {
          ...fullCoverageLlm({ card04Mode: "editorial_photo" }),
          visuals: (
            fullCoverageLlm({ card04Mode: "editorial_photo" }).visuals as Array<{
              usages: Array<{ cardId?: string }>;
              generatedVisualNeeded: boolean;
              [key: string]: unknown;
            }>
          ).map((v) =>
            v.usages.some((u) => u.cardId === "card-01")
              ? { ...v, generatedVisualNeeded: false }
              : v,
          ),
        },
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).toThrow(/required_generation_override_missing|generationPreference=required/);

    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: {
          strategySummary:
            "Broken exclusive merge without reuse override for architecture detail card.",
          decisionTrace: { overrides: [] },
          visuals: [
            {
              role: "hero_cover",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              visualIntent: CONCRETE,
              usages: [
                { channel: "threads", slotIndex: 0 },
                { channel: "instagram", cardId: "card-01" },
                { channel: "instagram", cardId: "card-04" },
              ],
            },
            {
              role: "bridge_statement",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              visualIntent: "산악 능선 bridge statement treatment for northern borderlands",
              usages: [{ channel: "instagram", cardId: "card-02" }],
            },
            {
              role: "cultural_context",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              visualIntent: "Dao settlement context without identifying a specific village signboard",
              usages: [{ channel: "instagram", cardId: "card-03" }],
            },
            {
              role: "closing_mood",
              visualMode: "editorial_photo",
              generatedVisualNeeded: false,
              visualIntent: "고요한 고지대 twilight mood without resort framing",
              usages: [{ channel: "instagram", cardId: "card-05" }],
            },
          ],
        },
        instagramVisualRolePlan: liveShapedVra(),
      }),
    ).toThrow(/exclusive_merge_override_missing|exclusive_preferred/);
  });

  it("I: repair hint is bounded and includes required fields", () => {
    const err = new SharedVisualPlannerValidationError(
      "visual_mode_override_missing",
      "card card-04: visualModePreference=editorial_photo diverges from final object_or_detail without decisionTrace override",
      {
        cardId: "card-04",
        field: "visualModePreference",
        requested: "editorial_photo",
        final: "object_or_detail",
      },
    );
    const hint = formatSharedVisualDecisionTraceRepairHint(err);
    expect(hint).toMatch(/errorCode: visual_mode_override_missing/);
    expect(hint).toMatch(/cardId: card-04/);
    expect(hint).toMatch(/requested: editorial_photo/);
    expect(hint).toMatch(/final: object_or_detail/);
    expect(hint).toMatch(/decisionTrace/);
    expect(hint).not.toMatch(/sk-|Bearer |API_KEY/i);
  });
});
