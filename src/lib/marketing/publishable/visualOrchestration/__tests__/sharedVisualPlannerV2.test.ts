/**
 * Shared Visual Planner v2 — VRA-aware orchestration invariants.
 */
import { describe, expect, it } from "vitest";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
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
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
import { buildSharedVisualPlannerInput } from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import {
  materializeSharedVisualPlanFromLlm,
  SharedVisualPlannerValidationError,
} from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { SHARED_VISUAL_PLANNER_SOUL } from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import { resolveSharedVisualPlanLifecycle } from "@/lib/marketing/publishable/visualOrchestration/lifecycle";

const approvedAsset = {
  assetId: "cma_dao",
  version: 1,
  approvedVersion: 1,
  titleKo: "북부 국경 Dao족",
  bodyKo: "랑선 일대",
  forbiddenClaimsKo: ["특정 마을 단정"],
  limitationsKo: ["현장 미확인"],
  supportedClaimBoundaryKo: "공식 소개",
  storySupportVerdict: "supported",
} as unknown as CanonicalMarketingAsset;

function channel(
  overrides: Partial<PublishableChannelContent> & { channel: PublishableChannelContent["channel"] },
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    format: "threads_text",
    title: null,
    body: "본문",
    status: "generated",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceCandidateId: "cmc_dao",
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
    visualIntent: "legacy intent should lose to VRA",
    ...partial,
  };
}

function daoBundle(): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_dao_svp2",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev",
    targetChannels: ["threads", "instagram"],
    sourceAssetId: "cma_dao",
    sourceAssetVersion: 1,
    threads: channel({
      channel: "threads",
      body: "해변만 떠올렸다면 북부 국경",
      mediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "representational",
            reusableOnInstagram: true,
          },
        ],
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
        cardPlan: [
          card({
            cardId: "card_1",
            visual: {
              visualId: "social_visual_01",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "legacy typography false",
            },
          }),
          card({ cardId: "card_2" }),
          card({ cardId: "card_3" }),
          card({ cardId: "card_4" }),
          card({ cardId: "card_5" }),
        ],
      },
    }),
  };
}

function daoVra(): InstagramVisualRolePlan {
  return {
    contract: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    assetId: "cma_dao",
    assetVersion: 1,
    sourceCarouselFingerprint: "fp_c",
    sourceCardCopyFingerprint: "fp_cc",
    rhythmSummary: "hero → bridge → context → detail → closing",
    cards: [
      {
        cardId: "card_1",
        visualRole: "hero_cover",
        visualPurpose: "establishing",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent: "북부 산악 국경 establishing 풍경",
        evidenceRefs: [],
      },
      {
        cardId: "card_2",
        visualRole: "bridge_statement",
        visualPurpose: "bridge",
        visualPriority: "strong",
        visualDensity: "subtle",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "image_backed_statement",
        reusePreference: "derivative_ok",
        concreteVisualIntent: "산악 능선 배경 bridge statement",
        evidenceRefs: [],
      },
      {
        cardId: "card_3",
        visualRole: "cultural_context",
        visualPurpose: "context",
        visualPriority: "useful",
        visualDensity: "strong",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "photo_top",
        reusePreference: "reusable",
        concreteVisualIntent: "Dao족 마을 맥락 환경",
        evidenceRefs: [],
      },
      {
        cardId: "card_4",
        visualRole: "architecture_detail",
        visualPurpose: "detail",
        visualPriority: "strong",
        visualDensity: "strong",
        visualModePreference: "object_or_detail",
        generationPreference: "preferred",
        presentationPreference: "detail_focus",
        reusePreference: "reusable",
        concreteVisualIntent: "nhà trình tường 흙다짐 디테일",
        evidenceRefs: ["ev"],
      },
      {
        cardId: "card_5",
        visualRole: "closing_mood",
        visualPurpose: "close",
        visualPriority: "optional",
        visualDensity: "balanced",
        visualModePreference: "atmosphere",
        generationPreference: "optional",
        presentationPreference: "background_mood",
        reusePreference: "derivative_ok",
        concreteVisualIntent: "산악 마감 mood payoff",
        evidenceRefs: [],
      },
    ],
    provenance: {
      sourceAssetId: "cma_dao",
      sourceVersion: 1,
      modelProfile: "instagram-visual-role-architect",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
    },
  };
}

const CONCRETE =
  "북부 산악 국경지대의 지형과 전통 흙다짐 주거 환경을 차분한 여행 에디토리얼 맥락으로 보여주는 wide contextual scene";

