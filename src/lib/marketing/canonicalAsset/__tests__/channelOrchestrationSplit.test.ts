/**
 * Canonical approve must not fan-out channel composers.
 * Channels generate independently via generateChannelAsset / scoped ensure.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  approveCanonicalAsset,
  generateChannelAsset,
} from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { markPublishableBundleStaleForAsset } from "@/lib/marketing/publishable/approvedAsset";
import { PUBLISHABLE_CONTENT_BUNDLE_CONTRACT } from "@/lib/marketing/publishable/contracts";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { buildChannelWorkspaceAfterCanonicalApprove } from "@/lib/marketing/publishable/channelWorkspace";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";

/** Seed approved asset + empty workspace without domain validation (unit fixtures). */
function seedApprovedEmptyWorkspace(input: {
  packageRoot: string;
  asset?: CanonicalMarketingAsset;
}): CanonicalMarketingAsset {
  const approved = approveCanonicalMarketingAsset({
    asset: input.asset ?? durableAsset(),
    mode: "ai_original",
    approvedBy: "tester",
  });
  persistCanonicalAssetToPackage({ packageRoot: input.packageRoot, asset: approved });
  const bundle = buildChannelWorkspaceAfterCanonicalApprove({
    candidateId: "cmc_orch",
    businessDateKst: "2026-09-18",
    sourceRevision: approved.sourceRevision,
    contentPlanTargetChannels: [
      "threads",
      "shortform",
      "naver_blog",
      "naver_band",
      "kakao_channel",
      "instagram",
    ],
    commercialIntent: "informational",
    approvedAsset: approved,
    priorBundle: null,
    nowIso: "2026-09-18T01:00:00.000Z",
  });
  persistPublishableContentBundle({
    packageRoot: input.packageRoot,
    bundle,
    createdAt: "2026-09-18T01:00:00.000Z",
  });
  return approved;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "chan-orch-"));
  tempDirs.push(dir);
  return dir;
}

function durableAsset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_orch",
    version: 1,
    status: "draft",
    agendaId: "ag_orch",
    storyPointId: "sp_orch",
    storyPointHash: "hash_orch",
    evidenceBriefRef: "ebr_orch",
    evidenceRevision: "ev_rev",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_rev",
    sourceRevision: "src_rev_v1",
    titleKo: "푸꾸옥 호텔 공급, 지금 잡을까",
    dekKo: "공급과 취소 조건",
    openingHookKo: "공급이 늘면 무조건 기다려야 할까.",
    bodyKo:
      "푸꾸옥의 객실 공급이 늘고 있다는 관찰만으로 요금이 내려간다고 단정할 수는 없습니다. 성수기와 취소 조건을 함께 봐야 합니다.",
    keyTakeawaysKo: ["공급만으로 가격을 단정하지 말 것", "취소 조건 확인"],
    decisionGuidanceKo: "출발 시기에 맞춰 확보 또는 관망을 선택하세요.",
    optionalCtaIntentKo: "조건을 비교해 보세요",
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "공급" }],
    limitationsKo: ["요금 하락 보장 없음"],
    forbiddenClaimsKo: ["무조건 싸진다"],
    supportedClaimBoundaryKo: "공개 공급 관찰",
    unresolvedQuestionsKo: [],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
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
    ...overrides,
  };
}

function candidateStub(
  asset: CanonicalMarketingAsset | null,
  options?: { businessDateKst?: string; withProposition?: boolean },
): CompletedMarketingCandidate {
  const withProposition = options?.withProposition !== false;
  return {
    candidateId: "cmc_orch",
    businessDateKst: options?.businessDateKst ?? "2026-09-18",
    logicalRunKey: "lrk_orch",
    runId: "run_orch",
    status: "needs_human_review",
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    contract: "completed-marketing-candidate-v1",
    contentAssignment: {
      assignmentId: "ca_orch",
      topic: "푸꾸옥 호텔",
      audience: "해외여행 예정자",
      commercialIntent: "informational",
      evidenceRefs: [],
      facts: [
        {
          statement: "푸꾸옥 객실 공급이 늘고 있다는 관찰이 있습니다.",
          confidence: "medium",
          evidenceRefs: ["ev1"],
        },
        {
          statement: "취소 조건은 상품마다 다릅니다.",
          confidence: "high",
          evidenceRefs: ["ev1"],
        },
      ],
    },
    contentPlan: {
      keyMessage: "판단",
      hook: null,
      targetChannels: ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel", "instagram"],
      factsToAvoid: [],
      evidenceRefs: [],
      ...(withProposition
        ? {
            proposition: {
              contract: "content-proposition-v1",
              selectedAngleRef: "angle_1",
              contentPromise: "공급과 취소 조건을 함께 보라",
              readerGain: "성급한 관망을 피한다",
              specificTakeaways: ["공급≠가격", "취소 조건"],
              desiredAudienceAction: "compare",
              engagementMechanism: "save_worthy_checklist",
              propositionStrength: "strong",
              audienceProblem: "언제 잡을지",
              audienceTension: "기다리면 싸질까",
              supportedClaimBoundaryUsed: "공개 관찰",
              limitations: [],
              proofRequirements: [],
            },
          }
        : {}),
    },
    selectedAgenda: {
      id: "ag_orch",
      title: "푸꾸옥",
      destinations: ["푸꾸옥"],
      entities: [],
      summary: "요약",
      timelinessNote: null,
      evidenceRefs: [],
    },
    governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
    draft: { title: "t", body: "b", channel: "threads" },
    provenance: { governanceReviewId: "gov_orch" },
    canonicalMarketingAsset: asset,
  } as unknown as CompletedMarketingCandidate;
}

