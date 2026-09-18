/**
 * Instagram presence for Shared Visual Planner — snapshot + input + wipe regression.
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { generateChannelAsset } from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import {
  buildSourceChannelSnapshot,
  isChannelPresentForVisualPlanning,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";
import { buildSharedVisualPlannerInput } from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import { materializeSharedVisualPlanFromLlm } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
} from "@/lib/marketing/canonicalAsset/contracts";
import { approveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";

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
    sourceCandidateId: "cmc_presence",
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

function baseBundle(overrides: Partial<PublishableContentBundle> = {}): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_presence",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev1",
    targetChannels: ["threads", "shortform", "instagram"],
    sourceAssetId: "asset_p",
    sourceAssetVersion: 1,
    threads: channel({ channel: "threads", body: "Threads 본문" }),
    shortform: channel({
      channel: "shortform",
      format: "short_video_narration",
      body: "나레이션",
    }),
    ...overrides,
  };
}

const approvedAsset = {
  assetId: "asset_p",
  version: 1,
  approvedVersion: 1,
  titleKo: "제목",
  bodyKo: "본문",
  forbiddenClaimsKo: [],
  limitationsKo: [],
  supportedClaimBoundaryKo: "범위",
  storySupportVerdict: "SUPPORTED",
  editorialArchetype: "discovery",
} as unknown as CanonicalMarketingAsset;

describe("Instagram presence for Shared Visual Planner", () => {
  it("A. body + cardPlan → present=true", () => {
    const ig = channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "캡션",
      status: "needs_review" as PublishableChannelContent["status"],
      instagramMeta: {
        hook: "h",
        hashtags: [],
        slideHeadlines: ["a"],
        cta: null,
        altText: null,
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "H",
            body: "B",
            visualIntent: "cover",
            visual: {
              visualId: "social_visual_01",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              reusableOnThreads: true,
              visualIntent: "cover",
            },
          },
        ],
      },
    });
    expect(isChannelPresentForVisualPlanning(ig)).toBe(true);
    const snap = buildSourceChannelSnapshot(baseBundle({ instagram: ig }));
    expect(snap.channels.instagram?.present).toBe(true);
  });

  it("B. cardPlan without visual hints → still present=true", () => {
    const ig = channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "캡션만",
      instagramMeta: {
        hook: "h",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "건축 디테일",
            body: "nhà trình tường",
            visualIntent: "architecture",
            // no visual object
          },
        ],
      },
    });
    expect(isChannelPresentForVisualPlanning(ig)).toBe(true);
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: baseBundle({ instagram: ig }),
    });
    expect(input.sourceChannelSnapshot.channels.instagram?.present).toBe(true);
    expect(input.channels.instagram).toBeTruthy();
    const cards = (input.channels.instagram as { content: { cards: unknown[] } }).content.cards;
    expect(cards).toHaveLength(1);
  });

  it("C. needs_review with body → present=true", () => {
    const ig = channel({
      channel: "instagram",
      format: "instagram_caption",
      status: "needs_review" as PublishableChannelContent["status"],
      body: "리뷰 대기 캡션",
      instagramMeta: {
        hook: "h",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: [],
      },
    });
    expect(isChannelPresentForVisualPlanning(ig)).toBe(true);
  });

  it("D. Planner input serializes Instagram cards when present", () => {
    const ig = channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "캡션",
      instagramMeta: {
        hook: "h",
        hashtags: [],
        slideHeadlines: ["1", "2"],
        cta: null,
        altText: null,
        cardPlan: [
          {
            cardId: "card-01",
            role: "cover",
            headline: "Cover",
            body: "바디",
            visualIntent: "establishing",
          },
          {
            cardId: "card-02",
            role: "information",
            headline: "Detail",
            body: "건축",
            visualIntent: "detail",
          },
        ],
      },
    });
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: baseBundle({
        threads: channel({
          channel: "threads",
          body: "Threads",
          mediaPlan: {
            recommended: true,
            assetFamily: "social_static",
            imageCount: 1,
            visuals: [
              {
                visualId: "social_visual_01",
                role: "cover",
                visualIntent: "hint",
                reusableOnInstagram: false,
              },
            ],
          },
        }),
        instagram: ig,
      }),
    });
    expect(Object.keys(input.channels)).toEqual(expect.arrayContaining(["threads", "instagram"]));
    expect(input.sourceChannelSnapshot.channels.instagram?.present).toBe(true);
    expect(input.sourceChannelSnapshot.channels.instagram?.present).not.toBe(false);
  });

  it("E. Planner IG usage kept when card exists", () => {
    const bundle = baseBundle({
      instagram: channel({
        channel: "instagram",
        format: "instagram_caption",
        body: "캡션",
        instagramMeta: {
          hook: "h",
          hashtags: [],
          slideHeadlines: [],
          cta: null,
          altText: null,
          cardPlan: [
            {
              cardId: "card-01",
              role: "cover",
              headline: "H",
              body: "B",
              visualIntent: "cover",
            },
          ],
        },
      }),
    });
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "shared cover",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent:
              "북부 산악 establishing travel-editorial visual with calm light. Avoid readable village signs.",
            usages: [
              { channel: "threads", slotIndex: 0 },
              { channel: "instagram", cardId: "card-01" },
            ],
          },
        ],
      },
    });
    expect(plan.visuals[0]!.usages).toEqual([
      { channel: "threads", slotIndex: 0 },
      { channel: "instagram", cardId: "card-01" },
    ]);
  });

  it("F. invalid cardId dropped only — presence stays true", () => {
    const bundle = baseBundle({
      instagram: channel({
        channel: "instagram",
        format: "instagram_caption",
        body: "캡션",
        instagramMeta: {
          hook: "h",
          hashtags: [],
          slideHeadlines: [],
          cta: null,
          altText: null,
          cardPlan: [
            {
              cardId: "card-01",
              role: "cover",
              headline: "H",
              body: "B",
              visualIntent: "c",
            },
          ],
        },
      }),
    });
    expect(buildSourceChannelSnapshot(bundle).channels.instagram?.present).toBe(true);
    expect(() =>
      materializeSharedVisualPlanFromLlm({
        bundle,
        llmRaw: {
          strategySummary: "bad",
          visuals: [
            {
              role: "cover",
              generatedVisualNeeded: true,
              visualIntent:
                "concrete enough intent text for validation gate minimum length here",
              usages: [{ channel: "instagram", cardId: "card-99" }],
            },
          ],
        },
      }),
    ).toThrow(/no valid visuals/);
    expect(buildSourceChannelSnapshot(bundle).channels.instagram?.present).toBe(true);
  });

  it("G. Dao-like: Threads+Instagram both present in snapshot and planner input", () => {
    const bundle = baseBundle({
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
              reusableOnInstagram: false,
            },
          ],
        },
      }),
      instagram: channel({
        channel: "instagram",
        format: "instagram_caption",
        body: "인스타 캡션 — 북부 산악",
        instagramMeta: {
          hook: "북부",
          hashtags: [],
          slideHeadlines: ["1"],
          cta: null,
          altText: null,
          cardPlan: [
            {
              cardId: "card-01",
              role: "cover",
              headline: "북부",
              body: "산악",
              visualIntent: "cover",
            },
          ],
        },
      }),
    });
    const snap = buildSourceChannelSnapshot(bundle);
    expect(snap.channels.threads?.present).toBe(true);
    expect(snap.channels.instagram?.present).toBe(true);
    const input = buildSharedVisualPlannerInput({ approvedAsset, bundle });
    expect(input.channels.instagram).toBeDefined();
    expect(
      (input.channels.instagram as { content: { cards: unknown[] } }).content.cards.length,
    ).toBeGreaterThan(0);
  });

  it("H. absent key → present=false (honest when content missing from package)", () => {
    const bundle = baseBundle();
    delete (bundle as { instagram?: unknown }).instagram;
    const snap = buildSourceChannelSnapshot(bundle);
    expect(snap.channels.instagram?.present).toBe(false);
    const input = buildSharedVisualPlannerInput({ approvedAsset, bundle });
    expect(input.channels.instagram).toBeUndefined();
  });
});

describe("scoped regenerate must not wipe Instagram", () => {
  it("Threads regenerate with contentPlan omitting Instagram keeps IG on disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-wipe-"));
    try {
      const packageRoot = join(dir, "2026", "09", "18", "cmc_wipe");
      mkdirSync(join(packageRoot, "context"), { recursive: true });
      const draft = {
        contract: CANONICAL_MARKETING_ASSET_CONTRACT,
        assetId: "cma_wipe",
        version: 1,
        status: "draft" as const,
        agendaId: "ag",
        storyPointId: "sp",
        storyPointHash: "h",
        evidenceBriefRef: "ebr",
        evidenceRevision: "er",
        contentPropositionRef: "content-proposition-v1",
        propositionRevision: "pr",
        sourceRevision: "src_wipe",
        titleKo: "제목",
        dekKo: null,
        openingHookKo: "훅",
        bodyKo: "본문 충분히 긴 캐노니컬 원문입니다. 건축과 문화 맥락.",
        keyTakeawaysKo: ["a"],
        decisionGuidanceKo: null,
        optionalCtaIntentKo: null,
        evidenceRefs: [],
        supportedClaimBoundaryKo: "범위",
        limitationsKo: [],
        forbiddenClaimsKo: [],
        unresolvedQuestionsKo: [],
        storySupportVerdict: "SUPPORTED" as const,
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
      const approved = approveCanonicalMarketingAsset({
        asset: draft as CanonicalMarketingAsset,
        mode: "ai_original",
        approvedBy: "tester",
      });
      persistCanonicalAssetToPackage({ packageRoot, asset: approved });

      // Seed publishable with Threads + Instagram (Instagram NOT in targetChannels list
      // that subsequent Threads regenerate will resolve from contentPlan).
      const seeded: PublishableContentBundle = {
        contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
        candidateId: "cmc_wipe",
        businessDateKst: "2026-09-18",
        generatedAt: "2026-09-18T00:00:00.000Z",
        sourceRevision: "seed",
        targetChannels: ["threads", "shortform", "instagram"],
        sourceAssetId: approved.assetId,
        sourceAssetVersion: approved.approvedVersion,
        threads: channel({
          channel: "threads",
          body: "기존 스레드 본문입니다. 충분히 길게 작성합니다.",
          sourceCandidateId: "cmc_wipe",
        }),
        shortform: channel({
          channel: "shortform",
          format: "short_video_narration",
          body: "기존 쇼트폼",
          sourceCandidateId: "cmc_wipe",
        }),
        instagram: channel({
          channel: "instagram",
          format: "instagram_caption",
          body: "기존 인스타 캡션 — 북부 산악 대비",
          sourceCandidateId: "cmc_wipe",
          instagramMeta: {
            hook: "북부",
            hashtags: ["#여행"],
            slideHeadlines: ["커버"],
            cta: null,
            altText: null,
            cardPlan: [
              {
                cardId: "card-01",
                role: "cover",
                headline: "북부 국경",
                body: "또 다른 베트남",
                visualIntent: "establishing",
              },
            ],
          },
        }),
      };
      writeFileSync(
        join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH),
        JSON.stringify(seeded, null, 2),
        "utf8",
      );

      const candidate = {
        candidateId: "cmc_wipe",
        businessDateKst: "2026-09-18",
        draft: { body: "d", title: null },
        contentAssignment: { commercialIntent: "informational", facts: [] },
        // Intentionally omits Instagram — historically caused wipe on Threads regen.
        contentPlan: {
          proposition: {
            contract: "content-proposition-v1",
            primaryAudience: "a",
            audienceProblem: "p",
            audienceTension: "t",
            whyNow: null,
            contentPromise: "c",
            readerGain: "r",
            specificTakeaways: ["x"],
            proofRequirements: [],
            contentGapUsed: "",
            engagementMechanism: "experience_sharing_prompt",
            desiredAudienceAction: "comment",
            angle: "discovery",
            keyMessage: "k",
            commercialIntent: "informational",
            propositionStrength: "strong",
            limitations: [],
          },
          targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"],
        },
        governanceDecision: { decision: "ALLOW" },
        canonicalMarketingAsset: approved,
      } as unknown as CompletedMarketingCandidate;

      await generateChannelAsset({
        candidate,
        packageRoot,
        channel: "threads",
        invoke: async () =>
          JSON.stringify({
            title: null,
            body: "재생된 스레드 본문입니다. 해변과 북부 국경을 대비해 말합니다. 충분히 긴 본문.",
            mediaPlan: {
              recommended: true,
              assetFamily: "social_static",
              imageCount: 1,
              visuals: [
                {
                  visualId: "social_visual_01",
                  role: "cover_context",
                  visualIntent: "establishing",
                  reusableOnInstagram: false,
                },
              ],
            },
          }),
        approvedCanonicalAsset: approved,
      });

      const disk = JSON.parse(
        readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
      ) as PublishableContentBundle;
      expect(disk.instagram).toBeTruthy();
      expect(disk.instagram?.body).toContain("인스타 캡션");
      expect(disk.instagram?.instagramMeta?.cardPlan?.[0]?.cardId).toBe("card-01");
      expect(disk.targetChannels).toEqual(expect.arrayContaining(["instagram"]));

      const snap = buildSourceChannelSnapshot(disk);
      expect(snap.channels.instagram?.present).toBe(true);
      const plannerIn = buildSharedVisualPlannerInput({
        approvedAsset: approved,
        bundle: disk,
      });
      expect(plannerIn.channels.instagram).toBeDefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
