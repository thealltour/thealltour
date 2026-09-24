/**
 * Channel Worker visual metadata = advisory; Shared Visual Planner = final authority.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
  type PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";
import { buildSharedVisualPlannerInput } from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import {
  materializeSharedVisualPlanFromLlm,
  allowedThreadsSlotMax,
} from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { SHARED_VISUAL_PLANNER_SOUL } from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import { canMergeVisualRequests } from "@/lib/marketing/publishable/sharedVisualPlan/dedupe";
import type { SocialVisualRequest } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";

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
    visualIntent: "intent",
    ...partial,
  };
}

function daoBundle(overrides: Partial<PublishableContentBundle> = {}): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_dao_authority",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev_dao",
    targetChannels: ["threads", "instagram", "shortform"],
    sourceAssetId: "asset_dao",
    sourceAssetVersion: 1,
    threads: channel({
      channel: "threads",
      body: "해변만 떠올렸다면 북부 국경의 또 다른 베트남",
      mediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "representational",
            reusableOnInstagram: false,
          },
        ],
      },
    }),
    shortform: channel({
      channel: "shortform",
      format: "short_video_narration",
      body: "나레이션",
    }),
    instagram: channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "인스타 캡션",
      instagramMeta: {
        hook: "북부",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: [
          card({
            cardId: "card-01",
            role: "cover",
            headline: "북부 국경",
            body: "또 다른 베트남",
            visual: {
              visualId: "social_visual_01",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "cover typography",
            },
          }),
          card({
            cardId: "card-02",
            role: "information",
            headline: "흙다짐 건축",
            body: "nhà trình tường 디테일",
            visualIntent: "architecture",
            visual: {
              visualId: "social_visual_04",
              visualMode: "object_or_detail",
              generatedVisualNeeded: true,
              reusableOnThreads: false,
              visualIntent: "architecture detail",
            },
          }),
          card({
            cardId: "card-03",
            role: "evidence",
            headline: "건축 디테일",
            body: "로컬 구조 관찰",
            visualIntent: "nhà trình tường architecture close-up",
            // Worker omitted visual hint — Planner may still add
          }),
        ],
      },
    }),
    ...overrides,
  };
}

const approvedAsset = {
  assetId: "asset_dao",
  version: 1,
  approvedVersion: 1,
  titleKo: "해변과 리조트만 떠올렸다면, 북부 국경지대에서 만나는 또 다른 베트남",
  bodyKo: "북부 산악 지형",
  forbiddenClaimsKo: ["특정 다오 마을 단정", "금지된마을명XYZ"],
  limitationsKo: ["현장 미확인"],
  supportedClaimBoundaryKo: "확인된 범위",
  storySupportVerdict: "SUPPORTED_WITH_LIMITS",
  editorialArchetype: "discovery",
} as unknown as CanonicalMarketingAsset;

const CONCRETE =
  "익숙한 해변·리조트 중심 베트남과 대비되는 북부 산악 지역의 지형과 환경을 보여주는 차분한 travel-editorial establishing visual. 특정 마을 식별 간판은 피한다.";

describe("planner authority — Worker metadata advisory", () => {
  it("input nests Worker fields under visualHints with authority note", () => {
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: daoBundle(),
    });
    expect(input.authority.channelVisualMetadata).toBe("advisory_hint_only");
    expect(input.authority.finalVisualAuthority).toBe("shared_visual_planner");
    const threads = input.channels.threads as {
      content: unknown;
      visualHints: { imageCount: number; recommended: boolean };
    };
    expect(threads.content).toBeTruthy();
    expect(threads.visualHints.imageCount).toBe(1);
    expect((input.channels.threads as { mediaPlan?: unknown }).mediaPlan).toBeUndefined();
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/sole final authority for \*\*master visual asset orchestration\*\*|master visual asset orchestration/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/ADVISORY ONLY|advisory compatibility/i);
  });

  it("A. Threads imageCount=1 but Planner master count=2 → PASS", () => {
    const bundle = daoBundle();
    expect(bundle.threads.mediaPlan?.imageCount).toBe(1);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "cover shared + architecture detail",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
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
              "북부 국경 지역 로컬 건축·흙다짐 벽체의 재질과 형태를 가까이 보여주는 detail visual. 간판 문구는 읽히지 않게.",
            usages: [{ channel: "instagram", cardId: "card-02" }],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(2);
    expect(plan.visuals.map((v) => v.visualId)).toEqual([
      "social_visual_01",
      "social_visual_02",
    ]);
  });

  it("B. IG generated=false overridden to true → PASS", () => {
    const bundle = daoBundle();
    expect(
      bundle.instagram?.instagramMeta?.cardPlan?.[0]?.visual?.generatedVisualNeeded,
    ).toBe(false);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "need external cover",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      },
    });
    expect(plan.visuals[0]!.generatedVisualNeeded).toBe(true);
  });

  it("C. IG generated=true overridden to false → PASS", () => {
    const bundle = daoBundle();
    expect(
      bundle.instagram?.instagramMeta?.cardPlan?.[1]?.visual?.generatedVisualNeeded,
    ).toBe(true);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "local renderer better",
        visuals: [
          {
            role: "architecture_detail",
            visualMode: "fact_card",
            generatedVisualNeeded: false,
            visualIntent:
              "카드 카피만으로 충분한 건축 포인트 정리용 local fact_card — 외부 사진 불필요.",
            usages: [{ channel: "instagram", cardId: "card-02" }],
          },
        ],
      },
    });
    expect(plan.visuals[0]!.generatedVisualNeeded).toBe(false);
  });

  it("D. reusable flags false → shared master still PASS", () => {
    const bundle = daoBundle();
    expect(bundle.threads.mediaPlan!.visuals[0]!.reusableOnInstagram).toBe(false);
    expect(
      bundle.instagram?.instagramMeta?.cardPlan?.[0]?.visual?.reusableOnThreads,
    ).toBe(false);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "one shared establishing",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card-01" },
            ],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]!.usages).toHaveLength(2);
  });

  it("E. same worker visualId collision → 2 masters with fresh IDs", () => {
    const bundle = daoBundle();
    expect(bundle.threads.mediaPlan!.visuals[0]!.visualId).toBe("social_visual_01");
    expect(bundle.instagram?.instagramMeta?.cardPlan?.[0]?.visual?.visualId).toBe(
      "social_visual_01",
    );
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "split despite same worker id",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            visualId: "social_visual_01",
            usages: [{ channel: "threads", slotIndex: 0 }],
          },
          {
            role: "architecture_detail",
            visualMode: "object_or_detail",
            generatedVisualNeeded: true,
            visualIntent:
              "로컬 건축 디테일을 보여주는 close-up travel-editorial visual. 식별 가능한 간판은 피한다.",
            visualId: "social_visual_01",
            usages: [{ channel: "instagram", cardId: "card-02" }],
          },
        ],
      },
    });
    expect(plan.visuals.map((v) => v.visualId)).toEqual([
      "social_visual_01",
      "social_visual_02",
    ]);
  });

  it("F. different worker IDs merge into one master → PASS", () => {
    const bundle = daoBundle();
    expect(bundle.instagram?.instagramMeta?.cardPlan?.[1]?.visual?.visualId).toBe(
      "social_visual_04",
    );
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "merge threads+ig cover",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card-01" },
            ],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]!.visualId).toBe("social_visual_01");
  });

  it("G. Worker mode typography overridden to editorial_photo → PASS", () => {
    const bundle = daoBundle();
    expect(bundle.instagram?.instagramMeta?.cardPlan?.[0]?.visual?.visualMode).toBe(
      "typography",
    );
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "photo better for cover",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      },
    });
    expect(plan.visuals[0]!.visualMode).toBe("editorial_photo");
  });

  it("H. Planner adds visual for card without Worker visual hint → PASS", () => {
    const bundle = daoBundle();
    expect(bundle.instagram?.instagramMeta?.cardPlan?.[2]?.visual).toBeUndefined();
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "add architecture for card-03 from content",
        visuals: [
          {
            role: "architecture_detail",
            visualMode: "object_or_detail",
            generatedVisualNeeded: true,
            visualIntent:
              "카드 본문이 가리키는 흙다짐·로컬 건축 디테일을 보여주는 evidence-safe close-up. 특정 마을명·간판 회피.",
            usages: [{ channel: "instagram", cardId: "card-03" }],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]!.usages[0]).toEqual({ channel: "instagram", cardId: "card-03" });
  });

  it("I. Invalid usage card-99 → REJECT / dropped to no_valid", () => {
    const bundle = daoBundle();
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle,
        llmRaw: {
          strategySummary: "bad card",
          visuals: [
            {
              role: "context_cover",
              generatedVisualNeeded: true,
              visualIntent: CONCRETE,
              usages: [{ channel: "instagram", cardId: "card-99" }],
            },
          ],
        },
      }),
    ).toThrow(/no valid visuals|no_valid_visuals/);
  });

  it("J. Evidence violation — forbidden claim in intent → REJECT", () => {
    const bundle = daoBundle();
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle,
        forbiddenClaimsKo: approvedAsset.forbiddenClaimsKo,
        llmRaw: {
          strategySummary: "unsafe",
          visuals: [
            {
              role: "context_cover",
              generatedVisualNeeded: true,
              visualIntent:
                "금지된마을명XYZ 를 특정해 다큐처럼 보여주는 establishing visual — unsupported village claim.",
              usages: [{ channel: "instagram", cardId: "card-01" }],
            },
          ],
        },
      }),
    ).toThrow(/forbidden claim|evidence_forbidden_claim/);
  });

  it("K. ensurePublishableContent does not invoke planner", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/marketing/publishable/ensurePublishableContent.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/generateSharedVisualPlanWithLlm|refreshDerivedVisualArtifacts/);
  });

  it("L. Explicit Shared Visual Plan generation → Planner exactly once", async () => {
    const dir = mkdtempSync(join(tmpdir(), "auth-l-"));
    try {
      const invoke = vi.fn(async () =>
        JSON.stringify({
          strategySummary: "dao 2-master",
          visuals: [
            {
              role: "context_cover",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              visualIntent: CONCRETE,
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
                "북부 국경 로컬 건축 디테일 close-up. 특정 마을·간판 식별 금지.",
              usages: [{ channel: "instagram", cardId: "card-02" }],
            },
          ],
        }),
      );
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle: daoBundle(),
        approvedCanonicalAsset: approvedAsset,
        invoke,
      });
      expect(result.ok).toBe(true);
      expect(invoke).toHaveBeenCalledTimes(1);
      if (result.ok) {
        expect(result.plan.visuals).toHaveLength(2);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Threads recommended=false still allows slot 0 usage", () => {
    const bundle = daoBundle({
      threads: channel({
        channel: "threads",
        body: "본문 있음",
        mediaPlan: {
          recommended: false,
          assetFamily: "social_static",
          imageCount: 0,
          visuals: [],
        },
      }),
    });
    expect(allowedThreadsSlotMax(bundle)).toBe(0);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "reuse cover on threads despite recommended=false",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card-01" },
            ],
          },
        ],
      },
    });
    expect(plan.visuals[0]!.usages.some((u) => u.channel === "threads")).toBe(true);
  });

  it("deterministic dedupe ignores reusableCrossChannel hard gate", () => {
    const sharedIntent =
      "익숙한 휴양지와 다른 북부 산악지역 establishing visual — north Vietnam mountain context";
    const a: SocialVisualRequest = {
      sourceChannel: "instagram",
      role: "cover",
      visualIntent: sharedIntent,
      visualMode: "editorial_photo",
      generatedVisualNeeded: true,
      reusableCrossChannel: false,
      usage: { channel: "instagram", cardId: "card-01" },
      orderKey: 0,
    };
    const b: SocialVisualRequest = {
      sourceChannel: "threads",
      role: "cover_context",
      visualIntent: sharedIntent,
      generatedVisualNeeded: true,
      reusableCrossChannel: false,
      usage: { channel: "threads", slotIndex: 0 },
      orderKey: 0,
    };
    expect(canMergeVisualRequests(a, b)).toBe(true);
  });

  it("Dao regression: imageCount=1 + IG generated=false → 2-master plan", () => {
    const bundle = daoBundle();
    expect(bundle.threads.mediaPlan?.imageCount).toBe(1);
    expect(
      bundle.instagram?.instagramMeta?.cardPlan?.[0]?.visual?.generatedVisualNeeded,
    ).toBe(false);
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      forbiddenClaimsKo: approvedAsset.forbiddenClaimsKo,
      llmRaw: {
        strategySummary:
          "Worker hints do not constrain: shared cover + architecture detail",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: CONCRETE,
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
              "북부 국경 흙다짐·로컬 건축 디테일. 특정 마을 단정·간판 식별 금지.",
            usages: [{ channel: "instagram", cardId: "card-02" }],
          },
        ],
      },
    });
    expect(plan.visuals).toHaveLength(2);
    expect(plan.visuals[0]!.generatedVisualNeeded).toBe(true);
    expect(plan.visuals[0]!.usages.some((u) => u.channel === "threads")).toBe(true);
  });
});