function readBundle(packageRoot: string): PublishableContentBundle {
  return JSON.parse(
    readFileSync(join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH), "utf8"),
  ) as PublishableContentBundle;
}

function threadsJson(body: string) {
  return JSON.stringify({ title: "스레드 제목", body });
}

function blogJson(body: string) {
  return JSON.stringify({
    selectedTitle: "블로그 제목",
    titleCandidates: ["블로그 제목", "대안1", "대안2"],
    primaryTopic: "푸꾸옥 호텔",
    searchIntent: "정보",
    sectionPlan: ["도입", "본문", "정리"],
    faq: [],
    bodyMarkdown: body,
    cta: "조건을 비교해 보세요",
  });
}

describe("channel orchestration — approve vs generate split", () => {
  it("A. Canonical approve does not invoke channel composers", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_orch");
    mkdirSync(join(packageRoot, "context"), { recursive: true });

    const draft = durableAsset();
    persistCanonicalAssetToPackage({ packageRoot, asset: draft });
    const repo = createInMemoryDailyMarketingRunRepository();
    const candidate = candidateStub(draft, { withProposition: false });
    await repo.saveCandidate(candidate);

    const result = await approveCanonicalAsset({
      candidate,
      runRepo: repo,
      mode: "ai_original",
      approvedBy: "tester",
    });

    expect(result.asset.status).toBe("approved");
    const bundle = readBundle(packageRoot);
    expect(bundle.contract).toBe(PUBLISHABLE_CONTENT_BUNDLE_CONTRACT);
    expect(bundle.threads.status).toBe("not_generated");
    expect(bundle.threads.body).toBe("");
    expect(bundle.shortform.status).toBe("not_generated");
    expect(bundle.naver_blog?.status).toBe("not_generated");
    expect(bundle.instagram?.status).toBe("not_generated");
    // No LLM bodies invented at approve time.
    expect(
      [bundle.threads, bundle.shortform, bundle.naver_blog, bundle.naver_band, bundle.kakao_channel, bundle.instagram]
        .filter(Boolean)
        .every((slot) => !slot!.body?.trim()),
    ).toBe(true);
  });

  it("B/C. Generate one channel leaves siblings unchanged; second channel independent", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_orch");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seedApprovedEmptyWorkspace({ packageRoot });

    let calls = 0;
    const invoke = async (prompt: unknown) => {
      calls += 1;
      const text =
        typeof prompt === "string"
          ? prompt
          : prompt && typeof prompt === "object" && "text" in prompt
            ? String((prompt as { text: string }).text)
            : "";
      if (text.includes("Naver Blog") || text.includes("naver_blog") || text.includes("bodyMarkdown")) {
        return blogJson(
          "## 도입\n\n푸꾸옥 객실 공급이 늘고 있다는 관찰이 있습니다.\n\n## 본문\n\n취소 조건은 상품마다 다릅니다.\n\n## 정리\n\n조건을 비교해 보세요.",
        );
      }
      return threadsJson(
        "푸꾸옥 객실 공급이 늘고 있다는 관찰이 있습니다.\n\n취소 조건은 상품마다 다릅니다.\n\n출발 전에 조건을 비교해 보세요.",
      );
    };

    const afterThreads = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "threads",
      invoke,
      approvedCanonicalAsset: approved,
    });
    expect(afterThreads.threads.status).toBe("generated");
    expect(afterThreads.threads.body.length).toBeGreaterThan(20);
    expect(afterThreads.shortform.status).toBe("not_generated");
    expect(afterThreads.naver_blog?.status).toBe("not_generated");
    const threadsBody = afterThreads.threads.body;
    const callsAfterThreads = calls;

    const afterBlog = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "naver_blog",
      invoke,
      approvedCanonicalAsset: approved,
    });
    expect(afterBlog.naver_blog?.status).toBe("generated");
    expect(afterBlog.threads.body).toBe(threadsBody);
    expect(afterBlog.shortform.status).toBe("not_generated");
    expect(calls).toBeGreaterThan(callsAfterThreads);
  });

  it("D. Regenerate threads updates only threads; Canonical unchanged", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_orch");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seedApprovedEmptyWorkspace({ packageRoot });

    const first = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "threads",
      invoke: async () => threadsJson("첫 번째 스레드 본문입니다. 공급과 취소 조건을 함께 보세요."),
      approvedCanonicalAsset: approved,
    });
    const blogKeep = first.naver_blog;

    const second = await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "threads",
      invoke: async () => threadsJson("두 번째 스레드 본문입니다. 공급과 취소 조건을 함께 보세요."),
      approvedCanonicalAsset: approved,
    });
    expect(second.threads.body).toContain("두 번째");
    expect(second.naver_blog?.status).toBe(blogKeep?.status);
    const assetOnDisk = JSON.parse(
      readFileSync(join(packageRoot, "context/canonical-marketing-asset.json"), "utf8"),
    ) as CanonicalMarketingAsset;
    expect(assetOnDisk.approvedVersion).toBe(approved.approvedVersion);
    expect(assetOnDisk.bodyKo).toBe(approved.bodyKo);
  });

  it("E. New Canonical revision marks prior channel stale without auto-regen", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_orch");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const v1 = seedApprovedEmptyWorkspace({ packageRoot });

    await generateChannelAsset({
      candidate: candidateStub(v1),
      packageRoot,
      channel: "threads",
      invoke: async () =>
        threadsJson("v2 기준 스레드입니다. 공급과 취소 조건을 함께 보세요."),
      approvedCanonicalAsset: v1,
    });
    const before = readBundle(packageRoot);
    expect(before.threads.sourceAssetVersion).toBe(v1.approvedVersion);
    expect(before.threads.stale).toBeFalsy();

    const edited = applyHumanCanonicalAssetEdit({
      asset: v1,
      edits: {
        titleKo: "v3 제목",
        bodyKo: v1.bodyKo,
        openingHookKo: v1.openingHookKo,
        decisionGuidanceKo: v1.decisionGuidanceKo,
        keyTakeawaysKo: v1.keyTakeawaysKo,
      },
    });
    persistCanonicalAssetToPackage({ packageRoot, asset: edited });
    const repo = createInMemoryDailyMarketingRunRepository();
    await repo.saveCandidate(candidateStub(edited, { withProposition: false }));
    const result = await approveCanonicalAsset({
      candidate: candidateStub(edited, { withProposition: false }),
      runRepo: repo,
      mode: "human_edited",
      approvedBy: "tester",
    });
    expect(result.asset.approvedVersion).toBeGreaterThan(v1.approvedVersion ?? 0);
    expect(result.bundle.threads.body).toContain("v2 기준");
    expect(result.bundle.threads.sourceAssetVersion).toBe(v1.approvedVersion);
    expect(result.bundle.threads.stale).toBe(true);
    expect(result.staleChannels).toContain("threads");
  });

  it("F. Channel failure isolates — other slots preserved", async () => {
    const assetRoot = tempRoot();
    process.env.MARKETING_ASSET_ROOT = assetRoot;
    const packageRoot = join(assetRoot, "2026", "09", "18", "cmc_orch");
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    const approved = seedApprovedEmptyWorkspace({ packageRoot });

    await generateChannelAsset({
      candidate: candidateStub(approved),
      packageRoot,
      channel: "threads",
      invoke: async () =>
        threadsJson("성공한 스레드 본문입니다. 공급과 취소 조건을 함께 보세요."),
      approvedCanonicalAsset: approved,
    });
    const threadsBefore = readBundle(packageRoot).threads.body;

    const failed = await ensurePublishableContent({
      candidate: candidateStub(approved),
      packageRoot,
      forceRegenerateChannels: ["instagram"],
      allowDeterministicFallback: false,
      approvedCanonicalAsset: approved,
      invoke: async () => {
        throw new Error("instagram_composer_boom");
      },
      persist: true,
    });
    expect(failed.threads.body).toBe(threadsBefore);
    expect(failed.instagram?.publishableSuccess).not.toBe(true);
    const assetOnDisk = JSON.parse(
      readFileSync(join(packageRoot, "context/canonical-marketing-asset.json"), "utf8"),
    ) as CanonicalMarketingAsset;
    expect(assetOnDisk.status).toBe("approved");
  });

  it("instagram is included in stale CHANNEL_KEYS marking", () => {
    const approved = approveCanonicalMarketingAsset({
      asset: durableAsset({ version: 2, approvedVersion: 2 }),
      mode: "ai_original",
      approvedBy: "tester",
    });
    const bundle = {
      contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
      candidateId: "c",
      businessDateKst: "2026-09-18",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceRevision: "r",
      targetChannels: ["threads", "instagram"] as const,
      threads: {
        status: "generated",
        body: "x",
        sourceAssetId: approved.assetId,
        sourceAssetVersion: 1,
        stale: false,
      },
      shortform: {
        status: "not_generated",
        body: "",
        sourceAssetId: null,
        sourceAssetVersion: null,
        stale: false,
      },
      instagram: {
        status: "generated",
        body: "ig",
        sourceAssetId: approved.assetId,
        sourceAssetVersion: 1,
        stale: false,
      },
    } as unknown as PublishableContentBundle;

    const marked = markPublishableBundleStaleForAsset(bundle, approved);
    expect(marked.instagram?.stale).toBe(true);
    expect(marked.threads.stale).toBe(true);
    expect(marked.shortform.stale).toBe(false);
  });
});
