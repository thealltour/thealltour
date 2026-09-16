import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  ASSET_SOURCE_WRITER_ROLE,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import {
  attachCanonicalAssetToCandidate,
  persistCanonicalAssetToPackage,
  readCanonicalAssetFromPackage,
  resolveCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/persistence";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cma-sot-"));
  tempDirs.push(dir);
  return dir;
}

function durableAsset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_test_sot",
    version: 1,
    status: "draft",
    agendaId: "ag_sot",
    storyPointId: "sp_sot",
    storyPointHash: "hash_sot",
    evidenceBriefRef: "ebr_sot",
    evidenceRevision: "ev_rev_sot",
    contentPropositionRef: "content-proposition-v1",
    propositionRevision: "prop_rev_sot",
    sourceRevision: "src_rev_sot",
    titleKo: "호텔 늘어나는 푸꾸옥, 지금 잡을까 더 기다릴까",
    dekKo: "공급과 취소 조건을 함께 보자",
    openingHookKo: "공급이 늘면 무조건 기다려야 할까.",
    bodyKo:
      "푸꾸옥의 객실 공급이 늘고 있다는 관찰만으로 요금이 내려간다고 단정할 수는 없습니다. 성수기와 취소 조건을 함께 봐야 합니다. 출발이 임박했다면 확보를, 여유 있다면 관망을 선택하세요.",
    keyTakeawaysKo: ["공급 증가만으로 가격 하락을 단정하지 말 것", "취소 조건을 먼저 확인할 것"],
    decisionGuidanceKo: "출발 시기와 취소 조건이 맞으면 확보를, 아니면 관망을 선택하세요.",
    optionalCtaIntentKo: "일정 기준으로 조건을 비교해 보세요",
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "공급 관찰" }],
    limitationsKo: ["요금 하락을 보장하지 않음"],
    forbiddenClaimsKo: ["무조건 싸진다"],
    supportedClaimBoundaryKo: "공개된 공급·경쟁 관찰 범위",
    unresolvedQuestionsKo: [],
    storySupportVerdict: "PARTIALLY_SUPPORTED",
    generatedAt: "2026-09-16T00:00:00.000Z",
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
): CompletedMarketingCandidate {
  return {
    candidateId: "cmc_test_sot",
    businessDateKst: "2026-09-16",
    logicalRunKey: "lrk_test_sot",
    runId: "run_test_sot",
    status: "needs_human_review",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
    contract: "completed-marketing-candidate-v1",
    contentAssignment: {
      topic: "푸꾸옥 호텔",
      audience: "해외여행 예정자",
      commercialIntent: "informational",
      facts: [],
    },
    contentPlan: {
      keyMessage: "판단",
      hook: null,
      targetChannels: ["threads"],
      factsToAvoid: [],
    },
    selectedAgenda: {
      title: "푸꾸옥",
      destinations: ["푸꾸옥"],
      entities: [],
      summary: "요약",
      timelinessNote: null,
    },
    governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
    draft: { title: "t", body: "b", channel: "threads" },
    canonicalMarketingAsset: asset,
  } as unknown as CompletedMarketingCandidate;
}

