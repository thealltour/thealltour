import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createCardNewsVerificationBrief } from "@/lib/marketing/assets/cardnews/fixture";
import { renderInstagramCardnewsForPackage } from "@/lib/marketing/assets/cardnews/instagramCardnews";
import { resolveInstagramCardnewsRenderBrief } from "@/lib/marketing/assets/cardnews/instagramCards";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import {
  applyInstagramCardCopyReview,
  approveInstagramCardCopyReview,
  buildInstagramCardCopyReview,
  hasInstagramCardHumanEdits,
  InstagramCardCopyReviewError,
  resolveInstagramCoverTitleKo,
  overlayEffectiveInstagramCardCopyForPackage,
  overlayInstagramCardCopyOnBundle,
  persistInstagramCardCopyReview,
  resolveEffectiveInstagramCardCopy,
  resolveInstagramCardCopyReviewGate,
  resolveInstagramCardCopyReviewGateState,
  updateInstagramCardCopyReviewDrafts,
  type InstagramCardCopyReview,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import {
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
  type InstagramCardCopy,
  type InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  persistInstagramCardCopy,
  persistInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import { INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH } from "@/lib/marketing/publishable/instagramVisualRole/paths";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { resolveInstagramVisualRoleLifecycleForPackage } from "@/lib/marketing/publishable/visualOrchestration/packageLifecycle";
import {
  buildInstagramCardCopyReviewView,
  freshInstagramCardCopyReviewForReset,
  resolveMutableInstagramCardCopyReview,
} from "@/lib/marketing/review/instagramCardCopyReview";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

const T0 = "2026-09-27T00:00:00.000Z";
const T1 = "2026-09-27T01:00:00.000Z";
const CANDIDATE_ID = "cand_card_review";
const CARD_IDS = ["c1", "c2", "c3", "c4"] as const;

const provenance = (upstream: string) => ({
  sourceAssetId: "cma_1",
  sourceVersion: 2,
  modelProfile: "test",
  generatedAt: T0,
  sourceUpstreamFingerprint: upstream,
});

function carousel(): InstagramCarouselPlan {
  return {
    contract: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    assetId: "cma_1",
    assetVersion: 2,
    cards: [
      { cardId: "c1", role: "hook_cover", beatIds: ["b1"], communicationGoal: "표지", visualPriority: "strong" },
      { cardId: "c2", role: "context", beatIds: ["b1"], communicationGoal: "맥락", visualPriority: "useful" },
      { cardId: "c3", role: "evidence_detail", beatIds: ["b2"], communicationGoal: "근거", visualPriority: "hero" },
      { cardId: "c4", role: "closing", beatIds: ["b2"], communicationGoal: "마무리", visualPriority: "none" },
    ],
    sourceNarrativeFingerprint: "narr_fp",
    provenance: provenance("narr_fp"),
  } as InstagramCarouselPlan;
}

function cardCopy(overrides: Partial<Record<(typeof CARD_IDS)[number], string>> = {}): InstagramCardCopy {
  return {
    contract: INSTAGRAM_CARD_COPY_CONTRACT,
    assetId: "cma_1",
    assetVersion: 2,
    cards: CARD_IDS.map((cardId, i) => ({
      cardId,
      kicker: `키커${i + 1}`,
      headline: overrides[cardId] ?? `AI 헤드라인 ${i + 1}`,
      body: `AI 본문 ${i + 1}`,
      microcopy: i === 3 ? "저장해 두세요" : undefined,
      evidenceRefs: i === 2 ? ["ev-7"] : [],
    })),
    sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel()),
    provenance: provenance("carousel_fp"),
  } as InstagramCardCopy;
}

function freshReview(base = cardCopy()): InstagramCardCopyReview {
  return buildInstagramCardCopyReview({
    candidateId: CANDIDATE_ID,
    cardCopy: base,
    carousel: carousel(),
    source: { kind: "external_editorial", candidateRef: "context/xe.json" },
    updatedBy: "ysh",
    nowIso: T0,
  });
}

function edit(review: InstagramCardCopyReview, base: InstagramCardCopy, headline = "사람이 고친 근거") {
  return updateInstagramCardCopyReviewDrafts({
    review,
    base,
    edits: [{ cardId: "c3", kicker: "키커3", headline, body: "사람 본문", microcopy: null }],
    updatedBy: "ysh",
    nowIso: T1,
  });
}

describe("Instagram card copy review — effective copy", () => {
  it("keeps the generated copy untouched and overlays only human text", () => {
    const base = cardCopy();
    const snapshot = JSON.stringify(base);
    const review = edit(freshReview(base), base);
    const effective = applyInstagramCardCopyReview(base, review);

    expect(JSON.stringify(base)).toBe(snapshot);
    expect(effective.cards.map((c) => c.cardId)).toEqual([...CARD_IDS]);
    expect(effective.cards[2]).toMatchObject({ headline: "사람이 고친 근거", body: "사람 본문", evidenceRefs: ["ev-7"] });
    expect(effective.cards[0]).toEqual(base.cards[0]);
    expect(review.cards[2]!.aiDraft.headline).toBe("AI 헤드라인 3");
    expect(review.cards[2]!.role).toBe("evidence_detail");
    expect(buildInstagramCardCopyContentFingerprint(effective)).not.toBe(
      buildInstagramCardCopyContentFingerprint(base),
    );
  });

  it("returns the generated copy when there are no edits or the review is for another base", () => {
    const base = cardCopy();
    expect(applyInstagramCardCopyReview(base, freshReview(base))).toBe(base);
    const regenerated = cardCopy({ c1: "재생성된 표지" });
    expect(applyInstagramCardCopyReview(regenerated, edit(freshReview(base), base))).toBe(regenerated);
  });

  it("stores no humanDraft when the edit equals the AI draft", () => {
    const base = cardCopy();
    const review = updateInstagramCardCopyReviewDrafts({
      review: freshReview(base),
      base,
      edits: [{ cardId: "c1", kicker: " 키커1 ", headline: "AI 헤드라인 1", body: "AI 본문 1" }],
      updatedBy: "ysh",
      nowIso: T1,
    });
    expect(review.cards[0]!.humanDraft).toBeNull();
  });

  it("rejects structural or invalid edits", () => {
    const base = cardCopy();
    const run = (edits: Parameters<typeof updateInstagramCardCopyReviewDrafts>[0]["edits"]) => () =>
      updateInstagramCardCopyReviewDrafts({ review: freshReview(base), base, edits, updatedBy: null, nowIso: T1 });
    const codeOf = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof InstagramCardCopyReviewError ? error.code : "other";
      }
      return null;
    };
    expect(codeOf(run([{ cardId: "c9", headline: "없는 카드" }]))).toBe("unknown_card");
    expect(codeOf(run([{ cardId: "c1", headline: "  " }]))).toBe("headline_required");
    expect(codeOf(run([{ cardId: "c1", headline: "가".repeat(81) }]))).toBe("field_too_long");
    expect(
      codeOf(() =>
        updateInstagramCardCopyReviewDrafts({
          review: freshReview(base),
          base: cardCopy({ c2: "바뀐 원본" }),
          edits: [{ cardId: "c1", headline: "수정" }],
          updatedBy: null,
          nowIso: T1,
        }),
      ),
    ).toBe("base_changed");
  });
});

