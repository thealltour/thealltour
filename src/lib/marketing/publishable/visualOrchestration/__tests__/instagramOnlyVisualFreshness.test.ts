/**
 * Shared Visual Plan v2 freshness: only the Instagram card structure counts; legacy all-channel
 * snapshots read as stale; visuals require an Instagram card copy to exist.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { resolveInstagramCardCopyApprovalBlock } from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import { buildSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import {
  SOURCE_CHANNEL_SNAPSHOT_VERSION,
  buildSourceChannelSnapshot,
  isLegacySourceChannelSnapshot,
  parseSourceChannelSnapshot,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";
import {
  isLegacySharedVisualPlan,
  resolveSharedVisualPlanLifecycle,
} from "@/lib/marketing/publishable/visualOrchestration/lifecycle";

function slot(
  overrides: Partial<PublishableChannelContent> & { channel: PublishableChannelContent["channel"] },
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    format: "threads_text",
    title: null,
    body: "본문",
    status: "generated",
    generatedAt: "2026-09-29T00:00:00.000Z",
    sourceCandidateId: "cand_1",
    sourceRevision: "rev_1",
    provenance: { composer: "llm", evidenceRefIds: [], commercialIntent: null, generationMode: "llm" },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    mediaPlan: null,
    ...overrides,
  };
}

function bundle(overrides: Partial<PublishableContentBundle> = {}): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cand_1",
    businessDateKst: "2026-09-29",
    generatedAt: "2026-09-29T00:00:00.000Z",
    sourceRevision: "bundle_rev_1",
    targetChannels: ["threads", "instagram"],
    threads: slot({ channel: "threads", body: "스레드 본문" }),
    shortform: slot({ channel: "shortform", format: "short_video_narration", status: "not_generated", body: "" }),
    instagram: slot({
      channel: "instagram",
      format: "instagram_caption",
      body: "인스타 캡션",
      instagramMeta: {
        hook: "훅",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: [
          { cardId: "c1", role: "cover", headline: "표지", body: "", visualIntent: "도심 establishing" },
          { cardId: "c2", role: "evidence", headline: "근거", body: "역 도보권", visualIntent: "역 출구 동선" },
        ],
      },
    }),
    ...overrides,
  };
}

describe("Shared Visual Plan v2 snapshot (Instagram only)", () => {
  it("records only Instagram with version 2", () => {
    const snap = buildSourceChannelSnapshot(bundle());
    expect(snap.version).toBe(SOURCE_CHANNEL_SNAPSHOT_VERSION);
    expect(Object.keys(snap.channels)).toEqual(["instagram"]);
    expect(snap.channels.instagram).toMatchObject({ present: true, generatedAt: null, status: null });
    expect(isLegacySourceChannelSnapshot(snap)).toBe(false);
  });

  it("stays fresh for caption, generatedAt, card text, and other-channel changes", () => {
    const b1 = bundle();
    const plan = buildSharedVisualPlan({ bundle: b1 });
    const ig = b1.instagram!;
    const cards = ig.instagramMeta!.cardPlan!;
    const variants: PublishableContentBundle[] = [
      bundle({ threads: slot({ channel: "threads", body: "다시 생성한 스레드" }) }),
      bundle({ instagram: { ...ig, body: "고친 캡션", generatedAt: "2026-09-30T00:00:00.000Z" } }),
      bundle({
        instagram: {
          ...ig,
          instagramMeta: { ...ig.instagramMeta!, cardPlan: [{ ...cards[0]!, headline: "고친 표지" }, cards[1]!] },
        },
      }),
    ];
    for (const next of variants) {
      expect(resolveSharedVisualPlanLifecycle({ plan, bundle: next })).toBe("fresh");
    }
  });

  it("goes stale when the Instagram card structure changes", () => {
    const b1 = bundle();
    const plan = buildSharedVisualPlan({ bundle: b1 });
    const ig = b1.instagram!;
    const cards = ig.instagramMeta!.cardPlan!;
    const added = bundle({
      instagram: {
        ...ig,
        instagramMeta: {
          ...ig.instagramMeta!,
          cardPlan: [...cards, { cardId: "c3", role: "cta", headline: "정리", body: "", visualIntent: "마감" }],
        },
      },
    });
    const roleChanged = bundle({
      instagram: {
        ...ig,
        instagramMeta: { ...ig.instagramMeta!, cardPlan: [cards[0]!, { ...cards[1]!, role: "information" }] },
      },
    });
    expect(resolveSharedVisualPlanLifecycle({ plan, bundle: added })).toBe("stale");
    expect(resolveSharedVisualPlanLifecycle({ plan, bundle: roleChanged })).toBe("stale");
  });

  it("reads plans built with a legacy all-channel snapshot as legacy and stale", () => {
    const b1 = bundle();
    const current = buildSharedVisualPlan({ bundle: b1 });
    const legacySnapshot = parseSourceChannelSnapshot({
      bundleSourceRevision: "bundle_rev_1",
      channels: {
        threads: { present: true, revision: "rev_1", fingerprint: "a", generatedAt: null, status: "generated" },
        instagram: { present: true, revision: "rev_1", fingerprint: "b", generatedAt: null, status: "generated" },
      },
    })!;
    expect(legacySnapshot.version).toBeUndefined();
    expect(isLegacySourceChannelSnapshot(legacySnapshot)).toBe(true);

    const legacyPlan = { ...current, sourceChannelSnapshot: legacySnapshot };
    expect(isLegacySharedVisualPlan(legacyPlan)).toBe(true);
    expect(isLegacySharedVisualPlan(current)).toBe(false);
    expect(resolveSharedVisualPlanLifecycle({ plan: legacyPlan, bundle: b1 })).toBe("stale");
  });
});

describe("resolveInstagramCardCopyApprovalBlock", () => {
  it("blocks visuals with instagram_card_copy_missing when the package has no card copy", () => {
    const dir = mkdtempSync(join(tmpdir(), "ig-card-copy-missing-"));
    try {
      expect(resolveInstagramCardCopyApprovalBlock(dir)).toMatchObject({ code: "instagram_card_copy_missing" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