describe("canonical asset SoT → channel generation gate", () => {
  it("saveCandidate upserts canonicalMarketingAsset onto an existing candidate", async () => {
    const repo = createInMemoryDailyMarketingRunRepository();
    const draft = durableAsset();
    const first = attachCanonicalAssetToCandidate(candidateStub(null), draft);
    await repo.saveCandidate(first);

    const edited = applyHumanCanonicalAssetEdit({
      asset: draft,
      edits: {
        titleKo: "사람이 저장한 제목",
        bodyKo: draft.bodyKo,
        openingHookKo: draft.openingHookKo,
        decisionGuidanceKo: draft.decisionGuidanceKo,
        keyTakeawaysKo: draft.keyTakeawaysKo,
      },
    });
    const second = attachCanonicalAssetToCandidate(first, edited);
    const saved = await repo.saveCandidate(second);

    expect(saved.canonicalMarketingAsset?.status).toBe("human_edited");
    expect(saved.canonicalMarketingAsset?.titleKo).toBe("사람이 저장한 제목");
    expect(saved.canonicalMarketingAsset?.version).toBe(2);

    const reloaded = await repo.findCandidateByCandidateId("cmc_test_sot");
    expect(reloaded?.canonicalMarketingAsset?.titleKo).toBe("사람이 저장한 제목");
  });

  it("resolveCanonicalMarketingAsset prefers package durable SoT over stale candidate", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(join(packageRoot, "context"), { recursive: true });

    const staleCandidateAsset = durableAsset({ titleKo: "후보에만 남은 옛 제목", status: "draft" });
    const packageAsset = applyHumanCanonicalAssetEdit({
      asset: durableAsset(),
      edits: {
        titleKo: "패키지에 저장된 수정본 제목",
        bodyKo: durableAsset().bodyKo,
        openingHookKo: durableAsset().openingHookKo,
        decisionGuidanceKo: durableAsset().decisionGuidanceKo,
        keyTakeawaysKo: durableAsset().keyTakeawaysKo,
      },
    });
    persistCanonicalAssetToPackage({ packageRoot, asset: packageAsset });
    expect(readCanonicalAssetFromPackage(packageRoot)?.titleKo).toBe("패키지에 저장된 수정본 제목");

    const resolved = resolveCanonicalMarketingAsset({
      candidate: candidateStub(staleCandidateAsset),
      packageRoot,
    });
    expect(resolved?.titleKo).toBe("패키지에 저장된 수정본 제목");
    expect(resolved?.status).toBe("human_edited");
  });

  it("unapproved package asset blocks channel generation; approved package asset is SoT", async () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(join(packageRoot, "context"), { recursive: true });

    const edited = applyHumanCanonicalAssetEdit({
      asset: durableAsset(),
      edits: {
        titleKo: "승인 대기 수정본",
        bodyKo: durableAsset().bodyKo,
        openingHookKo: durableAsset().openingHookKo,
        decisionGuidanceKo: durableAsset().decisionGuidanceKo,
        keyTakeawaysKo: durableAsset().keyTakeawaysKo,
      },
    });
    persistCanonicalAssetToPackage({ packageRoot, asset: edited });
    expect(readCanonicalAssetFromPackage(packageRoot)?.status).toBe("human_edited");

    await expect(
      ensurePublishableContent({
        candidate: candidateStub(null),
        packageRoot,
        invoke: async () => {
          throw new Error("should_not_invoke");
        },
        persist: false,
      }),
    ).rejects.toMatchObject({ message: "canonical_asset_unapproved" });

    const approved = approveCanonicalMarketingAsset({
      asset: edited,
      mode: "human_edited",
      approvedBy: "tester",
    });
    persistCanonicalAssetToPackage({ packageRoot, asset: approved });

    let promptSawApprovedTitle = false;
    const bundle = await ensurePublishableContent({
      candidate: candidateStub(null),
      packageRoot,
      approvedCanonicalAsset: approved,
      forceRegenerate: true,
      explicitTargetChannels: ["threads"],
      persist: false,
      invoke: async (prompt) => {
        const text =
          typeof prompt === "string"
            ? prompt
            : prompt && typeof prompt === "object" && "text" in prompt
              ? String((prompt as { text: string }).text)
              : "";
        if (text.includes(approved.titleKo)) promptSawApprovedTitle = true;
        return JSON.stringify({
          title: approved.titleKo,
          body: `${approved.bodyKo}\n\n채널용으로 다듬은 문장입니다.`,
        });
      },
    });

    expect(bundle.sourceAssetVersion).toBe(approved.approvedVersion);
    expect(promptSawApprovedTitle || bundle.threads.title === approved.titleKo).toBe(true);
  });
});
