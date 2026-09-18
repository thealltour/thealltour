/**
 * Production orchestration: refreshDerivedVisualArtifacts after publishable persist.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  MANUAL_ASTRA_HANDOFF_RELATIVE_PATH,
  readManualAstraHandoff,
} from "@/lib/marketing/publishable/manualAstraHandoff";
import {
  SHARED_VISUAL_PLAN_RELATIVE_PATH,
  readSharedVisualPlan,
} from "@/lib/marketing/publishable/sharedVisualPlan";
import { refreshDerivedVisualArtifacts } from "@/lib/marketing/publishable/refreshDerivedVisualArtifacts";

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
    sourceCandidateId: "cmc_wire",
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

function bundle(overrides: Partial<PublishableContentBundle> = {}): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_wire",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev1",
    targetChannels: ["threads", "shortform"],
    sourceAssetId: "asset_wire",
    sourceAssetVersion: 2,
    threads: channel({ channel: "threads", format: "threads_text", mediaPlan: null }),
    shortform: channel({
      channel: "shortform",
      format: "short_video_narration",
      body: "나레이션",
      mediaPlan: undefined,
    }),
    ...overrides,
  };
}

const approvedAsset = {
  assetId: "asset_wire",
  version: 2,
  approvedVersion: 2,
  titleKo: "테스트 제목",
  supportedClaimBoundaryKo: "확인된 범위",
  limitationsKo: ["현장 미확인"],
  forbiddenClaimsKo: ["과장 금지"],
  storySupportVerdict: "SUPPORTED_WITH_LIMITS",
  editorialArchetype: "discovery",
} as unknown as CanonicalMarketingAsset;

describe("refreshDerivedVisualArtifacts orchestration", () => {
  it("A. Threads-only visual plan → plan+handoff with 1 visual", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-a-"));
    try {
      const b = bundle({
        threads: channel({
          channel: "threads",
          mediaPlan: {
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
        }),
      });
      const result = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: b,
        approvedCanonicalAsset: approvedAsset,
        now: new Date("2026-09-18T12:00:00.000Z"),
      });
      expect(result.ok).toBe(true);
      expect(result.plan?.visuals).toHaveLength(1);
      expect(result.handoff?.visualCount).toBe(1);
      expect(existsSync(join(dir, SHARED_VISUAL_PLAN_RELATIVE_PATH))).toBe(true);
      expect(existsSync(join(dir, MANUAL_ASTRA_HANDOFF_RELATIVE_PATH))).toBe(true);
      expect(readSharedVisualPlan(dir)?.visuals).toHaveLength(1);
      expect(readManualAstraHandoff(dir)?.visualCount).toBe(1);
      expect(result.threadsMediaPlan).toBe("present");
      expect(result.instagramCardPlan).toBe("absent");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B. Instagram-only → plan/handoff generated", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-b-"));
    try {
      const b = bundle({
        targetChannels: ["threads", "shortform", "instagram"],
        threads: channel({ channel: "threads", mediaPlan: null }),
        instagram: channel({
          channel: "instagram",
          format: "instagram_caption",
          body: "캡션 본문입니다.",
          instagramMeta: {
            hook: "훅",
            hashtags: ["#a"],
            slideHeadlines: ["1", "2", "3", "4"],
            cta: null,
            altText: null,
            cardPlan: [
              {
                cardId: "card-01",
                role: "cover",
                headline: "커버",
                body: "커버 본문",
                visualIntent: "cover shot",
                visual: {
                  visualId: "social_visual_01",
                  visualMode: "editorial_photo",
                  generatedVisualNeeded: true,
                  reusableOnThreads: true,
                  visualIntent: "cover shot",
                },
              },
            ],
          },
        }),
      });
      const result = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: b,
        approvedCanonicalAsset: approvedAsset,
      });
      expect(result.ok).toBe(true);
      expect(result.plan?.visuals.length).toBeGreaterThanOrEqual(1);
      expect(result.handoff?.visualCount).toBeGreaterThanOrEqual(1);
      expect(result.instagramCardPlan).toBe("present");
      expect(result.threadsMediaPlan).toBe("null");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("C. both → plan persisted with usages", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-c-"));
    try {
      const b = bundle({
        targetChannels: ["threads", "instagram"],
        threads: channel({
          channel: "threads",
          mediaPlan: {
            recommended: true,
            assetFamily: "social_static",
            imageCount: 1,
            visuals: [
              {
                visualId: "social_visual_01",
                role: "cover_context",
                visualIntent: "shared cover atmosphere",
                reusableOnInstagram: true,
              },
            ],
          },
        }),
        instagram: channel({
          channel: "instagram",
          format: "instagram_caption",
          body: "캡션",
          instagramMeta: {
            hook: "훅",
            hashtags: ["#a"],
            slideHeadlines: ["1", "2", "3", "4"],
            cta: null,
            altText: null,
            cardPlan: [
              {
                cardId: "card-01",
                role: "cover",
                headline: "커버",
                body: "커버 본문",
                visualIntent: "shared cover atmosphere",
                visual: {
                  visualId: "social_visual_01",
                  visualMode: "editorial_photo",
                  generatedVisualNeeded: true,
                  reusableOnThreads: true,
                  visualIntent: "shared cover atmosphere",
                },
              },
            ],
          },
        }),
      });
      const result = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: b,
        approvedCanonicalAsset: approvedAsset,
      });
      expect(result.ok).toBe(true);
      expect(result.plan?.visuals.length).toBeGreaterThanOrEqual(1);
      const cover = result.plan?.visuals[0];
      expect(cover?.usages.some((u) => u.channel === "instagram")).toBe(true);
      expect(cover?.usages.some((u) => u.channel === "threads")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("D. no visuals → empty plan + zero-item handoff; old handoff replaced", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-d-"));
    try {
      const old = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({
            channel: "threads",
            mediaPlan: {
              recommended: true,
              assetFamily: "social_static",
              imageCount: 2,
              visuals: [
                {
                  visualId: "social_visual_01",
                  role: "cover",
                  visualIntent: "old A",
                  reusableOnInstagram: false,
                },
                {
                  visualId: "social_visual_02",
                  role: "detail",
                  visualIntent: "old B",
                  reusableOnInstagram: false,
                },
              ],
            },
          }),
        }),
        approvedCanonicalAsset: approvedAsset,
      });
      expect(old.handoff?.visualCount).toBe(2);

      const next = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({ channel: "threads", mediaPlan: null }),
        }),
        approvedCanonicalAsset: approvedAsset,
        now: new Date("2026-09-18T15:00:00.000Z"),
      });
      expect(next.ok).toBe(true);
      expect(next.plan?.visuals).toEqual([]);
      expect(next.handoff?.visualCount).toBe(0);
      expect(next.handoff?.copyText).toContain("현재 Astra에서 생성할 외부 비주얼이 없습니다");
      expect(readManualAstraHandoff(dir)?.visualCount).toBe(0);
      expect(readSharedVisualPlan(dir)?.visuals).toEqual([]);
      expect(next.warnings).toContain("threads_content_present_but_mediaPlan_null");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("E. regenerate intent change → fingerprint/handoff refresh", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-e-"));
    try {
      const first = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({
            channel: "threads",
            mediaPlan: {
              recommended: true,
              assetFamily: "social_static",
              imageCount: 1,
              visuals: [
                {
                  visualId: "social_visual_01",
                  role: "cover",
                  visualIntent: "intent A mountain ridge",
                  reusableOnInstagram: false,
                },
              ],
            },
          }),
        }),
        approvedCanonicalAsset: approvedAsset,
      });
      const second = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({
            channel: "threads",
            mediaPlan: {
              recommended: true,
              assetFamily: "social_static",
              imageCount: 1,
              visuals: [
                {
                  visualId: "social_visual_01",
                  role: "cover",
                  visualIntent: "intent B village courtyard",
                  reusableOnInstagram: false,
                },
              ],
            },
          }),
        }),
        approvedCanonicalAsset: approvedAsset,
      });
      expect(first.plan?.sourceVisualPlanFingerprint).not.toBe(
        second.plan?.sourceVisualPlanFingerprint,
      );
      expect(second.handoff?.visuals[0]?.visualIntent).toContain("intent B");
      expect(readManualAstraHandoff(dir)?.copyText).toContain("intent B");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("F. body-only change → fingerprint changes (channel snapshot includes body)", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-f-"));
    try {
      const mediaPlan = {
        recommended: true as const,
        assetFamily: "social_static" as const,
        imageCount: 1,
        visuals: [
          {
            visualId: "social_visual_01",
            role: "cover",
            visualIntent: "stable visual intent",
            reusableOnInstagram: false,
          },
        ],
      };
      const a = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({ channel: "threads", body: "본문 A", mediaPlan }),
        }),
        approvedCanonicalAsset: approvedAsset,
      });
      const b = refreshDerivedVisualArtifacts({
        packageRoot: dir,
        publishableBundle: bundle({
          threads: channel({ channel: "threads", body: "본문 B completely different", mediaPlan }),
        }),
        approvedCanonicalAsset: approvedAsset,
      });
      // Lifecycle redesign: body changes affect visual strategy → snapshot fingerprint differs.
      expect(a.plan?.sourceVisualPlanFingerprint).not.toBe(b.plan?.sourceVisualPlanFingerprint);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("G. visual refresh failure → returns error; channel json remains", () => {
    const dir = mkdtempSync(join(tmpdir(), "drv-g-"));
    try {
      mkdirSync(join(dir, "context"), { recursive: true });
      writeFileSync(join(dir, "context/publishable-content.json"), JSON.stringify(bundle()));
      // Force persist failure: packageRoot is a file, not a directory.
      const badRoot = join(dir, "not-a-package-root");
      writeFileSync(badRoot, "x");
      const result = refreshDerivedVisualArtifacts({
        packageRoot: badRoot,
        publishableBundle: bundle(),
        approvedCanonicalAsset: approvedAsset,
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(existsSync(join(dir, "context/publishable-content.json"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