describe("Instagram card copy review — gate state", () => {
  it("walks review_missing → pending → approved and invalidates on base change or later edits", () => {
    const base = cardCopy();
    expect(resolveInstagramCardCopyReviewGateState(null, null).state).toBe("not_applicable");
    expect(resolveInstagramCardCopyReviewGateState(base, null).state).toBe("review_missing");

    const edited = edit(freshReview(base), base);
    expect(resolveInstagramCardCopyReviewGateState(base, edited).state).toBe("pending");

    const approved = approveInstagramCardCopyReview({ review: edited, base, approvedBy: "ysh", nowIso: T1 });
    const gate = resolveInstagramCardCopyReviewGateState(base, approved);
    expect(gate.state).toBe("approved");
    expect(gate.effectiveFingerprint).toBe(approved.approvedEffectiveFingerprint);

    expect(resolveInstagramCardCopyReviewGateState(cardCopy({ c1: "재생성" }), approved).state).toBe("base_changed");
    expect(resolveInstagramCardCopyReviewGateState(base, edit(approved, base, "승인 뒤 수정")).state).toBe("pending");

    const tampered: InstagramCardCopyReview = {
      ...approved,
      cards: approved.cards.map((c) =>
        c.cardId === "c3" ? { ...c, humanDraft: { ...c.humanDraft!, headline: "몰래 바뀜" } } : c,
      ),
    };
    expect(resolveInstagramCardCopyReviewGateState(base, tampered).state).toBe("approved_stale");
  });
});

