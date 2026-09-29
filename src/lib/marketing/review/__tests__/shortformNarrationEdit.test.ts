vi.mock("server-only", () => ({}));

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildDraft,
  buildTestCandidate,
  buildTestLlmPublishableBundle,
  NOW,
} from "@/lib/marketing/assets/__tests__/fixtures";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { readPackageManifest } from "@/lib/marketing/assets/manifestUpsert";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { maybeGenerateShortformBriefAndResolve } from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import { rebuildShortformBriefsFromDraft } from "@/lib/marketing/assets/shortform/rebuildShortformBriefsFromDraft";
import {
  createInMemoryShortformVideoRenderJobRepository,
  ownershipFromShortformRenderClaim,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import { evaluateShortformRenderReady } from "@/lib/marketing/assets/shortform/renderReady";
import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import { createLocalMarketingAssetTransport } from "@/lib/marketing/assets/transport/localTransport";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { readPublishableBundle, writePublishableBundle } from "@/lib/marketing/publishable/channelSources/packageIo";
import { assertShortformReadyForManualPublish } from "@/lib/marketing/review/assertShortformReadyForManualPublish";
import { humanEditedRelativePath } from "@/lib/marketing/review/channelReviews";
import { HumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { createInMemoryHumanMarketingReviewRepository } from "@/lib/marketing/review/repository/createHumanMarketingReviewRepository";
import {
  applyShortformNarrationEdit,
  ShortformNarrationEditError,
} from "@/lib/marketing/review/shortformNarrationReview";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

beforeEach(() => {
  process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = "narration-edit-secret";
});

async function setup(candidateId: string) {
  const assetRoot = mkdtempSync(join(tmpdir(), "sf-narration-edit-"));
  tempDirs.push(assetRoot);
  const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
  const jobRepo = createInMemoryShortformVideoRenderJobRepository();
  const candidateRepo = createInMemoryDailyMarketingRunRepository();
  const candidate = buildTestCandidate({
    candidateId,
    businessDateKst: "2026-09-11",
    draft: buildDraft({ body: "Hook line for travelers.\n\nSecond scene with official guidance." }),
  });
  await candidateRepo.saveCandidate(candidate);
  const bridge = await maybeGenerateShortformBriefAndResolve({
    candidate,
    publishableBundle: buildTestLlmPublishableBundle(candidate),
    assetRoot,
    catalog,
    env: { MARKETING_ASSET_ROOT: assetRoot, PEXELS_API_KEY: "", PIXABAY_API_KEY: "" },
    now: NOW,
  });
  expect(bridge.shortVideoBriefPersisted).toBe(true);
  process.env.MARKETING_ASSET_ROOT = assetRoot;
  const packageRoot = bridge.packageRoot!;

  const reviewRepo = createInMemoryHumanMarketingReviewRepository();
  await reviewRepo.save({
    reviewId: `rev_${candidateId}`,
    candidateId,
    status: "editing",
    currentDraft: { title: null, body: "draft", channel: "threads" },
    channelReviews: {},
    updatedAt: NOW.toISOString(),
  } as unknown as HumanMarketingReview);

  let clock = NOW.getTime();
  const service = new HumanMarketingReviewService({
    candidateRepo,
    reviewRepo,
    now: () => new Date((clock += 1000)),
    resolvePackageRoot: () => packageRoot,
    shortformCatalog: catalog,
    shortformJobRepository: jobRepo,
  });

  async function pickAllScenes(prefix: string) {
    const evaluation = await evaluateShortformRenderReady({
      candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
    });
    for (const scene of evaluation.brief!.scenes) {
      const source = await catalog.registerSource({
        sourceKind: "own",
        mediaType: "video",
        rightsKind: "owned",
        managedRelativePath: `library/internal/${prefix}-${scene.sceneId}.mp4`,
        metadata: { factualMatch: "confirmed", pickOrigin: "internal_catalog" },
      });
      await catalog.setScenePick({ sourceId: source.id, candidateId, sceneKey: scene.sceneId });
    }
  }

  async function renderQueued() {
    const claimed = await jobRepo.claimNext({ workerId: "narration-test", now: new Date((clock += 1000)) });
    expect(claimed).toBeTruthy();
    await jobRepo.markReady({
      logicalRunKey: claimed!.logicalRunKey,
      ownership: ownershipFromShortformRenderClaim(claimed!),
      outputArtifactPath: SHORTFORM_FINAL_RELATIVE_PATH,
      now: new Date((clock += 1000)),
    });
    mkdirSync(join(packageRoot, "reel/final"), { recursive: true });
    writeFileSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH), Buffer.from(`mp4-${claimed!.logicalRunKey}`));
    return claimed!;
  }

  const gate = () =>
    assertShortformReadyForManualPublish({
      candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
    });

  return { assetRoot, catalog, jobRepo, candidateRepo, candidate, packageRoot, reviewRepo, service, pickAllScenes, renderQueued, gate };
}

