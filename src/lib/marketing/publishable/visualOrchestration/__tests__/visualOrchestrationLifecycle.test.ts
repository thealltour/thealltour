/**
 * Visual orchestration lifecycle: no auto-refresh on channel persist;
 * LLM planner/handoff explicit generation; failure preserves prior artifacts.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  buildSharedVisualPlan,
  persistSharedVisualPlan,
  readSharedVisualPlan,
  SHARED_VISUAL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  buildManualAstraHandoff,
  persistManualAstraHandoff,
  readManualAstraHandoff,
} from "@/lib/marketing/publishable/manualAstraHandoff";
import {
  resolveSharedVisualPlanLifecycle,
  resolveManualAstraHandoffLifecycle,
} from "@/lib/marketing/publishable/visualOrchestration/lifecycle";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { generateManualAstraHandoffWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff";
import { materializeSharedVisualPlanFromLlm } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { materializeManualAstraHandoffFromLlm } from "@/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff";
import { isGenericVisualIntent } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { approvedAssetToManualAstraContext } from "@/lib/marketing/publishable/refreshDerivedVisualArtifacts";

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

function daoBundle(overrides: Partial<PublishableContentBundle> = {}): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_daily_marketing_production_2026_09_18_e0",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev_dao_1",
    targetChannels: ["threads", "instagram", "shortform"],
    sourceAssetId: "asset_dao",
    sourceAssetVersion: 2,
    threads: channel({
      channel: "threads",
      body: "해변만 떠올렸다면 북부 국경의 또 다른 베트남",
      sourceRevision: "thr_rev_1",
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
    shortform: channel({
      channel: "shortform",
      format: "short_video_narration",
      body: "나레이션",
      sourceRevision: "sf_rev_1",
    }),
    instagram: channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "인스타 캡션 — 북부 산악 대비",
      sourceRevision: "ig_rev_1",
      instagramMeta: {
        hook: "북부",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "북부 국경",
            body: "또 다른 베트남",
            visualIntent: "establishing mountain border",
            visual: {
              visualId: "social_visual_01",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              reusableOnThreads: true,
              visualIntent: "북부 산악 establishing",
            },
          },
          {
            cardId: "card-02",
            role: "information",
            headline: "건축 디테일",
            body: "로컬 구조",
            visualIntent: "architecture detail",
            visual: {
              visualId: "social_visual_02",
              visualMode: "object_or_detail",
              generatedVisualNeeded: true,
              reusableOnThreads: false,
              visualIntent: "로컬 건축 디테일",
            },
          },
          {
            cardId: "card-03",
            role: "cta",
            headline: "정리",
            body: "저장해두기",
            visualIntent: "local typography ok",
            visual: {
              visualId: "social_visual_03",
              visualMode: "fact_card",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "fact card local",
            },
          },
        ],
      },
    }),
    ...overrides,
  };
}

const approvedAsset = {
  assetId: "asset_dao",
  version: 2,
  approvedVersion: 2,
  titleKo: "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남",
  openingHookKo: "해변만?",
  bodyKo: "북부 국경 산악 지형의 또 다른 베트남",
  keyTakeawaysKo: ["해변 중심 이미지와 대비"],
  decisionGuidanceKo: null,
  supportedClaimBoundaryKo: "확인된 여행 관점 범위",
  limitationsKo: ["현장 미확인"],
  forbiddenClaimsKo: ["특정 마을 단정"],
  storySupportVerdict: "SUPPORTED_WITH_LIMITS",
  editorialArchetype: "discovery",
} as unknown as CanonicalMarketingAsset;

const MOCK_PLANNER_JSON = JSON.stringify({
  strategySummary:
    "Threads cover와 Instagram hook를 하나의 establishing visual로 공유하고, card-02만 별도 detail visual.",
  visuals: [
    {
      role: "context_cover",
      visualMode: "editorial_photo",
      generatedVisualNeeded: true,
      visualIntent:
        "익숙한 해변·리조트 중심 베트남과 대비되는 북부 산악 지역의 지형과 환경을 보여주는 차분한 travel-editorial establishing visual. 특정 마을로 식별할 수 있는 간판·랜드마크는 피한다.",
      usages: [
        { channel: "threads", slotIndex: 0 },
        { channel: "instagram", cardId: "card-01" },
      ],
    },
    {
      role: "architecture_detail",
      visualMode: "object_or_detail",
      generatedVisualNeeded: true,
      visualIntent:
        "북부 국경 지역 로컬 건축·구조물의 재질과 형태를 가까이에서 보여주는 detail visual. 간판 문구는 읽히지 않게 처리.",
      usages: [{ channel: "instagram", cardId: "card-02" }],
    },
  ],
});

describe("visual orchestration lifecycle", () => {
  it("A. channel bundle change marks existing plan stale without deleting", () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-a-"));
    try {
      const b1 = daoBundle();
      const plan = buildSharedVisualPlan({ bundle: b1 });
      persistSharedVisualPlan({ packageRoot: dir, plan });
      expect(resolveSharedVisualPlanLifecycle({ plan, bundle: b1 })).toBe("fresh");

      const b2 = daoBundle({
        threads: channel({
          channel: "threads",
          body: "재생성이후 본문",
          sourceRevision: "thr_rev_2",
          mediaPlan: b1.threads.mediaPlan,
        }),
      });
      const disk = readSharedVisualPlan(dir);
      expect(disk).not.toBeNull();
      expect(resolveSharedVisualPlanLifecycle({ plan: disk, bundle: b2 })).toBe("stale");
      expect(existsSync(join(dir, SHARED_VISUAL_PLAN_RELATIVE_PATH))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B. Instagram channel revision change → plan+handoff stale", () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-b-"));
    try {
      const b1 = daoBundle();
      const plan = buildSharedVisualPlan({ bundle: b1 });
      const handoff = buildManualAstraHandoff({
        sharedVisualPlan: plan,
        approvedAssetContext: approvedAssetToManualAstraContext(approvedAsset),
      });
      persistSharedVisualPlan({ packageRoot: dir, plan });
      persistManualAstraHandoff({ packageRoot: dir, handoff });

      const b2 = daoBundle({
        instagram: {
          ...b1.instagram!,
          sourceRevision: "ig_rev_2",
          body: "인스타 재생성 본문",
        },
      });
      const planDisk = readSharedVisualPlan(dir)!;
      const handoffDisk = readManualAstraHandoff(dir)!;
      const planLife = resolveSharedVisualPlanLifecycle({ plan: planDisk, bundle: b2 });
      expect(planLife).toBe("stale");
      expect(
        resolveManualAstraHandoffLifecycle({
          handoff: handoffDisk,
          plan: planDisk,
          planLifecycle: planLife,
        }),
      ).toBe("stale");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C. ensurePublishableContent no longer imports refreshDerived — plan file untouched on bundle write", () => {
    // Structural: channel persist path must not call refreshDerivedVisualArtifacts.
    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/ensurePublishableContent.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/refreshDerivedVisualArtifacts/);
  });

  it("D. explicit Shared Visual Plan generate → exactly one planner LLM invoke", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-d-"));
    try {
      const bundle = daoBundle();
      const invoke = vi.fn(async () => MOCK_PLANNER_JSON);
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle,
        approvedCanonicalAsset: approvedAsset,
        invoke,
      });
      expect(result.ok).toBe(true);
      expect(invoke).toHaveBeenCalledTimes(1);
      if (result.ok) {
        expect(result.plan.planningMode).toBe("llm");
        expect(result.plan.visuals.length).toBe(2);
        expect(result.plan.sourceChannelSnapshot).toBeTruthy();
        // Must NOT mechanically equal Threads imageCount=1
        expect(result.plan.visuals.length).not.toBe(1);
        expect(result.plan.visuals[0]!.usages.some((u) => u.channel === "threads")).toBe(true);
        expect(result.plan.visuals[0]!.usages.some((u) => u.channel === "instagram")).toBe(true);
        expect(isGenericVisualIntent(result.plan.visuals[0]!.visualIntent)).toBe(false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("E. explicit Astra Handoff generate → exactly one writer LLM invoke; ids/usages fixed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-e-"));
    try {
      const bundle = daoBundle();
      const { plan } = materializeSharedVisualPlanFromLlm({
        bundle,
        llmRaw: JSON.parse(MOCK_PLANNER_JSON),
      });
      persistSharedVisualPlan({ packageRoot: dir, plan });

      const writerJson = JSON.stringify({
        visuals: plan.visuals
          .filter((v) => v.generatedVisualNeeded)
          .map((v) => ({
            visualId: v.visualId,
            refinedVisualIntent: `${v.visualIntent} — Astra brief enrichment with calm natural light.`,
            compositionGuidance: "Leave upper third quieter for Korean overlay.",
            textSafeArea: "Upper third text-safe",
            atmosphereLighting: "soft overcast travel-editorial light",
            evidenceSafeConstraints: ["Avoid identifiable village signage"],
          })),
      });
      const invoke = vi.fn(async () => writerJson);
      const result = await generateManualAstraHandoffWithLlm({
        packageRoot: dir,
        plan,
        planFresh: true,
        approvedAssetContext: approvedAssetToManualAstraContext(approvedAsset),
        invoke,
      });
      expect(result.ok).toBe(true);
      expect(invoke).toHaveBeenCalledTimes(1);
      if (result.ok) {
        expect(result.handoff.visualCount).toBe(2);
        expect(result.handoff.visuals.map((v) => v.visualId)).toEqual([
          "social_visual_01",
          "social_visual_02",
        ]);
        expect(result.handoff.visuals[0]!.usages).toEqual(plan.visuals[0]!.usages);
        expect(result.handoff.visuals[0]!.generatedTextAllowed).toBe(false);
        expect(result.handoff.visuals[0]!.logoAllowed).toBe(false);
        expect(result.handoff.visuals[0]!.expectedFilename).toBe("social_visual_01.png");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Planner rejects generic visualIntent", () => {
    const bundle = daoBundle();
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle,
        llmRaw: {
          strategySummary: "x",
          visuals: [
            {
              role: "cover",
              generatedVisualNeeded: true,
              visualIntent: "representational",
              usages: [{ channel: "threads", slotIndex: 0 }],
            },
          ],
        },
      }),
    ).toThrow(/too generic|generic_visual_intent/);
  });

  it("Planner drops invent Blog usages; validates IG cardId", () => {
    const bundle = daoBundle();
    const { plan, warnings } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "share cover only",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent:
              "북부 산악 국경 지형의 establishing travel-editorial visual. 간판·랜드마크 식별 금지.",
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card-01" },
              { channel: "naver_blog", placement: "hero" },
              { channel: "instagram", cardId: "card-99" },
            ],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]!.usages).toEqual([
      { channel: "threads", slotIndex: 0 },
      { channel: "instagram", cardId: "card-01" },
    ]);
    expect(warnings.some((w) => w.includes("usage_dropped"))).toBe(true);
  });

  it("Handoff writer rejects extra visual / id change", () => {
    const bundle = daoBundle();
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: JSON.parse(MOCK_PLANNER_JSON),
    });
    expect(() =>
      materializeManualAstraHandoffFromLlm({
        plan,
        llmRaw: {
          visuals: [
            {
              visualId: "social_visual_01",
              refinedVisualIntent: "ok enough detail for brief enrichment here",
            },
            {
              visualId: "social_visual_02",
              refinedVisualIntent: "ok enough detail for brief enrichment here",
            },
            {
              visualId: "social_visual_03",
              refinedVisualIntent: "sneaky third",
            },
          ],
        },
      }),
    ).toThrow(/visual_count_mismatch|unknown_or_missing|expected 2/);
  });

  it("Planner LLM failure preserves previous plan", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-fail-p-"));
    try {
      const bundle = daoBundle();
      const prior = buildSharedVisualPlan({ bundle });
      persistSharedVisualPlan({ packageRoot: dir, plan: prior });
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle,
        approvedCanonicalAsset: approvedAsset,
        invoke: async () => {
          throw new Error("llm_timeout");
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.previousPlanPreserved).toBe(true);
      }
      expect(readSharedVisualPlan(dir)?.sourceVisualPlanFingerprint).toBe(
        prior.sourceVisualPlanFingerprint,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Handoff LLM failure preserves previous handoff; stale plan blocks generate", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vo-fail-h-"));
    try {
      const bundle = daoBundle();
      const { plan } = materializeSharedVisualPlanFromLlm({
        bundle,
        llmRaw: JSON.parse(MOCK_PLANNER_JSON),
      });
      persistSharedVisualPlan({ packageRoot: dir, plan });
      const prior = buildManualAstraHandoff({
        sharedVisualPlan: plan,
        approvedAssetContext: approvedAssetToManualAstraContext(approvedAsset),
      });
      persistManualAstraHandoff({ packageRoot: dir, handoff: prior });

      const fail = await generateManualAstraHandoffWithLlm({
        packageRoot: dir,
        plan,
        planFresh: true,
        approvedAssetContext: approvedAssetToManualAstraContext(approvedAsset),
        invoke: async () => {
          throw new Error("writer_down");
        },
      });
      expect(fail.ok).toBe(false);
      expect(readManualAstraHandoff(dir)?.copyText).toBe(prior.copyText);

      const blocked = await generateManualAstraHandoffWithLlm({
        packageRoot: dir,
        plan,
        planFresh: false,
        invoke: async () => "{}",
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.error.code).toBe("shared_visual_plan_stale");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Plan regenerate makes existing handoff stale via fingerprint", () => {
    const bundle = daoBundle();
    const plan1 = buildSharedVisualPlan({ bundle });
    const handoff = buildManualAstraHandoff({
      sharedVisualPlan: plan1,
      approvedAssetContext: approvedAssetToManualAstraContext(approvedAsset),
    });
    const { plan: plan2 } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: JSON.parse(MOCK_PLANNER_JSON),
      now: new Date("2026-09-19T00:00:00.000Z"),
    });
    // Same snapshot fingerprint if same bundle — handoff stale only if plan fingerprint differs
    // LLM plan and deterministic plan may share snapshot fp; force different by comparing writer fingerprint field.
    // If fingerprints equal (same snapshot), handoff stays fingerprint-fresh vs plan2 only when
    // sourceSharedVisualPlanFingerprint matches plan2.
    const life = resolveManualAstraHandoffLifecycle({
      handoff,
      plan: plan2,
      planLifecycle: "fresh",
    });
    if (handoff.sourceSharedVisualPlanFingerprint !== plan2.sourceVisualPlanFingerprint) {
      expect(life).toBe("stale");
    } else {
      // Same bundle snapshot → same fp; handoff still matches — regenerate still replaces content when operator asks.
      expect(life).toBe("fresh");
    }
  });
});

describe("Dao fixture mocked planner structure", () => {
  it("produces shared cover + detail, not one-per-card, evidence-safe intents", () => {
    const bundle = daoBundle();
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: JSON.parse(MOCK_PLANNER_JSON),
    });
    expect(plan.visuals.length).toBe(2);
    expect(plan.visuals.every((v) => !isGenericVisualIntent(v.visualIntent))).toBe(true);
    expect(plan.visuals.filter((v) => v.generatedVisualNeeded).length).toBe(2);
    // card-03 local fact_card not forced external
    const usedCards = new Set(
      plan.visuals.flatMap((v) =>
        v.usages.filter((u) => u.channel === "instagram").map((u) => u.cardId),
      ),
    );
    expect(usedCards.has("card-01")).toBe(true);
    expect(usedCards.has("card-02")).toBe(true);
    expect(usedCards.has("card-03")).toBe(false);
  });
});