function withCoverTitle(
  review: InstagramCardCopyReview,
  base: InstagramCardCopy,
  instagramCoverTitleKo: string | null | undefined,
) {
  return updateInstagramCardCopyReviewDrafts({
    review,
    base,
    edits: [],
    instagramCoverTitleKo,
    updatedBy: "ysh",
    nowIso: T1,
  });
}

/** Reviews persisted before the thumbnail title existed have no key at all. */
function legacy(review: InstagramCardCopyReview): InstagramCardCopyReview {
  const copy = { ...review };
  delete copy.instagramCoverTitleKo;
  return copy;
}

describe("Instagram card copy review — thumbnail title", () => {
  it("accepts legacy reviews without the field and keeps their approval hash", () => {
    const base = cardCopy();
    const edited = legacy(edit(freshReview(base), base));
    expect(resolveInstagramCoverTitleKo(edited)).toBeNull();

    const approved = legacy(approveInstagramCardCopyReview({ review: edited, base, approvedBy: "ysh", nowIso: T1 }));
    expect(approved.approvedEffectiveFingerprint).toBe(
      buildInstagramCardCopyContentFingerprint(applyInstagramCardCopyReview(base, edited)),
    );
    expect(resolveInstagramCardCopyReviewGateState(base, approved).state).toBe("approved");
    expect(withCoverTitle(edited, base, undefined).instagramCoverTitleKo).toBeNull();
    expect(hasInstagramCardHumanEdits(legacy(freshReview(base)))).toBe(false);
  });

  it("starts null on new and reset reviews", () => {
    expect(freshReview().instagramCoverTitleKo).toBeNull();
    const { packageRoot } = seedPackage();
    expect(
      freshInstagramCardCopyReviewForReset({ candidateId: CANDIDATE_ID, packageRoot, updatedBy: "ysh", nowIso: T1 })
        .instagramCoverTitleKo,
    ).toBeNull();
  });

  it("saves trimmed, keeps on omission, clears on null or blank, and rejects over-length", () => {
    const base = cardCopy();
    const approved = approveInstagramCardCopyReview({ review: freshReview(base), base, approvedBy: "ysh", nowIso: T1 });
    const saved = withCoverTitle(approved, base, "  제주 가을 억새 명소  ");
    expect(saved.instagramCoverTitleKo).toBe("제주 가을 억새 명소");
    expect(saved.status).toBe("pending");
    expect(saved.approvedEffectiveFingerprint).toBeNull();

    expect(withCoverTitle(saved, base, undefined).instagramCoverTitleKo).toBe("제주 가을 억새 명소");
    expect(edit(saved, base).instagramCoverTitleKo).toBe("제주 가을 억새 명소");
    expect(withCoverTitle(saved, base, "   ").instagramCoverTitleKo).toBeNull();
    expect(withCoverTitle(saved, base, null).instagramCoverTitleKo).toBeNull();

    try {
      withCoverTitle(saved, base, "가".repeat(81));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InstagramCardCopyReviewError);
      expect((error as InstagramCardCopyReviewError).code).toBe("field_too_long");
    }
    expect(withCoverTitle(saved, base, "가".repeat(80)).instagramCoverTitleKo).toHaveLength(80);
  });

  it("re-opens approval when only the thumbnail title changes", () => {
    const base = cardCopy();
    const titled = withCoverTitle(freshReview(base), base, "썸네일 제목");
    const approved = approveInstagramCardCopyReview({ review: titled, base, approvedBy: "ysh", nowIso: T1 });
    expect(resolveInstagramCardCopyReviewGateState(base, approved).state).toBe("approved");
    expect(approved.approvedEffectiveFingerprint).not.toBe(buildInstagramCardCopyContentFingerprint(base));

    expect(resolveInstagramCardCopyReviewGateState(base, { ...approved, instagramCoverTitleKo: "다른 제목" }).state).toBe(
      "approved_stale",
    );
    expect(resolveInstagramCardCopyReviewGateState(base, { ...approved, instagramCoverTitleKo: null }).state).toBe(
      "approved_stale",
    );
    expect(resolveInstagramCardCopyReviewGateState(base, withCoverTitle(approved, base, "다른 제목")).state).toBe(
      "pending",
    );
  });

  it("counts a thumbnail title alone as a human edit for rebase protection", () => {
    const { packageRoot } = seedPackage();
    const oldBase = cardCopy();
    const titled = withCoverTitle(freshReview(oldBase), oldBase, "썸네일 제목");
    expect(hasInstagramCardHumanEdits(titled)).toBe(true);
    expect(applyInstagramCardCopyReview(oldBase, titled)).toBe(oldBase);

    persistInstagramCardCopy({ packageRoot, copy: cardCopy({ c1: "재생성된 표지" }), createdAt: T1 });
    const review = { channelReviews: { instagram: { cardCopyReview: titled } } } as unknown as HumanMarketingReview;
    expect(
      buildInstagramCardCopyReviewView({ candidateId: CANDIDATE_ID, packageRoot, review, nowIso: T1 }).staleHumanEdits,
    ).toBe(true);
    expect(() =>
      resolveMutableInstagramCardCopyReview({ candidateId: CANDIDATE_ID, packageRoot, review, updatedBy: "ysh", nowIso: T1 }),
    ).toThrow(InstagramCardCopyReviewError);
  });

  it("does not stale VRA when only the thumbnail title is approved", () => {
    const { packageRoot } = seedPackage();
    const base = cardCopy();
    writeVraFor(packageRoot, base);
    persistInstagramCardCopyReview({
      packageRoot,
      review: approveInstagramCardCopyReview({
        review: withCoverTitle(freshReview(base), base, "썸네일 제목"),
        base,
        approvedBy: "ysh",
        nowIso: T1,
      }),
    });
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("approved");
    expect(resolveInstagramVisualRoleLifecycleForPackage(packageRoot)).toBe("fresh");
    expect(buildInstagramCardCopyContentFingerprint(resolveEffectiveInstagramCardCopy(packageRoot)!)).toBe(
      buildInstagramCardCopyContentFingerprint(base),
    );
    const original = bundle();
    expect(overlayEffectiveInstagramCardCopyForPackage(original, packageRoot)).toBe(original);
  });

  it("passes the approved title to the 1:1 render only", async () => {
    const { assetRoot, packageRoot } = seedPackage();
    const base = cardCopy();
    const approve = (title: string | null) =>
      persistInstagramCardCopyReview({
        packageRoot,
        review: approveInstagramCardCopyReview({
          review: withCoverTitle(freshReview(base), base, title),
          base,
          approvedBy: "ysh",
          nowIso: T1,
        }),
      });
    const render = () =>
      renderInstagramCardnewsForPackage({ packageRoot, assetRoot, dryRun: true, graphicOnly: true, now: new Date(T1) });
    const thumbnailPaths = (result: Awaited<ReturnType<typeof render>>) =>
      result.renders.flatMap((r) => r.plannedRelativePaths.filter((p) => p.includes("instagram_thumbnail")));

    approve("썸네일 제목");
    const titled = await render();
    expect(titled.aspectRatios).toEqual(["4:5", "1:1"]);
    expect(thumbnailPaths(titled)).toEqual(["cardnews/1x1/card-01-instagram_thumbnail.png"]);
    expect(titled.renders[0]!.render!.variants).toBeUndefined();
    expect(titled.renders[1]!.render!.variants).toHaveLength(1);

    approve(null);
    const untitled = await render();
    expect(thumbnailPaths(untitled)).toEqual([]);
    expect(untitled.renders.every((r) => r.render!.variants === undefined)).toBe(true);
  }, 60_000);
});