function validFullCoverageLlm(overrides?: {
  card1Generated?: boolean;
  decisionTrace?: unknown;
  strategySummary?: string;
  mergeExclusive?: boolean;
  modeDiverge?: boolean;
  duplicateCard?: boolean;
}) {
  const card1Gen = overrides?.card1Generated ?? true;
  const visuals = [
    {
      role: "context_cover",
      visualMode: "editorial_photo",
      generatedVisualNeeded: card1Gen,
      visualIntent: CONCRETE,
      usages: [
        { channel: "threads", slotIndex: 0 },
        { channel: "instagram", cardId: "card_1" },
        ...(overrides?.mergeExclusive
          ? [{ channel: "instagram" as const, cardId: "card_2" }]
          : []),
      ],
    },
    ...(overrides?.mergeExclusive
      ? []
      : [
          {
            role: "bridge",
            visualMode: "editorial_photo" as const,
            generatedVisualNeeded: false,
            visualIntent: "산악 능선 배경을 살린 image-backed bridge statement treatment",
            usages: [{ channel: "instagram" as const, cardId: "card_2" }],
          },
        ]),
    {
      role: "culture",
      visualMode: "editorial_photo",
      generatedVisualNeeded: true,
      visualIntent: "북부 국경 산악 마을 생활 공간 맥락 — 특정 간판 식별 금지",
      usages: [{ channel: "instagram", cardId: "card_3" }],
    },
    {
      role: "architecture_detail",
      visualMode: overrides?.modeDiverge ? ("editorial_photo" as const) : ("object_or_detail" as const),
      generatedVisualNeeded: true,
      visualIntent: "판축 흙다짐 벽면 구조 디테일 close-up — nhà trình tường",
      usages: [{ channel: "instagram", cardId: "card_4" }],
    },
    {
      role: "closing",
      visualMode: "minimal_closing",
      generatedVisualNeeded: false,
      visualIntent: "산악 지대 고요한 마감 분위기 — 휴양 프레임 밖 payoff mood",
      usages: [
        { channel: "instagram", cardId: "card_5" },
        ...(overrides?.duplicateCard
          ? [{ channel: "instagram" as const, cardId: "card_3" }]
          : []),
      ],
    },
  ];
  return {
    strategySummary:
      overrides?.strategySummary ??
      "4 masters: Threads+hero share; bridge local; culture & architecture split for distinct subjects; closing mood optional. Prefer VRA over legacy typography false on card_1.",
    decisionTrace: overrides?.decisionTrace ?? { overrides: [] },
    visuals,
  };
}