function mediaBriefSegments(packageRoot: string) {
  return parseMediaBrief(JSON.parse(readFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH), "utf8"))).formats
    .shortform.narrationSegments;
}

function editedPayload(view: { segments: Array<{ segmentId: string; text: string }> }, firstText: string) {
  return view.segments.map((segment, index) => ({
    segmentId: segment.segmentId,
    text: index === 0 ? firstText : segment.text,
  }));
}

describe("shortform narration segment edit", () => {
  it("view lists media-brief segments with scene mapping", async () => {
    const { service, candidate, packageRoot } = await setup("cmc_narr_view");
    const view = await service.getShortformNarration(candidate.candidateId);
    expect(view.applicable).toBe(true);
    expect(view.editable).toBe(true);
    expect(view.segments.length).toBe(mediaBriefSegments(packageRoot).length);
    expect(view.segments.every((s) => s.text === s.aiText && !s.edited)).toBe(true);
    expect(view.segments[0]!.sceneId).toMatch(/^scene-/);
    expect(view.render?.pickedSceneCount).toBe(0);
  });

  it("save rewrites bundle, media-brief, manifest and export; transport reads without integrity 409", async () => {
    const { service, candidate, packageRoot, catalog, reviewRepo, assetRoot } = await setup("cmc_narr_save");
    const before = await service.getShortformNarration(candidate.candidateId);
    const aiFirst = before.segments[0]!.text;

    const result = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(before, "  사람이 고친 첫 문장입니다.  "),
      reviewedBy: "tester",
    });
    expect(result.changed).toBe(true);
    expect(result.segments[0]).toMatchObject({ text: "사람이 고친 첫 문장입니다.", aiText: aiFirst, edited: true });

    const segments = mediaBriefSegments(packageRoot);
    expect(segments[0]).toMatchObject({
      narrationText: "사람이 고친 첫 문장입니다.",
      subtitleText: "사람이 고친 첫 문장입니다.",
    });

    const slot = readPublishableBundle(packageRoot)!.shortform;
    expect(slot.status).toBe("human_edited");
    expect(slot.provenance.composer).toBe("human");
    expect(slot.publishableSuccess).toBe(true);
    expect(slot.narrationSegments?.[0]?.narrationText).toBe("사람이 고친 첫 문장입니다.");
    expect(slot.aiNarrationSegments?.[0]?.narrationText).toBe(aiFirst);

    const manifest = readPackageManifest(packageRoot);
    expect(manifest).toBeTruthy();
    const entry = manifest!.artifacts.find((a) => a.relativePath === MEDIA_BRIEF_RELATIVE_PATH);
    expect(entry?.sha256).toBe(sha256Buffer(readFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH))));

    expect(readFileSync(join(packageRoot, humanEditedRelativePath("shortform")), "utf8")).toContain(
      "사람이 고친 첫 문장입니다.",
    );

    const transport = createLocalMarketingAssetTransport({ catalog, env: { MARKETING_ASSET_ROOT: assetRoot } });
    const read = await transport.readCandidatePackageArtifact({
      candidateId: candidate.candidateId,
      businessDateKst: candidate.businessDateKst,
      artifactKind: "media-brief",
    });
    expect(read.bytes.toString("utf8")).toContain("사람이 고친 첫 문장입니다.");

    const review = await reviewRepo.findByCandidateId(candidate.candidateId);
    expect(review?.channelReviews?.shortform?.humanDraft?.body).toContain("사람이 고친 첫 문장입니다.");
    expect(review?.channelReviews?.shortform?.status).toBe("needs_review");

    const second = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(result, "두 번째 수정"),
      reviewedBy: "tester",
    });
    expect(readPublishableBundle(packageRoot)!.shortform.aiNarrationSegments?.[0]?.narrationText).toBe(aiFirst);
    expect(second.segments[0]!.aiText).toBe(aiFirst);
  });

  it("rejects segment set changes and invalid text without touching the package", async () => {
    const { service, candidate, packageRoot } = await setup("cmc_narr_invalid");
    const view = await service.getShortformNarration(candidate.candidateId);
    const briefBefore = readFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH));
    const save = (segments: Array<{ segmentId: string; text: string }>) =>
      service.saveShortformNarration({ candidateId: candidate.candidateId, segments, reviewedBy: null });

    const cases: Array<[Array<{ segmentId: string; text: string }>, string]> = [
      [editedPayload(view, "x").slice(1), "segments_mismatch"],
      [[...editedPayload(view, "x"), { segmentId: "narr-99", text: "추가" }], "segments_mismatch"],
      [editedPayload(view, "   "), "text_required"],
      [editedPayload(view, "가".repeat(2001)), "text_too_long"],
      [editedPayload(view, "제어\u0007문자"), "text_invalid"],
    ];
    for (const [segments, code] of cases) {
      const error = await save(segments).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ShortformNarrationEditError);
      expect((error as ShortformNarrationEditError).code).toBe(code);
    }
    expect(readFileSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH)).equals(briefBefore)).toBe(true);
  });

  it("skips re-render until every scene is picked, then enqueues with the narration fingerprint", async () => {
    const { service, candidate, jobRepo, pickAllScenes } = await setup("cmc_narr_enqueue");
    const view = await service.getShortformNarration(candidate.candidateId);

    const early = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "PICK 전 수정"),
      reviewedBy: null,
    });
    expect(early.rerender.enqueued).toBe(false);
    expect(await jobRepo.listForCandidate(candidate.candidateId)).toHaveLength(0);

    await pickAllScenes("enqueue");
    const later = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(early, "PICK 후 수정"),
      reviewedBy: null,
    });
    expect(later.rerender).toMatchObject({ enqueued: true, created: true });
    const jobs = await jobRepo.listForCandidate(candidate.candidateId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.inputSnapshot.narrationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(later.render?.uiStatus).toBe("queued");
  });

  it("cancels QUEUED jobs of older narration and gates approval on the current narration", async () => {
    const { service, candidate, jobRepo, pickAllScenes, renderQueued, gate } = await setup("cmc_narr_gate");
    await pickAllScenes("gate");
    const view = await service.getShortformNarration(candidate.candidateId);

    const first = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "첫 번째 문구"),
      reviewedBy: null,
    });
    expect(first.rerender.created).toBe(true);
    const second = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(first, "두 번째 문구"),
      reviewedBy: null,
    });
    expect(second.rerender.created).toBe(true);
    const statuses = (await jobRepo.listForCandidate(candidate.candidateId)).map((j) => j.status).sort();
    expect(statuses).toEqual(["CANCELLED", "QUEUED"]);

    await renderQueued();
    await expect(gate()).resolves.toBeUndefined();

    const third = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(second, "세 번째 문구"),
      reviewedBy: null,
    });
    expect(third.rerender.created).toBe(true);
    await expect(gate()).rejects.toThrow(/대기/);

    await renderQueued();
    await expect(gate()).resolves.toBeUndefined();
  });

  it("stale READY from before an edit blocks approval with the narration message", async () => {
    const { service, candidate, pickAllScenes, renderQueued, gate, jobRepo, catalog, candidateRepo, packageRoot } =
      await setup("cmc_narr_stale");
    await pickAllScenes("stale");
    const view = await service.getShortformNarration(candidate.candidateId);
    await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "렌더된 문구"),
      reviewedBy: null,
    });
    await renderQueued();
    await expect(gate()).resolves.toBeUndefined();

    // Package edited outside the save flow (e.g. worker offline): no job for the new text yet.
    const current = await service.getShortformNarration(candidate.candidateId);
    applyShortformNarrationEdit({
      packageRoot,
      candidate,
      segments: editedPayload(current, "렌더 안 된 문구"),
      now: new Date(NOW.getTime() + 60_000),
    });
    const evaluation = await evaluateShortformRenderReady({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
    });
    expect(evaluation.job).toBeNull();
    expect(evaluation.reason).toBe("narration_changed_requires_render");
    await expect(gate()).rejects.toThrow(/내레이션이 수정되어/);
  });

  it("returning to already-rendered text whose video was replaced does not pass the gate", async () => {
    const { service, candidate, pickAllScenes, renderQueued, gate } = await setup("cmc_narr_aba");
    await pickAllScenes("aba");
    const view = await service.getShortformNarration(candidate.candidateId);
    const a = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "문구 A"),
      reviewedBy: null,
    });
    await renderQueued();
    const b = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(a, "문구 B"),
      reviewedBy: null,
    });
    await renderQueued();
    const back = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(b, "문구 A"),
      reviewedBy: null,
    });
    expect(back.rerender).toMatchObject({ enqueued: false, skippedReason: "render_key_spent_requires_input_change" });
    expect(back.render?.narrationStale).toBe(true);
    await expect(gate()).rejects.toThrow(/내레이션이 수정되어/);
  });

  it("edited narration survives rebuildShortformBriefsFromDraft and stays transport-readable", async () => {
    const { service, candidate, packageRoot, catalog, assetRoot } = await setup("cmc_narr_rebuild");
    const view = await service.getShortformNarration(candidate.candidateId);
    await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "재검색에도 남는 문구"),
      reviewedBy: null,
    });

    const rebuilt = await rebuildShortformBriefsFromDraft({
      candidateId: candidate.candidateId,
      candidate,
      draft: { title: null, body: "Hook line for travelers.\n\nSecond scene with official guidance.", channel: "threads" },
      now: new Date(NOW.getTime() + 120_000),
    });
    expect(rebuilt.ok).toBe(true);
    expect(mediaBriefSegments(packageRoot)[0]!.narrationText).toBe("재검색에도 남는 문구");
    expect(readPublishableBundle(packageRoot)!.shortform.status).toBe("human_edited");

    const transport = createLocalMarketingAssetTransport({ catalog, env: { MARKETING_ASSET_ROOT: assetRoot } });
    await expect(
      transport.readCandidatePackageArtifact({
        candidateId: candidate.candidateId,
        businessDateKst: candidate.businessDateKst,
        artifactKind: "media-brief",
      }),
    ).resolves.toMatchObject({ artifactKind: "media-brief" });
    expect(existsSync(join(packageRoot, "manifest.json"))).toBe(true);
  });
});

