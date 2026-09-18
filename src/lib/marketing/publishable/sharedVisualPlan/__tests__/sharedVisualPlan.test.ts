/**
 * Shared Visual Planner v1 — focused contract/dedupe/persist tests.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
  type PublishableChannelContent,
} from "@/lib/marketing/publishable/contracts";
import {
  buildSharedVisualPlan,
  canMergeVisualRequests,
  collectSocialVisualRequests,
  computeVisualPlanFingerprint,
  isSharedVisualPlanStale,
  persistSharedVisualPlan,
  readSharedVisualPlan,
  SHARED_VISUAL_PLAN_CONTRACT,
  SHARED_VISUAL_PLAN_RELATIVE_PATH,
  type SocialVisualRequest,
} from "@/lib/marketing/publishable/sharedVisualPlan";

function channelBase(
  channel: PublishableChannelContent["channel"],
  format: PublishableChannelContent["format"],
  body: string,
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format,
    title: null,
    body,
    status: "generated",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceCandidateId: "cand_svp",
    sourceRevision: "rev_1",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: "informational",
      generationMode: "llm",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    sourceAssetId: "asset_svp",
    sourceAssetVersion: 3,
  };
}

function bundle(overrides: {
  threadsMediaPlan?: PublishableChannelContent["mediaPlan"];
  instagramCardPlan?: NonNullable<
    NonNullable<PublishableChannelContent["instagramMeta"]>["cardPlan"]
  >;
  threadsBody?: string;
  instagramBody?: string;
}): PublishableContentBundle {
  const threads = channelBase("threads", "threads_text", overrides.threadsBody ?? "Threads body.");
  threads.mediaPlan = overrides.threadsMediaPlan ?? null;
  const instagram = channelBase(
    "instagram",
    "instagram_caption",
    overrides.instagramBody ?? "Instagram caption body with enough length.",
  );
  if (overrides.instagramCardPlan) {
    instagram.instagramMeta = {
      hook: "hook",
      hashtags: ["#a", "#b", "#c"],
      slideHeadlines: overrides.instagramCardPlan.map((c) => c.headline),
      cta: null,
      altText: null,
      aspectRatio: "4:5",
      cardPlan: overrides.instagramCardPlan,
    };
  }
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cand_svp",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev_1",
    targetChannels: ["threads", "instagram"],
    threads,
    shortform: channelBase("shortform", "short_video_narration", "Shortform narration."),
    instagram,
    sourceAssetId: "asset_svp",
    sourceAssetVersion: 3,
  };
}

describe("Shared Visual Planner v1", () => {
  it("A. Threads only → 2 master visuals, deterministic IDs", () => {
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 2,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "북부 산악지역 establishing atmosphere",
            reusableOnInstagram: true,
          },
          {
            visualId: "social_visual_02",
            role: "cultural_detail",
            visualIntent: "Dao족 생활문화 detail",
            reusableOnInstagram: false,
          },
        ],
      },
    });
    // no IG cardPlan
    delete b.instagram;
    const plan = buildSharedVisualPlan({ bundle: b, now: new Date("2026-09-18T12:00:00.000Z") });
    expect(plan.visuals).toHaveLength(2);
    expect(plan.visuals[0]?.visualId).toBe("social_visual_01");
    expect(plan.visuals[1]?.visualId).toBe("social_visual_02");
    expect(plan.visuals[0]?.usages).toEqual([{ channel: "threads", slotIndex: 0 }]);
    expect(plan.visuals[1]?.usages).toEqual([{ channel: "threads", slotIndex: 1 }]);
    expect(plan.visuals.every((v) => v.generatedVisualNeeded)).toBe(true);
  });

  it("B. Instagram only → usages include cardId", () => {
    const b = bundle({
      threadsMediaPlan: { recommended: false, assetFamily: "social_static", imageCount: 0, visuals: [] },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: "establishing",
          visual: {
            visualId: "social_visual_01",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: true,
            visualIntent: "북부 산악 establishing photo",
          },
        },
        {
          cardId: "card-02",
          role: "information",
          headline: "Detail",
          body: "",
          visualIntent: "detail",
          visual: {
            visualId: "social_visual_02",
            visualMode: "object_or_detail",
            generatedVisualNeeded: true,
            reusableOnThreads: false,
            visualIntent: "nhà trình tường architecture detail",
          },
        },
      ],
    });
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals).toHaveLength(2);
    expect(plan.visuals[0]?.usages).toEqual([{ channel: "instagram", cardId: "card-01" }]);
    expect(plan.visuals[1]?.usages).toEqual([{ channel: "instagram", cardId: "card-02" }]);
  });

  it("C. Same worker numeric ID, different semantics → 2 masters", () => {
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "북부 베트남 산악지역 region establishing visual",
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "information",
          headline: "Architecture",
          body: "",
          visualIntent: "architecture",
          visual: {
            visualId: "social_visual_01",
            visualMode: "object_or_detail",
            generatedVisualNeeded: true,
            reusableOnThreads: true,
            visualIntent: "Dao족 nhà trình tường architecture close-up detail",
          },
        },
      ],
    });
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals).toHaveLength(2);
  });

  it("D. Different source IDs, same semantics + reuse → merge to 1", () => {
    const sharedIntent =
      "익숙한 휴양지와 다른 북부 산악지역 establishing visual — north Vietnam mountain context";
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: sharedIntent,
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: sharedIntent,
          visual: {
            visualId: "social_visual_02",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: true,
            visualIntent: sharedIntent,
          },
        },
      ],
    });
    const reqs = collectSocialVisualRequests(b);
    expect(canMergeVisualRequests(reqs[0]!, reqs[1]!)).toBe(true);
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]?.visualId).toBe("social_visual_01");
    expect(plan.visuals[0]?.usages).toEqual([
      { channel: "instagram", cardId: "card-01" },
      { channel: "threads", slotIndex: 0 },
    ]);
  });

  it("E. Same semantics with reuse flags false → still merge (flags advisory)", () => {
    const sharedIntent =
      "익숙한 휴양지와 다른 북부 산악지역 establishing visual — north Vietnam mountain context";
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: sharedIntent,
            reusableOnInstagram: false,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: sharedIntent,
          visual: {
            visualId: "social_visual_02",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: false,
            visualIntent: sharedIntent,
          },
        },
      ],
    });
    const plan = buildSharedVisualPlan({ bundle: b });
    // reusableOn* no longer blocks semantic merge in deterministic fallback.
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]?.usages).toEqual([
      { channel: "instagram", cardId: "card-01" },
      { channel: "threads", slotIndex: 0 },
    ]);
  });

  it("F. Visual mode incompatible → remain separate", () => {
    const intent = "베트남 북부 여행 정보 visual about northern Vietnam travel";
    const a: SocialVisualRequest = {
      sourceChannel: "instagram",
      sourceVisualId: "social_visual_01",
      role: "information",
      visualIntent: intent,
      visualMode: "editorial_photo",
      generatedVisualNeeded: true,
      reusableCrossChannel: true,
      usage: { channel: "instagram", cardId: "card-01" },
      orderKey: 0,
    };
    const bReq: SocialVisualRequest = {
      sourceChannel: "threads",
      sourceVisualId: "social_visual_01",
      role: "cover_context",
      visualIntent: intent,
      visualMode: "fact_card",
      generatedVisualNeeded: false,
      reusableCrossChannel: true,
      usage: { channel: "threads", slotIndex: 0 },
      orderKey: 0,
    };
    expect(canMergeVisualRequests(a, bReq)).toBe(false);
  });

  it("G. generatedVisualNeeded conflict on merge → master true", () => {
    const sharedIntent =
      "익숙한 휴양지와 다른 북부 산악지역 establishing visual — north Vietnam mountain context";
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_09",
            role: "cover_context",
            visualIntent: sharedIntent,
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: sharedIntent,
          visual: {
            visualId: "social_visual_03",
            visualMode: "editorial_photo",
            generatedVisualNeeded: false,
            reusableOnThreads: true,
            visualIntent: sharedIntent,
          },
        },
      ],
    });
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]?.generatedVisualNeeded).toBe(true);
  });

  it("H. Threads recommended=false with visuals → still collect as advisory hints", () => {
    const b = bundle({
      threadsMediaPlan: {
        recommended: false,
        assetFamily: "social_static",
        imageCount: 2,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "북부 산악 establishing advisory hint from threads worker",
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: "ig only",
          visual: {
            visualId: "social_visual_01",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: true,
            visualIntent: "ig only establishing northern mountain border context photo",
          },
        },
      ],
    });
    const reqs = collectSocialVisualRequests(b);
    expect(reqs.some((r) => r.sourceChannel === "threads")).toBe(true);
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals.length).toBeGreaterThanOrEqual(1);
    expect(
      plan.visuals.some((v) => v.usages.some((u) => u.channel === "threads")),
    ).toBe(true);
  });

  it("I. Instagram missing visual → no request for that card", () => {
    const b = bundle({
      threadsMediaPlan: { recommended: false, assetFamily: "social_static", imageCount: 0, visuals: [] },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: "no visual object",
        },
        {
          cardId: "card-02",
          role: "information",
          headline: "Info",
          body: "",
          visualIntent: "has visual",
          visual: {
            visualId: "social_visual_01",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: false,
            visualIntent: "Dao cultural detail photo",
          },
        },
      ],
    });
    const plan = buildSharedVisualPlan({ bundle: b });
    expect(plan.visuals).toHaveLength(1);
    expect(plan.visuals[0]?.usages[0]).toEqual({ channel: "instagram", cardId: "card-02" });
  });

  it("J. Determinism — same bundle twice → identical plan IDs/order/fingerprint", () => {
    const b = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_07",
            role: "cultural_detail",
            visualIntent: "Dao족 생활문화",
            reusableOnInstagram: false,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: "cover",
          visual: {
            visualId: "social_visual_01",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: false,
            visualIntent: "북부 산악 establishing",
          },
        },
      ],
    });
    const a = buildSharedVisualPlan({ bundle: b, now: new Date("2026-09-18T01:00:00.000Z") });
    const c = buildSharedVisualPlan({ bundle: b, now: new Date("2026-09-18T02:00:00.000Z") });
    expect(a.sourceVisualPlanFingerprint).toBe(c.sourceVisualPlanFingerprint);
    expect(a.visuals.map((v) => v.visualId)).toEqual(c.visuals.map((v) => v.visualId));
    expect(a.visuals.map((v) => v.usages)).toEqual(c.visuals.map((v) => v.usages));
  });

  it("K. Fingerprint stale — visual change flips; body-only does not", () => {
    const base = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "북부 산악 establishing",
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: [
        {
          cardId: "card-01",
          role: "cover",
          headline: "Cover",
          body: "",
          visualIntent: "cover",
          visual: {
            visualId: "social_visual_01",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            reusableOnThreads: true,
            visualIntent: "북부 산악 establishing",
          },
        },
      ],
    });
    const fp1 = computeVisualPlanFingerprint(base);
    const bodyOnly = bundle({
      threadsMediaPlan: base.threads.mediaPlan,
      instagramCardPlan: base.instagram!.instagramMeta!.cardPlan,
      threadsBody: "Completely different Threads copy without touching mediaPlan.",
      instagramBody: "Completely different Instagram caption without touching cardPlan.",
    });
    expect(computeVisualPlanFingerprint(bodyOnly)).toBe(fp1);

    const visualChanged = bundle({
      threadsMediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover_context",
            visualIntent: "CHANGED — coastal resort establishing instead",
            reusableOnInstagram: true,
          },
        ],
      },
      instagramCardPlan: base.instagram!.instagramMeta!.cardPlan,
    });
    expect(computeVisualPlanFingerprint(visualChanged)).not.toBe(fp1);

    const plan = buildSharedVisualPlan({ bundle: base });
    expect(isSharedVisualPlanStale({ planFingerprint: plan.sourceVisualPlanFingerprint, bundle: base })).toBe(
      false,
    );
    expect(
      isSharedVisualPlanStale({
        planFingerprint: plan.sourceVisualPlanFingerprint,
        bundle: visualChanged,
      }),
    ).toBe(true);
  });

  it("persists to context/shared-visual-plan.json with provenance", () => {
    const dir = mkdtempSync(join(tmpdir(), "svp-persist-"));
    try {
      const b = bundle({
        threadsMediaPlan: {
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
      });
      delete b.instagram;
      const plan = buildSharedVisualPlan({ bundle: b, now: new Date("2026-09-18T12:00:00.000Z") });
      persistSharedVisualPlan({ packageRoot: dir, plan });
      const disk = JSON.parse(readFileSync(join(dir, SHARED_VISUAL_PLAN_RELATIVE_PATH), "utf8"));
      expect(disk.contract).toBe(SHARED_VISUAL_PLAN_CONTRACT);
      expect(disk.sourceAssetId).toBe("asset_svp");
      expect(disk.sourceAssetVersion).toBe(3);
      const roundTrip = readSharedVisualPlan(dir);
      expect(roundTrip?.visuals[0]?.visualId).toBe("social_visual_01");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