describe("Shared Visual Planner v2 — VRA-aware", () => {
  it("A. VRA precedence over legacy visualHints in planner input", () => {
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: daoBundle(),
      instagramVisualRolePlan: daoVra(),
    });
    expect(input.authority.instagramVisualSemantics).toBe("instagram_visual_role_plan");
    expect(input.instagramVisualRolePlan).toBeTruthy();
    const cards = (input.instagramVisualRolePlan as { cards: Array<{ visualRole: string }> }).cards;
    expect(cards[0]!.visualRole).toBe("hero_cover");
    const ig = input.channels.instagram as { visualHints: { note: string; cards: Array<{ generatedVisualNeeded: boolean | null }> } };
    expect(ig.visualHints.note).toMatch(/legacy advisory|prefer instagramVisualRolePlan/i);
    expect(ig.visualHints.cards[0]!.generatedVisualNeeded).toBe(false); // legacy still present as advisory
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/orchestration only|VRA wins|generationPreference/i);
  });

  it("B. coverage — every VRA card exactly once", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm(),
      instagramVisualRolePlan: daoVra(),
      sourceInstagramVisualRoleFingerprint: "fp",
    });
    const igUsages = plan.visuals.flatMap((v) =>
      v.usages.filter((u) => u.channel === "instagram").map((u) => u.cardId),
    );
    expect(igUsages.sort()).toEqual(["card_1", "card_2", "card_3", "card_4", "card_5"]);
  });

  it("C. generation mapping — required false without override fails; with override ok; optional false ok", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: validFullCoverageLlm({ card1Generated: false }),
        instagramVisualRolePlan: daoVra(),
      }),
    ).toThrow(/generationPreference=required.*without decisionTrace/i);

    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm({
        card1Generated: false,
        decisionTrace: {
          overrides: [
            {
              cardId: "card_1",
              field: "generationPreference",
              requested: "required",
              final: "false",
              reason: "Reuse existing Threads establishing still covers hero treatment",
            },
          ],
        },
      }),
      instagramVisualRolePlan: daoVra(),
    });
    const hero = plan.visuals.find((v) =>
      v.usages.some((u) => u.channel === "instagram" && u.cardId === "card_1"),
    );
    expect(hero?.generatedVisualNeeded).toBe(false);

    // optional false already in fixture for card_5 — passes without override
    expect(
      plan.visuals.find((v) =>
        v.usages.some((u) => u.channel === "instagram" && u.cardId === "card_5"),
      )?.generatedVisualNeeded,
    ).toBe(false);
  });

  it("D. mode override — divergence without trace fails; with trace allowed", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: validFullCoverageLlm({ modeDiverge: true }),
        instagramVisualRolePlan: daoVra(),
      }),
    ).toThrow(/visualModePreference.*without decisionTrace/i);

    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm({
        modeDiverge: true,
        decisionTrace: {
          overrides: [
            {
              cardId: "card_4",
              field: "visualModePreference",
              requested: "object_or_detail",
              final: "editorial_photo",
              reason: "Grouped with wider village scene for reuse quality",
            },
          ],
        },
      }),
      instagramVisualRolePlan: daoVra(),
    });
    expect(
      plan.visuals.find((v) =>
        v.usages.some((u) => u.channel === "instagram" && u.cardId === "card_4"),
      )?.visualMode,
    ).toBe("editorial_photo");
  });

  it("E. exclusive_preferred merge without trace fails", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: validFullCoverageLlm({ mergeExclusive: true }),
        instagramVisualRolePlan: daoVra(),
      }),
    ).toThrow(/exclusive_preferred.*without decisionTrace/i);

    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm({
        mergeExclusive: true,
        decisionTrace: {
          overrides: [
            {
              cardId: "card_1",
              field: "reusePreference",
              requested: "exclusive_preferred",
              final: "merged_with_card_2",
              reason: "Bridge uses derivative crop of same mountain establishing master",
            },
          ],
        },
      }),
      instagramVisualRolePlan: daoVra(),
    });
    const shared = plan.visuals.find(
      (v) =>
        v.usages.some((u) => u.channel === "instagram" && u.cardId === "card_1") &&
        v.usages.some((u) => u.channel === "instagram" && u.cardId === "card_2"),
    );
    expect(shared).toBeTruthy();
  });

  it("F. intra-Instagram grouping allowed", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm({
        mergeExclusive: true,
        decisionTrace: {
          overrides: [
            {
              cardId: "card_1",
              field: "reusePreference",
              requested: "exclusive_preferred",
              final: "merged_with_card_2",
              reason: "Derivative mountain establishing for bridge statement",
            },
          ],
        },
      }),
      instagramVisualRolePlan: daoVra(),
    });
    expect(plan.visuals.some((v) => v.usages.filter((u) => u.channel === "instagram").length >= 2)).toBe(
      true,
    );
  });

  it("G. Threads slot0 + IG card on same master allowed", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm(),
      instagramVisualRolePlan: daoVra(),
    });
    const cross = plan.visuals.find(
      (v) =>
        v.usages.some((u) => u.channel === "threads") &&
        v.usages.some((u) => u.channel === "instagram"),
    );
    expect(cross).toBeTruthy();
  });

  it("H. duplicate card usage fail-closed when VRA present", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: validFullCoverageLlm({ duplicateCard: true }),
        instagramVisualRolePlan: daoVra(),
      }),
    ).toThrow(SharedVisualPlannerValidationError);
  });

  it("I. legacy — no VRA still materializes", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: {
        strategySummary: "legacy",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card_1" },
            ],
          },
        ],
      },
      instagramVisualRolePlan: null,
    });
    expect(plan.planningMode).toBe("llm");
    expect(plan.sourceInstagramVisualRoleFingerprint == null).toBe(true);
  });

  it("J. lifecycle — VRA FP change stale; SVP change does not affect VRA artifact", () => {
    const vra = daoVra();
    const fp = buildInstagramVisualRoleContentFingerprint(vra);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: daoBundle(),
      llmRaw: validFullCoverageLlm(),
      instagramVisualRolePlan: vra,
      sourceInstagramVisualRoleFingerprint: fp,
    });
    expect(
      resolveSharedVisualPlanLifecycle({
        plan,
        bundle: daoBundle(),
        currentInstagramVisualRoleFingerprint: fp,
      }),
    ).toBe("fresh");
    expect(
      resolveSharedVisualPlanLifecycle({
        plan,
        bundle: daoBundle(),
        currentInstagramVisualRoleFingerprint: "other",
      }),
    ).toBe("stale");
  });

  it("weak strategySummary with VRA fails", () => {
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle: daoBundle(),
        llmRaw: validFullCoverageLlm({ strategySummary: "short" }),
        instagramVisualRolePlan: daoVra(),
      }),
    ).toThrow(/strategySummary too short/i);
  });
});