describe("shortform narration edit without render narration (not shortform-committed)", () => {
  async function setupSlotOnly(candidateId: string) {
    const packageRoot = mkdtempSync(join(tmpdir(), "sf-narration-slot-"));
    tempDirs.push(packageRoot);
    const candidateRepo = createInMemoryDailyMarketingRunRepository();
    const candidate = buildTestCandidate({ candidateId, businessDateKst: "2026-09-19" });
    await candidateRepo.saveCandidate(candidate);
    const bundle = buildTestLlmPublishableBundle(candidate);
    const segment = (segmentId: string, text: string, purpose: string) => ({
      segmentId,
      narrationText: text,
      subtitleText: text,
      purpose,
      visualIntent: "골목 장면",
      evidenceRefs: [],
    });
    writePublishableBundle(
      packageRoot,
      {
        ...bundle,
        shortform: {
          ...bundle.shortform,
          body: "첫 문장.\n\n둘째 문장.",
          provenance: { ...bundle.shortform.provenance, generationSource: "external_editorial" },
          narrationSegments: [segment("narr-01", "첫 문장.", "hook"), segment("narr-02", "둘째 문장.", "body")],
        },
      },
      NOW.toISOString(),
    );
    const reviewRepo = createInMemoryHumanMarketingReviewRepository();
    await reviewRepo.save({
      reviewId: `rev_${candidateId}`,
      candidateId,
      status: "editing",
      currentDraft: { title: null, body: "draft", channel: "threads" },
      channelReviews: {},
      updatedAt: NOW.toISOString(),
    } as unknown as HumanMarketingReview);
    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    let clock = NOW.getTime();
    const service = new HumanMarketingReviewService({
      candidateRepo,
      reviewRepo,
      now: () => new Date((clock += 1000)),
      resolvePackageRoot: () => packageRoot,
      shortformCatalog: createInMemoryMarketingMediaSourceCatalogRepository(),
      shortformJobRepository: jobRepo,
    });
    return { candidate, packageRoot, reviewRepo, jobRepo, service };
  }

  it("edits the publishable slot segments only, with no media-brief write and no render", async () => {
    const { candidate, packageRoot, reviewRepo, jobRepo, service } = await setupSlotOnly("cmc_narr_slot");
    const view = await service.getShortformNarration(candidate.candidateId);
    expect(view).toMatchObject({ applicable: true, editable: true, target: "publishable_slot", render: null });
    expect(view.segments.map((s) => s.text)).toEqual(["첫 문장.", "둘째 문장."]);

    const result = await service.saveShortformNarration({
      candidateId: candidate.candidateId,
      segments: editedPayload(view, "사람이 고친 첫 문장."),
      reviewedBy: "tester",
    });
    expect(result.rerender).toEqual({ enqueued: false, created: false, skippedReason: "text_only_no_render" });
    expect(result.segments[0]).toMatchObject({ text: "사람이 고친 첫 문장.", aiText: "첫 문장.", edited: true });

    const slot = readPublishableBundle(packageRoot)!.shortform;
    expect(slot.status).toBe("human_edited");
    expect(slot.body).toBe("사람이 고친 첫 문장.\n\n둘째 문장.");
    expect(slot.aiNarrationSegments?.[0]?.narrationText).toBe("첫 문장.");
    expect(existsSync(join(packageRoot, MEDIA_BRIEF_RELATIVE_PATH))).toBe(false);
    expect(await jobRepo.listForCandidate(candidate.candidateId)).toHaveLength(0);

    const review = await reviewRepo.findByCandidateId(candidate.candidateId);
    expect(review?.channelReviews?.shortform?.humanDraft?.body).toBe("사람이 고친 첫 문장.\n\n둘째 문장.");
  });

  it("reports why editing is unavailable when neither media-brief nor the slot has segments", async () => {
    const { candidate, packageRoot, service } = await setupSlotOnly("cmc_narr_none");
    const bundle = readPublishableBundle(packageRoot)!;
    writePublishableBundle(
      packageRoot,
      { ...bundle, shortform: { ...bundle.shortform, narrationSegments: [] } },
      NOW.toISOString(),
    );
    const view = await service.getShortformNarration(candidate.candidateId);
    expect(view).toMatchObject({ applicable: false, target: null, editable: false });
    expect(view.blockedReason).toContain("편집할 숏폼 내레이션이 없습니다");
  });
});