function instagramSlot(): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: "instagram",
    format: "instagram_caption",
    title: null,
    body: "캡션 본문\n\n#태그",
    status: "generated",
    generatedAt: T0,
    sourceCandidateId: CANDIDATE_ID,
    sourceRevision: "rev1",
    provenance: {
      composer: "llm",
      evidenceRefIds: ["ev-7"],
      commercialIntent: "informational",
      generationMode: "llm",
      attemptCount: 1,
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    needsRegeneration: false,
    instagramMeta: {
      hook: "캡션 본문",
      hashtags: ["#태그"],
      slideHeadlines: CARD_IDS.map((_, i) => `AI 헤드라인 ${i + 1}`),
      cta: null,
      altText: "alt",
      cardPlan: CARD_IDS.map((cardId, i) => ({
        cardId,
        role: i === 0 ? "cover" : i === 2 ? "evidence" : i === 3 ? "cta" : "information",
        headline: `AI 헤드라인 ${i + 1}`,
        body: `AI 본문 ${i + 1}`,
        visualIntent: `[visualPriority=strong] 목표 · AI 헤드라인 ${i + 1}`,
        evidenceRefs: i === 2 ? ["ev-7"] : [],
      })),
    },
  } as PublishableChannelContent;
}

function bundle(): PublishableContentBundle {
  const threads = { ...instagramSlot(), channel: "threads", format: "threads_text" };
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: CANDIDATE_ID,
    businessDateKst: "2026-09-27",
    generatedAt: T0,
    sourceRevision: "rev1",
    targetChannels: ["threads", "instagram"],
    threads,
    shortform: { ...threads, channel: "shortform", format: "short_video_narration" },
    instagram: instagramSlot(),
  } as PublishableContentBundle;
}

describe("Instagram card copy review — bundle overlay", () => {
  it("replaces cardPlan copy by cardId and keeps role / evidence provenance", () => {
    const base = cardCopy();
    const effective = applyInstagramCardCopyReview(base, edit(freshReview(base), base));
    const original = bundle();
    const next = overlayInstagramCardCopyOnBundle({ bundle: original, carousel: carousel(), effective });

    const plan = next.instagram!.instagramMeta!.cardPlan!;
    expect(plan[2]).toMatchObject({ cardId: "c3", role: "evidence", headline: "사람이 고친 근거", body: "사람 본문", evidenceRefs: ["ev-7"] });
    expect(plan[2]!.visualIntent).toContain("사람이 고친 근거");
    expect(plan[0]!.headline).toBe("AI 헤드라인 1");
    expect(next.instagram!.instagramMeta!.slideHeadlines[2]).toBe("사람이 고친 근거");
    expect(original.instagram!.instagramMeta!.cardPlan![2]!.headline).toBe("AI 헤드라인 3");
  });
});

const tempDirs: string[] = [];
afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

function seedPackage(): { assetRoot: string; packageRoot: string } {
  const assetRoot = mkdtempSync(join(tmpdir(), "ig-card-review-"));
  tempDirs.push(assetRoot);
  const packageRoot = join(assetRoot, "2026/09/27", CANDIDATE_ID);
  mkdirSync(join(packageRoot, "context"), { recursive: true });
  writeFileSync(join(packageRoot, "context/media-brief.json"), stableJsonBytes(createCardNewsVerificationBrief()));
  writeFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), JSON.stringify(bundle()), "utf8");
  persistInstagramCarouselPlan({ packageRoot, plan: carousel(), createdAt: T0 });
  persistInstagramCardCopy({ packageRoot, copy: cardCopy(), createdAt: T0 });
  return { assetRoot, packageRoot };
}

function writeVraFor(packageRoot: string, copy: InstagramCardCopy) {
  writeFileSync(
    join(packageRoot, INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH),
    JSON.stringify({
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel()),
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(copy),
    }),
    "utf8",
  );
}

describe("Instagram card copy review — package gates", () => {
  it("makes VRA stale once an approved human edit changes the effective copy", () => {
    const { packageRoot } = seedPackage();
    const base = cardCopy();
    writeVraFor(packageRoot, base);
    expect(resolveInstagramVisualRoleLifecycleForPackage(packageRoot)).toBe("fresh");

    const approved = approveInstagramCardCopyReview({
      review: edit(freshReview(base), base),
      base,
      approvedBy: "ysh",
      nowIso: T1,
    });
    persistInstagramCardCopyReview({ packageRoot, review: approved });

    expect(resolveEffectiveInstagramCardCopy(packageRoot)!.cards[2]!.headline).toBe("사람이 고친 근거");
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("approved");
    expect(resolveInstagramVisualRoleLifecycleForPackage(packageRoot)).toBe("stale");

    writeVraFor(packageRoot, resolveEffectiveInstagramCardCopy(packageRoot)!);
    expect(resolveInstagramVisualRoleLifecycleForPackage(packageRoot)).toBe("fresh");
  });

  it("blocks render until card copy is approved, then renders the effective copy", async () => {
    const { assetRoot, packageRoot } = seedPackage();
    const render = (graphicOnly: boolean) =>
      renderInstagramCardnewsForPackage({
        packageRoot,
        assetRoot,
        aspectRatios: ["4:5"],
        dryRun: true,
        graphicOnly,
        now: new Date(T1),
      });

    const blocked = await render(true);
    expect(blocked).toMatchObject({
      status: "skipped",
      skipReason: "card_copy_review_required",
      cardCopyReviewState: "review_missing",
    });

    const base = cardCopy();
    const edited = edit(freshReview(base), base);
    persistInstagramCardCopyReview({ packageRoot, review: edited });
    expect((await render(true)).cardCopyReviewState).toBe("pending");

    persistInstagramCardCopyReview({
      packageRoot,
      review: approveInstagramCardCopyReview({ review: edited, base, approvedBy: "ysh", nowIso: T1 }),
    });
    writeVraFor(packageRoot, base);
    expect(resolveInstagramVisualRoleLifecycleForPackage(packageRoot)).toBe("stale");

    // Text edits must not force SVP / handoff regeneration before a re-render.
    const rendered = await render(false);
    expect(rendered).toMatchObject({ status: "rendered", visualPlanStale: false });
    expect((await render(true)).status).toBe("rendered");
    const brief = resolveInstagramCardnewsRenderBrief(
      createCardNewsVerificationBrief(),
      overlayEffectiveInstagramCardCopyForPackage(bundle(), packageRoot),
    );
    expect(brief.formats.cardnews.cards[2]).toMatchObject({ headline: "사람이 고친 근거", body: "사람 본문" });
  }, 60_000);
});
