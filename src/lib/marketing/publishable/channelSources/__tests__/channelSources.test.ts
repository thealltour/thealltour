import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPackage = vi.hoisted(() => ({ packageRoot: "" }));

vi.mock("@/lib/marketing/assets/candidateAssetPackageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketing/assets/candidateAssetPackageService")>();
  return {
    ...actual,
    inspectCandidateAssetPackage: async ({ candidateId }: { candidateId: string }) => ({
      ok: true,
      candidate: { candidateId },
      inspection: { status: "present", packageRoot: mockPackage.packageRoot },
    }),
  };
});

import { generateChannelAsset } from "@/lib/marketing/canonicalAsset/approveAndGenerateChannels";
import {
  CANONICAL_MARKETING_ASSET_CONTRACT,
  type CanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/contracts";
import { persistCanonicalAssetToPackage } from "@/lib/marketing/canonicalAsset/persistence";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { buildChannelWorkspaceAfterCanonicalApprove } from "@/lib/marketing/publishable/channelWorkspace";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
import {
  persistInstagramVisualRolePlan,
  readInstagramVisualRolePlanFromPackage,
} from "@/lib/marketing/publishable/instagramVisualRole/persist";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import type { VisualRoleArchitectInvoke } from "@/lib/marketing/publishable/instagramVisualRole/pipeline";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { resolveSharedVisualPlanLifecycle } from "@/lib/marketing/publishable/visualOrchestration/lifecycle";
import {
  generateAstraHandoffForCandidate,
  generateSharedVisualPlanForCandidate,
} from "@/lib/marketing/publishable/visualOrchestration/operatorService";
import {
  isSharedVisualPlanStaleOnlyFromInstagramCardCopy,
  resolveSharedVisualPlanLifecycleForPackage,
} from "@/lib/marketing/publishable/visualOrchestration/packageLifecycle";
import { EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT } from "@/lib/marketing/editorialDirector/researchHandoff/contracts";
import { INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT } from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/contracts";
import {
  applyExternalCandidateToAllChannels,
  CHANNEL_SOURCE_SELECTION_RELATIVE_PATH,
  EXTERNAL_EDITORIAL_MODEL_PROFILE,
  ExternalEditorialCandidateExistsError,
  importExternalEditorialResult,
  importInstagramCardnewsResult,
  listChannelSourceViews,
  readChannelSourceSelection,
  readExternalEditorialCandidate,
  reconcileChannelSourceSelection,
  resolveExternalInstagramCoverTitleSuggestion,
  resolveInstagramNarrativeForVisualPlanning,
  selectChannelSource,
  type ExternalEditorialCandidate,
  type SelectChannelSourceResult,
} from "@/lib/marketing/publishable/channelSources";
import { persistExternalEditorialCandidate } from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import { readHermesAutoSnapshot } from "@/lib/marketing/publishable/channelSources/hermesAutoSnapshot";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  formatForChannel,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH } from "@/lib/marketing/publishable/editorialNarrative/paths";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  materializeEditorialNarrativePlan,
  materializeInstagramCaption,
  materializeInstagramCardCopy,
  materializeInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  INSTAGRAM_CARD_COPY_RELATIVE_PATH,
  INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/instagramEditorial/paths";
import {
  persistEditorialNarrativePlan,
  persistInstagramCaption,
  persistInstagramCardCopy,
  persistInstagramCarouselPlan,
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  approveInstagramCardCopyReview,
  buildInstagramCardCopyReview,
  INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH,
  persistInstagramCardCopyReview,
  readInstagramCardCopyReviewFromPackage,
  resolveInstagramCardCopyReviewGate,
  updateInstagramCardCopyReviewDrafts,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { resolveInstagramVisualRolePlanLifecycle } from "@/lib/marketing/publishable/instagramVisualRole/lifecycle";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { computeChannelContentFingerprint } from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";
import { materializeThreadsCopy } from "@/lib/marketing/publishable/threadsCopy/materialize";
import { THREADS_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/threadsCopy/paths";
import { persistThreadsCopy, readThreadsCopyFromPackage } from "@/lib/marketing/publishable/threadsCopy/persist";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

const CANDIDATE_ID = "cand_bkk_1";
const T0 = "2026-09-27T00:00:00.000Z";
const IMPORT_AT = new Date("2026-09-27T01:00:00.000Z");
const SWITCH_AT = new Date("2026-09-27T02:00:00.000Z");
const RESTORE_AT = new Date("2026-09-27T03:00:00.000Z");

function asset(overrides: Partial<CanonicalMarketingAsset> = {}): CanonicalMarketingAsset {
  return {
    contract: CANONICAL_MARKETING_ASSET_CONTRACT,
    assetId: "cma_rev123",
    version: 3,
    status: "approved",
    agendaId: "ag_bangkok",
    storyPointId: "sp_bangkok_hotel",
    storyPointHash: "sph_1",
    evidenceBriefRef: null,
    evidenceRevision: "evr_1",
    contentPropositionRef: null,
    propositionRevision: "prr_1",
    sourceRevision: "rev123",
    titleKo: "방콕 가족여행, 호텔 등급보다 위치를 먼저",
    dekKo: null,
    openingHookKo: "등급만 올리면 편해질 것 같다는 직관이 틀릴 때가 있습니다.",
    bodyKo: "수쿰빗·실롬처럼 지역에 따라 BTS 접근성 차이가 뚜렷합니다.",
    keyTakeawaysKo: ["지역별 BTS 접근성부터 비교한다"],
    decisionGuidanceKo: "이동 동선을 먼저 적고 등급을 비교합니다.",
    optionalCtaIntentKo: null,
    evidenceRefs: [{ evidenceId: "ev1", noteKo: "지역별 접근성 관측" }],
    limitationsKo: [],
    forbiddenClaimsKo: [],
    supportedClaimBoundaryKo: null,
    unresolvedQuestionsKo: [],
    storySupportVerdict: null,
    generatedAt: "2026-09-26T00:00:00.000Z",
    editedAt: null,
    approvedAt: "2026-09-26T10:00:00.000Z",
    approvedVersion: 3,
    humanEdited: false,
    approvalSource: "ai_original",
    approvedBy: "ysh",
    generatedBy: "asset-source-writer",
    repairCount: 0,
    validationIssues: [],
    ...overrides,
  };
}

const SOURCE = {
  title: "BTS 노선 안내",
  publisher: "BTS Skytrain",
  date: "2026-01-10",
  url: "https://example.com/bts",
  sourceTier: "official",
};

function externalResult(identity: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
    candidateId: CANDIDATE_ID,
    assetId: "cma_rev123",
    canonicalVersion: 3,
    sourceRevision: "rev123",
    ...identity,
    research: {
      status: "completed",
      questions: ["지역별 BTS 접근성 차이가 큰가?"],
      findings: [
        {
          findingId: "F1",
          claim: "수쿰빗 일대 숙소 다수가 BTS 역 도보권에 있다",
          supportLevel: "verified",
          usableForEditorial: true,
          freshness: "2026-01",
          sources: [SOURCE],
        },
        {
          findingId: "F2",
          claim: "실롬 일부 숙소는 역까지 도보 10분 이상이다",
          supportLevel: "qualified",
          usableForEditorial: true,
          freshness: null,
          sources: [SOURCE],
        },
        {
          findingId: "F3",
          claim: "모든 5성급 호텔이 역과 멀다",
          supportLevel: "weak",
          usableForEditorial: false,
          freshness: null,
          sources: [SOURCE],
        },
      ],
      unresolved: [],
      canonicalConflicts: [],
    },
    narrative: {
      editorialArchetype: "counter_intuition",
      narrativePromise: "등급보다 위치를 먼저 보는 이유를 보여준다",
      audienceTakeaway: "부모님 동반이면 역 접근성을 먼저 비교한다",
      beats: [
        { beatId: "b1", purpose: "hook", message: "등급을 올려도 이동이 편해지지 않을 수 있다", evidenceRefs: ["ev1"] },
        { beatId: "b2", purpose: "evidence", message: "수쿰빗은 역 도보권 숙소가 많다", evidenceRefs: ["F1"] },
        { beatId: "b3", purpose: "payoff", message: "동선을 먼저 적고 등급을 비교한다", evidenceRefs: [] },
      ],
    },
    threads: {
      body:
        "부모님과 방콕에 갈 때 호텔 등급부터 올리면 편해질 것 같지만, 실제로는 역까지의 거리가 하루 피로를 더 크게 좌우합니다.\n\n수쿰빗처럼 BTS 역 도보권 숙소가 많은 지역은 이동이 단순해지고, 실롬 일부는 역까지 걷는 시간이 길어질 수 있습니다.\n\n등급표보다 동선표를 먼저 그려 보는 쪽이 부모님 여행에는 더 맞는 기준일지도 모릅니다.",
      selectedNarrativeBeats: ["b1", "b2"],
      endingIntent: "observation",
      evidenceRefs: ["F1", "F2", "ev1"],
    },
    instagram: {
      carouselPlan: {
        cards: [
          { cardId: "c1", role: "hook_cover", beatIds: ["b1"], communicationGoal: "등급 직관을 흔든다", visualPriority: "hero" },
          { cardId: "c2", role: "evidence", beatIds: ["b2"], communicationGoal: "역 도보권 차이를 보여준다", visualPriority: "strong" },
          { cardId: "c3", role: "closing", beatIds: ["b3"], communicationGoal: "동선 우선 기준을 정리한다", visualPriority: "useful" },
        ],
      },
      cardCopy: {
        cards: [
          { cardId: "c1", kicker: "방콕 가족여행", headline: "등급보다 위치가 먼저일 수 있다", body: null, microcopy: null, evidenceRefs: ["ev1"] },
          { cardId: "c2", kicker: null, headline: "수쿰빗은 역 도보권 숙소가 많다", body: "BTS 접근성이 이동 피로를 줄인다", microcopy: null, evidenceRefs: ["F1"] },
          { cardId: "c3", kicker: null, headline: "동선을 먼저 적고 등급을 비교", body: null, microcopy: "부모님 동반 기준", evidenceRefs: [] },
        ],
      },
      caption: {
        opening: "부모님과 방콕 여행이라면 호텔 등급보다 역까지의 거리를 먼저 보세요.",
        body: "수쿰빗처럼 BTS 역 도보권 숙소가 많은 지역은 하루 이동이 훨씬 단순해집니다.",
        cta: null,
        hashtags: ["#방콕여행", "#가족여행", "#방콕호텔"],
        altText: "방콕 BTS 노선과 숙소 위치를 비교한 카드뉴스",
      },
    },
    naverBlog: {
      structure: {
        titleStrategy: "question",
        selectedTitle: "방콕 가족여행 숙소, 등급보다 위치를 먼저 봐야 하는 이유",
        titleCandidates: ["방콕 가족여행 숙소, 등급보다 위치를 먼저 봐야 하는 이유", "부모님과 방콕, 호텔 위치 고르는 기준"],
        sectionPlan: [
          { sectionId: "s1", purpose: "opening", heading: "등급을 올리면 편해질까", narrativeBeatRefs: ["b1"], evidenceRefs: ["ev1"], targetDepth: "brief" },
          { sectionId: "s2", purpose: "evidence", heading: "역 도보권이 만드는 차이", narrativeBeatRefs: ["b2"], evidenceRefs: ["F1"], targetDepth: "standard" },
          { sectionId: "s3", purpose: "closing", heading: "동선부터 적어 보기", narrativeBeatRefs: ["b3"], evidenceRefs: [], targetDepth: "brief" },
        ],
        openingIntent: "등급 직관을 질문으로 연다",
        conclusionIntent: "동선 우선 기준으로 정리한다",
        ctaIntent: null,
        faqPlan: [
          { question: "수쿰빗이 항상 더 나은가요?", answerability: "supported" },
          { question: "조식 가격은 얼마인가요?", answerability: "unsupported" },
        ],
        searchIntent: "방콕 가족여행 숙소 위치",
        primaryTopic: "방콕 가족여행 숙소",
        evidenceCoverage: "canonical+research",
      },
      copy: {
        title: "방콕 가족여행 숙소, 등급보다 위치를 먼저 봐야 하는 이유",
        bodyMarkdown:
          "# 방콕 가족여행 숙소, 등급보다 위치를 먼저 봐야 하는 이유\n\n## 등급을 올리면 편해질까\n\n부모님과의 방콕 여행에서는 호텔 등급이 편안함을 보장하지 않을 때가 있습니다.\n\n## 역 도보권이 만드는 차이\n\n수쿰빗처럼 BTS 역 도보권 숙소가 많은 지역은 하루 이동이 단순해집니다.\n\n## 동선부터 적어 보기\n\n가고 싶은 곳을 먼저 적고, 그 동선에 맞는 숙소 등급을 비교해 보는 순서가 좋습니다.",
        sectionOutputs: [
          { sectionId: "s1", heading: "등급을 올리면 편해질까", bodyMarkdown: "부모님과의 방콕 여행에서는 호텔 등급이 편안함을 보장하지 않을 때가 있습니다." },
          { sectionId: "s2", heading: "역 도보권이 만드는 차이", bodyMarkdown: "수쿰빗처럼 BTS 역 도보권 숙소가 많은 지역은 하루 이동이 단순해집니다." },
          { sectionId: "s3", heading: "동선부터 적어 보기", bodyMarkdown: "가고 싶은 곳을 먼저 적고, 그 동선에 맞는 숙소 등급을 비교해 보는 순서가 좋습니다." },
        ],
        faq: [{ question: "수쿰빗이 항상 더 나은가요?", answer: "동선에 따라 다르지만 역 접근성이 좋은 편입니다." }],
        cta: null,
        evidenceRefs: ["ev1", "F1"],
      },
    },
    naverBand: {
      title: "방콕 숙소, 등급보다 위치",
      body:
        "부모님과 방콕을 준비하면서 호텔 등급부터 고르고 계신가요?\n\n수쿰빗처럼 BTS 역 도보권 숙소가 많은 곳은 이동이 단순하고, 실롬 일부는 역까지 걷는 시간이 길 수 있습니다.\n\n여러분은 숙소를 고를 때 무엇을 먼저 보시는지 궁금합니다.",
      selectedNarrativeBeats: ["b1", "b2"],
      openingIntent: "shared_context",
      keyPoints: ["역 도보권 여부", "하루 이동 동선"],
      endingIntent: "soft_question",
      engagementIntent: "숙소 고르는 기준 나누기",
      evidenceRefs: ["F1"],
    },
    kakao: {
      title: "방콕 숙소 고르는 순서",
      body: "부모님과 방콕에 가신다면 호텔 등급보다 BTS 역까지의 거리를 먼저 확인해 보세요. 수쿰빗은 역 도보권 숙소가 많아 이동이 단순합니다.",
    },
    shortform: {
      body: "호텔 등급을 올리면 편할까요? 방콕에서는 역까지의 거리가 더 중요할 수 있습니다. 동선을 먼저 적고 등급을 비교해 보세요.",
      segments: [
        { narrationText: "호텔 등급을 올리면 편할까요?", purpose: "hook", visualIntent: "방콕 호텔 로비" },
        { narrationText: "방콕에서는 역까지의 거리가 더 중요할 수 있습니다.", purpose: "evidence", visualIntent: "BTS 역과 숙소 거리" },
        { narrationText: "동선을 먼저 적고 등급을 비교해 보세요.", purpose: "payoff", visualIntent: "지도 위 동선" },
      ],
    },
  };
}

function hermesSlot(channel: PublishableChannel, body: string): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel,
    format: formatForChannel(channel),
    title: null,
    body,
    status: "generated",
    generatedAt: T0,
    sourceCandidateId: CANDIDATE_ID,
    sourceRevision: "bundle_rev_1",
    provenance: {
      composer: "llm",
      evidenceRefIds: ["ev1"],
      commercialIntent: "informational",
      generationMode: "llm",
      modelProfile: "hermes",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    needsRegeneration: false,
    sourceAssetId: "cma_rev123",
    sourceAssetVersion: 3,
    stale: false,
  };
}

function review(overrides: Partial<HumanMarketingReview> = {}): HumanMarketingReview {
  return {
    reviewId: "rev_1",
    candidateId: CANDIDATE_ID,
    channelReviews: {
      threads: {
        channel: "threads",
        status: "needs_review",
        aiDraft: { title: null, body: "Hermes threads 본문" },
        humanDraft: null,
        validationWarnings: [],
        lastEditedAt: null,
        approvedAt: null,
        skippedAt: null,
        notes: "메모",
      },
    },
    updatedAt: T0,
    ...overrides,
  } as HumanMarketingReview;
}

let packageRoot: string;
const HERMES_NARRATIVE_BEATS = [
  { beatId: "h1", purpose: "hook", message: "Hermes 훅" },
  { beatId: "h2", purpose: "payoff", message: "Hermes 결론" },
];

function seedHermesPackage() {
  const hermesNarrative = materializeEditorialNarrativePlan({
    assetId: "cma_rev123",
    assetVersion: 3,
    sourceCanonicalFingerprint: "hermes_canon_fp",
    modelProfile: "editorial-narrative-planner",
    generatedAt: T0,
    llm: { narrativePromise: "Hermes 약속", audienceTakeaway: "Hermes 요지", beats: HERMES_NARRATIVE_BEATS },
  });
  persistEditorialNarrativePlan({ packageRoot, plan: hermesNarrative, createdAt: T0 });
  const narrativeFp = buildEditorialNarrativeContentFingerprint(hermesNarrative);

  persistThreadsCopy({
    packageRoot,
    copy: materializeThreadsCopy({
      assetId: "cma_rev123",
      assetVersion: 3,
      sourceNarrativeFingerprint: narrativeFp,
      narrative: hermesNarrative,
      generatedAt: T0,
      llm: { body: "Hermes threads 본문", selectedNarrativeBeats: ["h1"], endingIntent: "observation" },
    }),
    createdAt: T0,
  });

  const carousel = materializeInstagramCarouselPlan({
    assetId: "cma_rev123",
    assetVersion: 3,
    sourceNarrativeFingerprint: narrativeFp,
    modelProfile: "instagram-carousel-planner",
    generatedAt: T0,
    validBeatIds: new Set(["h1", "h2"]),
    minCards: 3,
    maxCards: 10,
    llm: {
      cards: [
        { cardId: "k1", role: "hook_cover", beatIds: ["h1"], communicationGoal: "g1" },
        { cardId: "k2", role: "context", beatIds: ["h1"], communicationGoal: "g2" },
        { cardId: "k3", role: "closing", beatIds: ["h2"], communicationGoal: "g3" },
      ],
    },
  });
  const cardCopy = materializeInstagramCardCopy({
    assetId: "cma_rev123",
    assetVersion: 3,
    sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
    modelProfile: "instagram-card-copy",
    generatedAt: T0,
    expectedCardIds: ["k1", "k2", "k3"],
    llm: { cards: [{ cardId: "k1", headline: "H1" }, { cardId: "k2", headline: "H2" }, { cardId: "k3", headline: "H3" }] },
  });
  const caption = materializeInstagramCaption({
    assetId: "cma_rev123",
    assetVersion: 3,
    sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
    modelProfile: "instagram-caption",
    generatedAt: T0,
    hashtagMax: 12,
    llm: { opening: "Hermes 오프닝", body: "Hermes 캡션", cta: null, hashtags: ["#a", "#b", "#c"], altText: "alt" },
  });
  persistInstagramCarouselPlan({ packageRoot, plan: carousel, createdAt: T0 });
  persistInstagramCardCopy({ packageRoot, copy: cardCopy, createdAt: T0 });
  persistInstagramCaption({ packageRoot, caption, createdAt: T0 });

  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: CANDIDATE_ID,
    businessDateKst: "2026-09-27",
    generatedAt: T0,
    sourceRevision: "bundle_rev_1",
    targetChannels: ["threads", "shortform", "instagram"],
    threads: hermesSlot("threads", "Hermes threads 본문"),
    shortform: hermesSlot("shortform", "Hermes shortform 본문"),
    instagram: hermesSlot("instagram", "Hermes 인스타 캡션"),
  };
  persistPublishableContentBundle({ packageRoot, bundle, createdAt: T0 });
}

function readRaw(relativePath: string): string {
  return readFileSync(join(packageRoot, relativePath), "utf8");
}

function readBundle(): PublishableContentBundle {
  return JSON.parse(readRaw(PUBLISHABLE_CONTENT_RELATIVE_PATH)) as PublishableContentBundle;
}

function doImport(result: Record<string, unknown> = externalResult(), now = IMPORT_AT) {
  return importExternalEditorialResult({
    packageRoot,
    candidateId: CANDIDATE_ID,
    approvedCanonical: asset(),
    raw: JSON.stringify(result),
    importedBy: "ysh",
    now,
  });
}

function importOk(result?: Record<string, unknown>): ExternalEditorialCandidate {
  const out = doImport(result);
  if (!out.ok) throw new Error(`import failed: ${out.code} ${out.details.join("; ")}`);
  return out.candidate;
}

function select(
  channel: PublishableChannel,
  source: "hermes_auto" | "external_editorial",
  opts: { importId?: string; review?: HumanMarketingReview; allowOverwriteHuman?: boolean; now?: Date } = {},
): SelectChannelSourceResult {
  return selectChannelSource({
    packageRoot,
    candidateId: CANDIDATE_ID,
    approvedCanonical: asset(),
    channel,
    source,
    importId: opts.importId ?? null,
    selectedBy: "ysh",
    allowOverwriteHuman: opts.allowOverwriteHuman ?? false,
    review: opts.review ?? review(),
    now: opts.now ?? SWITCH_AT,
  });
}

function expectOk(result: SelectChannelSourceResult) {
  if (!result.ok) throw new Error(`select failed: ${result.code} ${result.details.join("; ")}`);
  return result;
}

beforeEach(() => {
  packageRoot = mkdtempSync(join(tmpdir(), "channel-sources-"));
  seedHermesPackage();
});

afterEach(() => {
  rmSync(packageRoot, { recursive: true, force: true });
});

describe("External Editorial import — strict parser", () => {
  it("imports a valid result as an immutable candidate with provenance and per-channel readiness", () => {
    const out = doImport();
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const c = out.candidate;
    expect(out.candidateRef).toBe(`context/channel-sources/external-editorial/${c.importId}.json`);
    expect(c.provider).toBe("chatgpt_manual");
    expect(c.importedAt).toBe(IMPORT_AT.toISOString());
    expect(c.resultContract).toBe(EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT);
    expect(c).toMatchObject({ candidateId: CANDIDATE_ID, assetId: "cma_rev123", canonicalVersion: 3, sourceRevision: "rev123" });
    for (const channel of ["threads", "instagram", "naver_blog", "naver_band", "kakao_channel", "shortform"] as const) {
      expect(c.channelReadiness[channel], channel).toEqual({ present: true, materializable: true, issues: [] });
    }
    expect(readExternalEditorialCandidate(packageRoot, c.importId)?.result).toEqual(externalResult());
    // Import never touches the materialized selected state.
    expect(readBundle().threads.body).toBe("Hermes threads 본문");
  });

  it("rejects malformed JSON", () => {
    const out = importExternalEditorialResult({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical: asset(),
      raw: "{ not json",
      importedBy: null,
      now: IMPORT_AT,
    });
    expect(out).toMatchObject({ ok: false, code: "invalid_json" });
  });

  it("accepts a single ```json fence", () => {
    const out = importExternalEditorialResult({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical: asset(),
      raw: "```json\n" + JSON.stringify(externalResult()) + "\n```",
      importedBy: null,
      now: IMPORT_AT,
    });
    expect(out.ok).toBe(true);
  });

  it("rejects contract mismatch", () => {
    expect(doImport({ ...externalResult(), contract: "editorial-research-bundle-chatgpt-handoff-v1" })).toMatchObject({
      ok: false,
      code: "contract_mismatch",
    });
  });

  it("rejects a result that belongs to another candidate", () => {
    const out = doImport({ ...externalResult(), candidateId: "cand_other" });
    expect(out).toMatchObject({ ok: false, code: "stale_identity" });
    if (!out.ok) expect(out.details).toContain("candidateId");
  });

  it.each([
    ["assetId", { assetId: "cma_other" }],
    ["canonicalVersion", { canonicalVersion: 2 }],
    ["sourceRevision", { sourceRevision: "rev_old" }],
  ])("imports a result built on another approved %s with a warning", (field, patch) => {
    const c = importOk({ ...externalResult(), ...patch });
    expect(c.warnings.some((w) => w.includes("다른 승인본 기준") && w.includes(field))).toBe(true);
  });

  it("rejects when the Canonical is not approved at the current version", () => {
    const out = importExternalEditorialResult({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical: asset({ version: 4, approvedVersion: 3 }),
      raw: JSON.stringify({ ...externalResult(), canonicalVersion: 4 }),
      importedBy: null,
      now: IMPORT_AT,
    });
    expect(out).toMatchObject({ ok: false, code: "canonical_not_approved" });
  });

  it("rejects a missing research object", () => {
    const result = externalResult();
    delete result.research;
    expect(doImport(result)).toMatchObject({ ok: false, code: "research_missing" });
  });

  it("rejects duplicate finding IDs", () => {
    const result = externalResult();
    const research = result.research as { findings: Array<Record<string, unknown>> };
    research.findings.push({ ...research.findings[0]! });
    expect(doImport(result)).toMatchObject({ ok: false, code: "duplicate_finding_id", details: ["F1"] });
  });

  it("imports unknown finding / evidence references with a warning", () => {
    const result = externalResult();
    (result.threads as Record<string, unknown>).evidenceRefs = ["F9"];
    const c = importOk(result);
    expect(c.warnings.some((w) => w.includes("알 수 없는") && w.includes("threads.evidenceRefs: F9"))).toBe(true);
    expect(c.channelReadiness.threads.materializable).toBe(true);
  });

  it.each([
    ["weak + unusable", { supportLevel: "weak", usableForEditorial: false }],
    ["conflicting", { supportLevel: "conflicting", usableForEditorial: true }],
    ["verified but unusable", { supportLevel: "verified", usableForEditorial: false }],
  ])("imports surface use of a %s finding with a warning", (_label, patch) => {
    const result = externalResult();
    const research = result.research as { findings: Array<Record<string, unknown>> };
    Object.assign(research.findings[0]!, patch);
    const c = importOk(result);
    expect(c.warnings.some((w) => w.includes("usableForEditorial=false"))).toBe(true);
  });

  it("allows qualified findings with a warning", () => {
    const c = importOk();
    expect(c.warnings.some((w) => w.includes("threads.evidenceRefs: F2") && w.includes("qualified"))).toBe(true);
  });

  it("imports channel artifacts even when research.status is blocked", () => {
    const result = externalResult();
    (result.research as Record<string, unknown>).status = "blocked";
    const c = importOk(result);
    expect(c.result.research).toMatchObject({ status: "blocked" });
    expect(c.warnings.some((w) => w.includes("blocked이지만 채널 결과를 그대로"))).toBe(true);
    for (const channel of ["threads", "instagram", "naver_blog", "naver_band", "kakao_channel", "shortform"] as const) {
      expect(c.channelReadiness[channel], channel).toMatchObject({ present: true, materializable: true });
    }
  });

  it("rejects findingIds that collide with Canonical evidence IDs", () => {
    const result = externalResult();
    const research = result.research as { findings: Array<Record<string, unknown>> };
    research.findings[2]!.findingId = "ev1";
    expect(doImport(result)).toMatchObject({ ok: false, code: "ambiguous_reference" });
  });

  it("clamps over-limit counts to the Hermes caps with warnings instead of blocking", () => {
    const result = externalResult();
    (result.naverBand as Record<string, unknown>).keyPoints = ["a", "b", "c", "d", "e"];
    ((result.instagram as Record<string, Record<string, unknown>>).caption).hashtags = Array.from(
      { length: 13 },
      (_, i) => `#태그${i}`,
    );
    (result.shortform as { segments: unknown[] }).segments = Array.from({ length: 9 }, (_, i) => ({
      narrationText: `문장 ${i}`,
      purpose: "body",
      visualIntent: "장면",
    }));
    ((result.naverBlog as Record<string, Record<string, unknown>>).structure).titleCandidates = [
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
      "t6",
    ];
    const c = importOk(result);
    for (const channel of ["naver_band", "instagram", "shortform", "naver_blog", "threads", "kakao_channel"] as const) {
      expect(c.channelReadiness[channel], channel).toMatchObject({ present: true, materializable: true });
    }
    for (const prefix of [
      "naverBand.keyPoints 5개",
      "instagram.caption.hashtags 13개",
      "shortform.segments 9개",
      "naverBlog.structure.titleCandidates 6개",
    ]) {
      expect(c.warnings.some((w) => w.startsWith(prefix)), prefix).toBe(true);
    }
    expect(c.result.naverBand).toMatchObject({ keyPoints: ["a", "b", "c", "d", "e"] });

    expectOk(select("shortform", "external_editorial", { importId: c.importId }));
    expect(readBundle().shortform.narrationSegments).toHaveLength(8);
  });

  it("keeps channels selectable exactly at the Hermes limits", () => {
    const result = externalResult();
    (result.naverBand as Record<string, unknown>).keyPoints = ["역 도보권", "하루 동선", "부모님 보행", "야간 이동"];
    ((result.instagram as Record<string, Record<string, unknown>>).caption).hashtags = Array.from(
      { length: 12 },
      (_, i) => `#방콕태그${i}`,
    );
    (result.shortform as { segments: unknown[] }).segments = Array.from({ length: 8 }, (_, i) => ({
      narrationText: `방콕 숙소는 역까지의 거리를 먼저 봅니다 ${i + 1}.`,
      purpose: "body",
      visualIntent: "방콕 도심 장면",
    }));
    ((result.naverBlog as Record<string, Record<string, unknown>>).structure).titleCandidates = [
      "방콕 가족여행 숙소, 등급보다 위치를 먼저 봐야 하는 이유",
      "t2",
      "t3",
      "t4",
      "t5",
    ];
    const c = importOk(result);
    for (const channel of ["naver_band", "instagram", "shortform", "naver_blog"] as const) {
      expect(c.channelReadiness[channel], channel).toMatchObject({ present: true, materializable: true });
    }
  });

  it("content-policy and publishable validation failures are warnings, and the channel still applies", () => {
    const result = externalResult();
    const overLimit = "방콕 숙소는 등급보다 역까지의 거리를 먼저 봅니다. ".repeat(20);
    (result.threads as Record<string, unknown>).body = overLimit;
    (result.kakao as Record<string, unknown>).body = "짧은 안내";
    const c = importOk(result);
    expect(c.channelReadiness.threads).toMatchObject({ present: true, materializable: true });
    expect(c.channelReadiness.kakao_channel).toMatchObject({ present: true, materializable: true });
    expect(c.warnings.some((w) => w.startsWith("threads 정책 경고:"))).toBe(true);
    expect(c.warnings.some((w) => w.startsWith("kakao 검증 경고:"))).toBe(true);

    const out = expectOk(select("threads", "external_editorial", { importId: c.importId }));
    expect(out.warnings.some((w) => w.startsWith("threads 정책 경고:"))).toBe(true);
    expect(readBundle().threads.body).toContain("방콕 숙소는 등급보다 역까지의 거리를 먼저 봅니다.");
    expect(readBundle().threads.body).not.toBe("Hermes threads 본문");
  });

  it("still rejects a channel whose shape cannot be materialized", () => {
    const result = externalResult();
    (result.kakao as Record<string, unknown>).body = "";
    const c = importOk(result);
    expect(c.channelReadiness.kakao_channel).toMatchObject({ present: true, materializable: false });
    expect(select("kakao_channel", "external_editorial", { importId: c.importId })).toMatchObject({
      ok: false,
      code: "channel_not_materializable",
    });
  });

  it("rejects the whole import when a research finding is malformed", () => {
    const result = externalResult();
    const research = result.research as { findings: Array<Record<string, unknown>> };
    research.findings[0]!.sources = [{ title: "제목만 있음" }];
    expect(doImport(result)).toMatchObject({ ok: false, code: "research_invalid" });
    const noStatus = externalResult();
    (noStatus.research as Record<string, unknown>).status = "maybe";
    expect(doImport(noStatus)).toMatchObject({ ok: false, code: "research_invalid" });
  });

  it("never overwrites an existing importId", () => {
    const c = importOk();
    const ref = `context/channel-sources/external-editorial/${c.importId}.json`;
    const before = readRaw(ref);
    expect(() =>
      persistExternalEditorialCandidate({ packageRoot, candidate: { ...c, warnings: ["changed"] } }),
    ).toThrow(ExternalEditorialCandidateExistsError);
    expect(readRaw(ref)).toBe(before);
  });
});

describe("Channel source selection", () => {
  it("switches Threads to External and restores Hermes losslessly", () => {
    const c = importOk();
    const hermesCopyBytes = readRaw(THREADS_COPY_RELATIVE_PATH);
    const hermesNarrativeBytes = readRaw(EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH);
    const hermesSlot = readBundle().threads;

    const ext = expectOk(select("threads", "external_editorial", { importId: c.importId }));
    expect(ext.changed).toBe(true);
    const slot = readBundle().threads;
    expect(slot.body).toBe((externalResult().threads as { body: string }).body);
    expect(slot.provenance).toMatchObject({
      composer: "llm",
      generationSource: "external_editorial",
      externalCandidateRef: `context/channel-sources/external-editorial/${c.importId}.json`,
      evidenceRefIds: ["ev1"],
    });
    expect(slot.generatedAt).toBe(SWITCH_AT.toISOString());
    expect(slot.sourceRevision).toBe("bundle_rev_1");
    expect(computeChannelContentFingerprint(slot)).not.toBe(computeChannelContentFingerprint(hermesSlot));

    const extCopy = readThreadsCopyFromPackage(packageRoot)!;
    expect(extCopy.provenance.modelProfile).toBe(EXTERNAL_EDITORIAL_MODEL_PROFILE);
    expect(extCopy.sourceNarrativeFingerprint).toBe(c.externalNarrativeFingerprint);
    expect(extCopy.evidenceRefs).toEqual(["F1", "F2", "ev1"]);
    expect(readRaw(EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH)).toBe(hermesNarrativeBytes);

    const record = readChannelSourceSelection(packageRoot)!.channels.threads!;
    expect(record).toMatchObject({
      selectedSource: "external_editorial",
      assetId: "cma_rev123",
      assetVersion: 3,
      selectedBy: "ysh",
      selectedAt: SWITCH_AT.toISOString(),
    });
    const snapshot = readHermesAutoSnapshot(packageRoot, record.hermesSnapshotRef)!;
    expect(snapshot.slot?.body).toBe("Hermes threads 본문");

    const back = expectOk(select("threads", "hermes_auto", { review: ext.review, now: RESTORE_AT }));
    expect(back.changed).toBe(true);
    const restored = readBundle().threads;
    expect(restored.body).toBe("Hermes threads 본문");
    expect(restored.generatedAt).toBe(RESTORE_AT.toISOString());
    expect(restored.provenance.generationSource).toBe("hermes_auto");
    expect(readRaw(THREADS_COPY_RELATIVE_PATH)).toBe(hermesCopyBytes);
    expect(back.review.channelReviews?.threads?.aiDraft.body).toBe("Hermes threads 본문");
  });

  it("keeps selection channel-specific", () => {
    const c = importOk();
    const before = readBundle();
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    const after = readBundle();
    expect(after.instagram).toEqual(before.instagram);
    expect(after.shortform).toEqual(before.shortform);
    expect(Object.keys(readChannelSourceSelection(packageRoot)!.channels)).toEqual(["threads"]);
    const views = listChannelSourceViews(packageRoot);
    expect(views.find((v) => v.channel === "threads")?.effectiveSource).toBe("external_editorial");
    expect(views.find((v) => v.channel === "instagram")?.effectiveSource).toBe("hermes_auto");
  });

  it("requires allowOverwriteHuman when a humanDraft exists, then clears it and syncs aiDraft", () => {
    const c = importOk();
    const withHuman = review();
    withHuman.channelReviews!.threads!.humanDraft = { title: null, body: "사람이 고친 본문" };
    const bundleBefore = readRaw(PUBLISHABLE_CONTENT_RELATIVE_PATH);

    const blocked = select("threads", "external_editorial", { importId: c.importId, review: withHuman });
    expect(blocked).toMatchObject({ ok: false, status: 409, code: "human_edited_channel_requires_confirm" });
    expect(readRaw(PUBLISHABLE_CONTENT_RELATIVE_PATH)).toBe(bundleBefore);
    expect(readChannelSourceSelection(packageRoot)).toBeNull();

    const ok = expectOk(
      select("threads", "external_editorial", { importId: c.importId, review: withHuman, allowOverwriteHuman: true }),
    );
    const entry = ok.review.channelReviews!.threads!;
    expect(entry.humanDraft).toBeNull();
    expect(entry.aiDraft).toEqual({ title: null, body: (externalResult().threads as { body: string }).body });
    expect(entry.status).toBe("needs_review");
    expect(entry.notes).toBe("메모");
    expect(ok.review.updatedAt).toBe(SWITCH_AT.toISOString());
  });

  function applyAll(importId: string, reviewIn: HumanMarketingReview = review()) {
    return applyExternalCandidateToAllChannels({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical: asset(),
      importId,
      selectedBy: "ysh",
      review: reviewIn,
      now: SWITCH_AT,
    });
  }

  it("applies every channel the candidate carries and overwrites human drafts", () => {
    const c = importOk();
    const withHuman = review();
    withHuman.channelReviews!.threads!.humanDraft = { title: null, body: "사람이 고친 본문" };

    const out = applyAll(c.importId, withHuman);
    expect(out.failed).toEqual([]);
    expect(out.applied).toEqual(["threads", "instagram", "naver_blog", "naver_band", "kakao_channel", "shortform"]);
    expect(out.reviewChanged).toBe(true);
    expect(out.review.channelReviews!.threads!.humanDraft).toBeNull();
    expect(out.review.channelReviews!.threads!.aiDraft?.body).toBe((externalResult().threads as { body: string }).body);

    const bundle = readBundle();
    for (const channel of out.applied) {
      expect(bundle[channel]?.provenance?.generationSource, channel).toBe("external_editorial");
    }
    const selection = readChannelSourceSelection(packageRoot)!;
    for (const channel of out.applied) {
      expect(selection.channels[channel]?.selectedSource, channel).toBe("external_editorial");
    }
  });

  it("skips channels without an artifact and reports per-channel failures without stopping", () => {
    const result = externalResult();
    result.naverBlog = null;
    (result.kakao as Record<string, unknown>).body = "";
    const c = importOk(result);

    const out = applyAll(c.importId);
    expect(out.applied).toEqual(["threads", "instagram", "naver_band", "shortform"]);
    expect(out.failed).toMatchObject([{ channel: "kakao_channel", code: "channel_not_materializable" }]);
    expect(readBundle().naver_blog).toBeUndefined();
    expect(readBundle().threads.provenance?.generationSource).toBe("external_editorial");
  });

  it("reports every channel as failed when the candidate file is missing", () => {
    const out = applyAll("xe_0000000000000_deadbeef00");
    expect(out.applied).toEqual([]);
    expect(out.reviewChanged).toBe(false);
    expect(out.failed.every((f) => f.code === "candidate_missing")).toBe(true);
    expect(readBundle().threads.body).toBe("Hermes threads 본문");
  });

  it("treats Instagram card copy edits as a human draft and never carries them to the new source", () => {
    const c = importOk();
    const hermesCardCopy = readInstagramCardCopyFromPackage(packageRoot)!;
    const cardCopyReview = updateInstagramCardCopyReviewDrafts({
      review: buildInstagramCardCopyReview({
        candidateId: CANDIDATE_ID,
        cardCopy: hermesCardCopy,
        carousel: readInstagramCarouselPlanFromPackage(packageRoot),
        source: { kind: "hermes_auto", candidateRef: null },
        updatedBy: "ysh",
        nowIso: T0,
      }),
      base: hermesCardCopy,
      edits: [{ cardId: "k1", headline: "사람이 고친 표지" }],
      updatedBy: "ysh",
      nowIso: T0,
    });
    persistInstagramCardCopyReview({ packageRoot, review: cardCopyReview });
    const withCardEdits = review();
    withCardEdits.channelReviews!.instagram = {
      channel: "instagram",
      status: "needs_review",
      aiDraft: { title: null, body: "Hermes 인스타 캡션" },
      humanDraft: null,
      validationWarnings: [],
      lastEditedAt: T0,
      approvedAt: null,
      skippedAt: null,
      notes: null,
      cardCopyReview,
    };

    const blocked = select("instagram", "external_editorial", { importId: c.importId, review: withCardEdits });
    expect(blocked).toMatchObject({ ok: false, status: 409, code: "human_edited_channel_requires_confirm" });
    expect(readInstagramCardCopyReviewFromPackage(packageRoot)).not.toBeNull();

    const ok = expectOk(
      select("instagram", "external_editorial", {
        importId: c.importId,
        review: withCardEdits,
        allowOverwriteHuman: true,
      }),
    );
    expect(ok.review.channelReviews!.instagram!.cardCopyReview).toBeUndefined();
    expect(readInstagramCardCopyReviewFromPackage(packageRoot)).toBeNull();
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("review_missing");
  });

  it("switches Instagram carousel+card-copy so VRA goes stale, and restore makes it fresh again", () => {
    const c = importOk();
    const hermesCarousel = readInstagramCarouselPlanFromPackage(packageRoot)!;
    const hermesCardCopy = readInstagramCardCopyFromPackage(packageRoot)!;
    const vra = {
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(hermesCarousel),
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(hermesCardCopy),
    } as InstagramVisualRolePlan;
    const lifecycle = () =>
      resolveInstagramVisualRolePlanLifecycle({
        plan: vra,
        carousel: readInstagramCarouselPlanFromPackage(packageRoot),
        cardCopy: readInstagramCardCopyFromPackage(packageRoot),
      });
    expect(lifecycle()).toBe("fresh");
    const carouselBytes = readRaw(INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH);
    const cardCopyBytes = readRaw(INSTAGRAM_CARD_COPY_RELATIVE_PATH);

    expectOk(select("instagram", "external_editorial", { importId: c.importId }));
    expect(lifecycle()).toBe("stale");
    const slot = readBundle().instagram!;
    expect(slot.instagramMeta?.cardPlan?.map((card) => card.cardId)).toEqual(["c1", "c2", "c3"]);
    expect(slot.body).toContain("#방콕여행");
    expect(readInstagramCarouselPlanFromPackage(packageRoot)!.sourceNarrativeFingerprint).toBe(
      c.externalNarrativeFingerprint,
    );
    expect(resolveInstagramNarrativeForVisualPlanning(packageRoot)?.beats.map((b) => b.beatId)).toEqual([
      "b1",
      "b2",
      "b3",
    ]);

    expectOk(select("instagram", "hermes_auto", { now: RESTORE_AT }));
    expect(lifecycle()).toBe("fresh");
    expect(readRaw(INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH)).toBe(carouselBytes);
    expect(readRaw(INSTAGRAM_CARD_COPY_RELATIVE_PATH)).toBe(cardCopyBytes);
    expect(resolveInstagramNarrativeForVisualPlanning(packageRoot)?.beats.map((b) => b.beatId)).toEqual([
      "h1",
      "h2",
    ]);
  });

  it("keeps both candidates available after switching back and forth", () => {
    const c = importOk();
    const candidateBytes = readRaw(`context/channel-sources/external-editorial/${c.importId}.json`);
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    const snapshotRef = readChannelSourceSelection(packageRoot)!.channels.threads!.hermesSnapshotRef!;
    expectOk(select("threads", "hermes_auto", { now: RESTORE_AT }));
    const again = expectOk(
      select("threads", "external_editorial", { importId: c.importId, now: new Date("2026-09-27T04:00:00.000Z") }),
    );
    expect(again.bundle.threads.provenance.generationSource).toBe("external_editorial");
    expect(readRaw(`context/channel-sources/external-editorial/${c.importId}.json`)).toBe(candidateBytes);
    const secondRef = readChannelSourceSelection(packageRoot)!.channels.threads!.hermesSnapshotRef!;
    expect(readHermesAutoSnapshot(packageRoot, snapshotRef)?.slot?.body).toBe("Hermes threads 본문");
    expect(readHermesAutoSnapshot(packageRoot, secondRef)?.slot?.body).toBe("Hermes threads 본문");
  });

  it("materializes Kakao/Shortform slots (with narrationSegments) and Band/Blog sidecars", () => {
    const c = importOk();
    expectOk(select("shortform", "external_editorial", { importId: c.importId }));
    const shortform = readBundle().shortform;
    expect(shortform.narrationSegments?.map((s) => [s.segmentId, s.purpose])).toEqual([
      ["narr-01", "hook"],
      ["narr-02", "evidence"],
      ["narr-03", "payoff"],
    ]);
    expectOk(select("kakao_channel", "external_editorial", { importId: c.importId }));
    expect(readBundle().kakao_channel?.title).toBe("방콕 숙소 고르는 순서");
    const blog = expectOk(select("naver_blog", "external_editorial", { importId: c.importId }));
    expect(blog.warnings.some((w) => w.includes("unsupported"))).toBe(true);
    expect(readBundle().naver_blog?.blogMeta?.faq).toHaveLength(1);
    expectOk(select("naver_band", "external_editorial", { importId: c.importId }));
    expect(readBundle().targetChannels).toEqual(
      expect.arrayContaining(["kakao_channel", "naver_blog", "naver_band"]),
    );

    // Optional slots absent before the switch are removed again on Hermes restore.
    expectOk(select("naver_band", "hermes_auto", { now: RESTORE_AT }));
    expect(readBundle().naver_band).toBeUndefined();
  });

  it("applies a candidate built on an older approved version with a warning", () => {
    const c = importOk();
    const drifted = selectChannelSource({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical: asset({ version: 4, approvedVersion: 4 }),
      channel: "threads",
      source: "external_editorial",
      importId: c.importId,
      selectedBy: null,
      allowOverwriteHuman: false,
      review: review(),
      now: SWITCH_AT,
    });
    expect(drifted.ok).toBe(true);
    if (drifted.ok) {
      expect(drifted.warnings.some((w) => w.includes("현재 승인본 v4 기준으로 적용"))).toBe(true);
    }
    expect(readBundle().threads.provenance?.generationSource).toBe("external_editorial");
  });

  it("fails closed on missing snapshots and missing channel artifacts", () => {
    const result = externalResult();
    result.kakao = null;
    const noKakao = importOk(result);
    expect(select("kakao_channel", "external_editorial", { importId: noKakao.importId })).toMatchObject({
      ok: false,
      code: "artifact_missing",
    });
    expect(select("threads", "external_editorial", { importId: "xe_0000000000000_deadbeef00" })).toMatchObject({
      ok: false,
      code: "candidate_missing",
    });

    const bundle = readBundle();
    bundle.threads = { ...bundle.threads, provenance: { ...bundle.threads.provenance, generationSource: "external_editorial" } };
    persistPublishableContentBundle({ packageRoot, bundle, createdAt: T0 });
    expect(select("threads", "hermes_auto")).toMatchObject({ ok: false, code: "hermes_snapshot_missing" });
  });

  it("never reports a selectedSource that differs from the slot, and reconcile heals the record", () => {
    const c = importOk();
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    const bundle = readBundle();
    bundle.threads = hermesSlot("threads", "Hermes 재생성 본문");
    bundle.threads.generatedAt = "2026-09-27T05:00:00.000Z";
    // Raw write without reconcile (e.g. interrupted process) — the view still follows the slot.
    persistPublishableContentBundle({ packageRoot, bundle, createdAt: T0 });
    const stale = listChannelSourceViews(packageRoot).find((v) => v.channel === "threads")!;
    expect(stale).toMatchObject({ selectedSource: "hermes_auto", effectiveSource: "hermes_auto", selectionInSync: false });

    const healed = reconcileChannelSourceSelection({ packageRoot, bundle, nowIso: "2026-09-27T05:00:01.000Z" });
    expect(healed.changedChannels).toEqual(["threads"]);
    expect(readChannelSourceSelection(packageRoot)!.channels.threads).toMatchObject({
      selectedSource: "hermes_auto",
      candidateRef: null,
      selectedBy: "system:hermes_regenerate",
      materializedGeneratedAt: "2026-09-27T05:00:00.000Z",
    });
    expect(listChannelSourceViews(packageRoot).find((v) => v.channel === "threads")!.selectionInSync).toBe(true);

    // Switching again snapshots the regenerated Hermes output, not the old one.
    expectOk(select("threads", "external_editorial", { importId: c.importId, now: RESTORE_AT }));
    const ref = readChannelSourceSelection(packageRoot)!.channels.threads!.hermesSnapshotRef;
    expect(readHermesAutoSnapshot(packageRoot, ref)?.slot?.body).toBe("Hermes 재생성 본문");
    expect(readRaw(CHANNEL_SOURCE_SELECTION_RELATIVE_PATH)).toContain("external_editorial");
  });

  it("keeps the base source for human edits and surfaces the active humanDraft", () => {
    const c = importOk();
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    const bundle = readBundle();
    bundle.threads = {
      ...bundle.threads,
      status: "human_edited",
      body: "사람이 다듬은 본문",
      provenance: { composer: "human", evidenceRefIds: [], commercialIntent: null, generationMode: "human" },
    };
    persistPublishableContentBundle({ packageRoot, bundle, createdAt: T0 });
    expect(reconcileChannelSourceSelection({ packageRoot, bundle, nowIso: RESTORE_AT.toISOString() }).changedChannels).toEqual([]);
    const withHuman = review();
    withHuman.channelReviews!.threads!.humanDraft = { title: null, body: "사람이 다듬은 본문" };
    const view = listChannelSourceViews(packageRoot, withHuman).find((v) => v.channel === "threads")!;
    expect(view).toMatchObject({
      selectedSource: "external_editorial",
      effectiveSource: "human_edited",
      selectionInSync: true,
      humanDraftActive: true,
    });
    // Human edit on top of External still restores the pre-External Hermes snapshot.
    const back = expectOk(select("threads", "hermes_auto", { review: withHuman, allowOverwriteHuman: true, now: RESTORE_AT }));
    expect(back.bundle.threads.body).toBe("Hermes threads 본문");
  });
});

describe("Hermes regenerate keeps selection equal to the materialized source", () => {
  function candidateStub(): CompletedMarketingCandidate {
    return {
      candidateId: CANDIDATE_ID,
      businessDateKst: "2026-09-27",
      logicalRunKey: "lrk_bkk",
      runId: "run_bkk",
      status: "needs_human_review",
      createdAt: T0,
      updatedAt: T0,
      contract: "completed-marketing-candidate-v1",
      contentAssignment: {
        assignmentId: "ca_bkk",
        topic: "방콕 가족여행 숙소",
        audience: "부모님 동반 여행자",
        commercialIntent: "informational",
        evidenceRefs: [],
        facts: [
          { statement: "수쿰빗 일대는 BTS 역 접근성이 좋습니다.", confidence: "medium", evidenceRefs: ["ev1"] },
          { statement: "실롬 일부 숙소는 역까지 거리가 있습니다.", confidence: "medium", evidenceRefs: ["ev1"] },
        ],
      },
      contentPlan: {
        keyMessage: "위치 우선",
        hook: null,
        targetChannels: ["threads", "shortform"],
        factsToAvoid: [],
        evidenceRefs: [],
        proposition: {
          contract: "content-proposition-v1",
          selectedAngleRef: "angle_1",
          contentPromise: "등급보다 위치를 먼저 보라",
          readerGain: "이동 피로를 줄인다",
          specificTakeaways: ["역 접근성", "동선"],
          desiredAudienceAction: "compare",
          engagementMechanism: "save_worthy_checklist",
          propositionStrength: "strong",
          audienceProblem: "숙소 선택",
          audienceTension: "등급을 올리면 편할까",
          supportedClaimBoundaryUsed: "공개 관찰",
          limitations: [],
          proofRequirements: [],
        },
      },
      selectedAgenda: {
        id: "ag_bangkok",
        title: "방콕",
        destinations: ["방콕"],
        entities: [],
        summary: "요약",
        timelinessNote: null,
        evidenceRefs: [],
      },
      governanceDecision: { decision: "ALLOW", unsupportedClaims: [] },
      draft: { title: "t", body: "b", channel: "threads" },
      provenance: { governanceReviewId: "gov_bkk" },
      canonicalMarketingAsset: asset(),
    } as unknown as CompletedMarketingCandidate;
  }

  const HERMES_BODY_1 =
    "부모님과 방콕에 가신다면 호텔 등급보다 BTS 역까지의 거리를 먼저 보세요.\n\n수쿰빗 일대는 역 접근성이 좋아 하루 이동이 단순해집니다.\n\n동선을 먼저 적어 두면 숙소 비교가 쉬워집니다.";
  const HERMES_BODY_2 =
    "방콕 숙소를 고를 때 등급표보다 지도를 먼저 펼쳐 보세요.\n\n실롬 일부 숙소는 역 접근성이 떨어져 부모님과 걷는 시간이 길어질 수 있습니다.\n\n가고 싶은 곳부터 동선으로 이어 보면 기준이 선명해집니다.";

  async function freshHermesPackage(): Promise<void> {
    rmSync(packageRoot, { recursive: true, force: true });
    packageRoot = mkdtempSync(join(tmpdir(), "channel-sources-regen-"));
    mkdirSync(join(packageRoot, "context"), { recursive: true });
    persistCanonicalAssetToPackage({ packageRoot, asset: asset() });
    persistPublishableContentBundle({
      packageRoot,
      bundle: buildChannelWorkspaceAfterCanonicalApprove({
        candidateId: CANDIDATE_ID,
        businessDateKst: "2026-09-27",
        sourceRevision: "rev123",
        contentPlanTargetChannels: ["threads", "shortform"],
        commercialIntent: "informational",
        approvedAsset: asset(),
        priorBundle: null,
        nowIso: T0,
      }),
      createdAt: T0,
    });
    const first = await regenerateThreads(async () => JSON.stringify({ title: "스레드", body: HERMES_BODY_1 }));
    expect(first.threads.provenance.composer).toBe("llm");
    expect(first.threads.publishableSuccess).toBe(true);
  }

  function regenerateThreads(invoke: PublishableLlmInvoke) {
    return generateChannelAsset({
      candidate: candidateStub(),
      packageRoot,
      channel: "threads",
      invoke,
      approvedCanonicalAsset: asset(),
      now: new Date("2026-09-27T06:00:00.000Z"),
    });
  }

  it("external selected → Hermes regenerate success → selectedSource=hermes_auto", async () => {
    await freshHermesPackage();
    const c = importOk();
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    expect(readChannelSourceSelection(packageRoot)!.channels.threads!.selectedSource).toBe("external_editorial");

    const after = await regenerateThreads(async () => JSON.stringify({ title: "스레드", body: HERMES_BODY_2 }));
    const slot = readBundle().threads;
    expect(
      after.threads.publishableSuccess,
      JSON.stringify({ p: after.threads.provenance, v: after.threads.validation, s: after.threads.status }),
    ).toBe(true);
    expect(slot.body).toContain("지도를 먼저");
    expect(slot.provenance.generationSource).toBeUndefined();

    const record = readChannelSourceSelection(packageRoot)!.channels.threads!;
    expect(record).toMatchObject({
      selectedSource: "hermes_auto",
      candidateRef: null,
      selectedBy: "system:hermes_regenerate",
      materializedGeneratedAt: slot.generatedAt,
      assetId: "cma_rev123",
      assetVersion: 3,
    });
    const view = listChannelSourceViews(packageRoot).find((v) => v.channel === "threads")!;
    expect(view).toMatchObject({ selectedSource: "hermes_auto", effectiveSource: "hermes_auto", selectionInSync: true });
    // External candidate survives the Hermes overwrite and can be selected again.
    expect(readExternalEditorialCandidate(packageRoot, c.importId)).not.toBeNull();
    expectOk(select("threads", "external_editorial", { importId: c.importId, now: RESTORE_AT }));
  });

  it("external selected → Hermes regenerate failure keeps the external slot and selection", async () => {
    await freshHermesPackage();
    const c = importOk();
    expectOk(select("threads", "external_editorial", { importId: c.importId }));
    const slotBefore = readBundle().threads;
    const recordBefore = readChannelSourceSelection(packageRoot)!.channels.threads;

    await regenerateThreads(async () => {
      throw new Error("hermes_unavailable");
    });
    const slot = readBundle().threads;
    expect(slot.body).toBe(slotBefore.body);
    expect(slot.provenance.generationSource).toBe("external_editorial");
    expect(readChannelSourceSelection(packageRoot)!.channels.threads).toEqual(recordBefore);
    const view = listChannelSourceViews(packageRoot).find((v) => v.channel === "threads")!;
    expect(view).toMatchObject({ selectedSource: "external_editorial", selectionInSync: true });
  });
});

describe("VRA → SVP → Astra Handoff on the External Instagram path", () => {
  const VRA_LLM = {
    rhythmSummary: "hero cover → bridge statement → closing mood",
    cards: [
      {
        cardId: "c1",
        visualRole: "hero_cover",
        visualPurpose: "등급 직관을 흔드는 방콕 도심 establishing",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent: "방콕 도심 BTS 고가 선로와 호텔 거리가 함께 보이는 establishing 풍경",
        evidenceRefs: [],
      },
      {
        cardId: "c2",
        visualRole: "bridge_statement",
        visualPurpose: "역 도보권 차이를 문구로 받치는 배경",
        visualPriority: "strong",
        visualDensity: "subtle",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "image_backed_statement",
        reusePreference: "derivative_ok",
        concreteVisualIntent: "역 출구에서 숙소 골목으로 이어지는 보행 동선 배경 — 텍스트가 주인공",
        evidenceRefs: [],
      },
      {
        cardId: "c3",
        visualRole: "closing_mood",
        visualPurpose: "동선 우선 기준의 차분한 마감",
        visualPriority: "optional",
        visualDensity: "balanced",
        visualModePreference: "atmosphere",
        generationPreference: "optional",
        presentationPreference: "background_mood",
        reusePreference: "derivative_ok",
        concreteVisualIntent: "해질녘 방콕 도심 지도와 선로가 겹치는 고요한 마감 분위기",
        evidenceRefs: [],
      },
    ],
  };
  const SVP_LLM = {
    strategySummary: "c1 hero는 전용 establishing, c2는 로컬 bridge 배경, c3는 생성 없는 closing mood.",
    decisionTrace: { overrides: [] },
    visuals: [
      {
        role: "context_cover",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent:
          "방콕 도심 BTS 고가 선로 아래 호텔 거리의 이동 동선을 차분한 여행 에디토리얼 톤으로 보여주는 wide establishing scene",
        usages: [{ channel: "instagram", cardId: "c1" }],
      },
      {
        role: "bridge",
        visualMode: "editorial_photo",
        generatedVisualNeeded: false,
        visualIntent: "역 출구에서 숙소 골목으로 이어지는 보행 동선을 살린 image-backed statement 배경",
        usages: [{ channel: "instagram", cardId: "c2" }],
      },
      {
        role: "closing",
        visualMode: "minimal_closing",
        generatedVisualNeeded: false,
        visualIntent: "해질녘 도심 선로가 겹치는 고요한 마감 분위기 — 동선 우선 기준 payoff mood",
        usages: [{ channel: "instagram", cardId: "c3" }],
      },
    ],
  };

  let hermesHome: string;
  beforeEach(() => {
    hermesHome = mkdtempSync(join(tmpdir(), "channel-sources-hermes-"));
    mkdirSync(join(hermesHome, "profiles", "instagram-carousel-planner"), { recursive: true });
    writeFileSync(join(hermesHome, "profiles", "instagram-carousel-planner", "config.yaml"), "model: stub\n", "utf8");
    persistCanonicalAssetToPackage({ packageRoot, asset: asset() });
    mockPackage.packageRoot = packageRoot;
  });
  afterEach(() => {
    rmSync(hermesHome, { recursive: true, force: true });
  });

  function astraWriterInvoke() {
    return vi.fn(async () => {
      const plan = readSharedVisualPlan(packageRoot)!;
      return JSON.stringify({
        visuals: plan.visuals
          .filter((v) => v.generatedVisualNeeded)
          .map((v) => ({
            visualId: v.visualId,
            refinedVisualIntent: `${v.visualIntent} — 자연광 중심의 차분한 여행 에디토리얼 톤.`,
            compositionGuidance: "상단 1/3은 한국어 오버레이를 위해 비워 둔다.",
            textSafeArea: "Upper third text-safe",
            atmosphereLighting: "soft overcast travel-editorial light",
            evidenceSafeConstraints: ["식별 가능한 호텔 간판·로고 금지"],
          })),
      });
    });
  }

  function approveCardCopyAsIs() {
    const base = readInstagramCardCopyFromPackage(packageRoot)!;
    const review = buildInstagramCardCopyReview({
      candidateId: CANDIDATE_ID,
      cardCopy: base,
      carousel: readInstagramCarouselPlanFromPackage(packageRoot),
      source: { kind: "external_editorial", candidateRef: null },
      updatedBy: "ysh",
      nowIso: T0,
    });
    persistInstagramCardCopyReview({
      packageRoot,
      review: approveInstagramCardCopyReview({ review, base, approvedBy: "ysh", nowIso: T0 }),
    });
  }

  async function generatePlanOnExternalInstagram() {
    const c = importOk();
    expectOk(select("instagram", "external_editorial", { importId: c.importId }));
    approveCardCopyAsIs();
    const vraInvoke = vi.fn<VisualRoleArchitectInvoke>(async () => JSON.stringify(VRA_LLM));
    const result = await generateSharedVisualPlanWithLlm({
      packageRoot,
      bundle: readBundle(),
      approvedCanonicalAsset: asset(),
      invoke: async () => JSON.stringify(SVP_LLM),
      invokeVisualRoleArchitect: vraInvoke,
      hermesHome,
      now: SWITCH_AT,
    });
    return { c, vraInvoke, result };
  }

  it("regenerates VRA from external sidecars, builds SVP, and generates the Astra Handoff", async () => {
    const { c, vraInvoke, result } = await generatePlanOnExternalInstagram();
    if (!result.ok) throw new Error(`svp failed: ${result.error.code} ${result.error.message}`);
    expect(result.visualRolePlanStatus).toBe("generated");
    const promptText = vraInvoke.mock.calls[0]![0].text;
    expect(promptText).toContain("수쿰빗은 역 도보권 숙소가 많다");
    expect(promptText).not.toContain("Hermes 훅");

    const vra = readInstagramVisualRolePlanFromPackage(packageRoot)!;
    expect(vra.sourceCarouselFingerprint).toBe(
      buildInstagramCarouselContentFingerprint(readInstagramCarouselPlanFromPackage(packageRoot)!),
    );
    expect(readInstagramCarouselPlanFromPackage(packageRoot)!.sourceNarrativeFingerprint).toBe(
      c.externalNarrativeFingerprint,
    );
    const plan = readSharedVisualPlan(packageRoot)!;
    expect(plan.sourceInstagramVisualRoleFingerprint).toBe(buildInstagramVisualRoleContentFingerprint(vra));
    expect(resolveSharedVisualPlanLifecycleForPackage({ packageRoot, plan, bundle: readBundle() })).toBe("fresh");
    expect(isSharedVisualPlanStaleOnlyFromInstagramCardCopy({ packageRoot, plan, bundle: readBundle() })).toBe(false);
    // Regression guard: the old call shape (no current VRA fingerprint) mislabels this fresh plan.
    expect(resolveSharedVisualPlanLifecycle({ plan, bundle: readBundle() })).toBe("stale");

    const writer = astraWriterInvoke();
    const handoff = await generateAstraHandoffForCandidate({ candidateId: CANDIDATE_ID, invoke: writer });
    expect(handoff).toMatchObject({ ok: true, handoffStatus: "fresh", visualCount: 1 });
    expect(writer).toHaveBeenCalledTimes(1);
  });

  it("reports stale and refuses the Astra Handoff when the on-disk VRA fingerprint changed", async () => {
    const { result } = await generatePlanOnExternalInstagram();
    expect(result.ok).toBe(true);
    const vra = readInstagramVisualRolePlanFromPackage(packageRoot)!;
    persistInstagramVisualRolePlan({
      packageRoot,
      plan: { ...vra, rhythmSummary: `${vra.rhythmSummary} (changed)` },
      createdAt: RESTORE_AT.toISOString(),
    });
    const plan = readSharedVisualPlan(packageRoot)!;
    expect(resolveSharedVisualPlanLifecycleForPackage({ packageRoot, plan, bundle: readBundle() })).toBe("stale");
    expect(isSharedVisualPlanStaleOnlyFromInstagramCardCopy({ packageRoot, plan, bundle: readBundle() })).toBe(false);

    const writer = astraWriterInvoke();
    const handoff = await generateAstraHandoffForCandidate({ candidateId: CANDIDATE_ID, invoke: writer });
    expect(handoff.ok).toBe(false);
    expect(writer).not.toHaveBeenCalled();
  });

  it("blocks Shared Visual Plan generation for Instagram until the card copy review is approved", async () => {
    const c = importOk();
    expectOk(select("instagram", "external_editorial", { importId: c.importId }));
    const invoke = vi.fn(async () => JSON.stringify(SVP_LLM));
    await expect(generateSharedVisualPlanForCandidate({ candidateId: CANDIDATE_ID, invoke })).rejects.toMatchObject({
      code: "instagram_card_copy_review_required",
      httpStatus: 409,
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("blocks the Astra Handoff when the card copy review was reset after the plan was built", async () => {
    const { result } = await generatePlanOnExternalInstagram();
    expect(result.ok).toBe(true);
    rmSync(join(packageRoot, INSTAGRAM_CARD_COPY_REVIEW_RELATIVE_PATH), { force: true });
    const writer = astraWriterInvoke();
    await expect(generateAstraHandoffForCandidate({ candidateId: CANDIDATE_ID, invoke: writer })).rejects.toMatchObject({
      code: "instagram_card_copy_review_required",
      httpStatus: 409,
    });
    expect(writer).not.toHaveBeenCalled();
  });

  it("an approved card copy edit makes SVP + handoff stale, and VRA regenerates from the effective copy", async () => {
    const { result } = await generatePlanOnExternalInstagram();
    expect(result.ok).toBe(true);
    const base = readInstagramCardCopyFromPackage(packageRoot)!;
    const firstCardId = base.cards[0]!.cardId;
    const edited = updateInstagramCardCopyReviewDrafts({
      review: buildInstagramCardCopyReview({
        candidateId: CANDIDATE_ID,
        cardCopy: base,
        carousel: readInstagramCarouselPlanFromPackage(packageRoot),
        source: { kind: "external_editorial", candidateRef: null },
        updatedBy: "ysh",
        nowIso: T0,
      }),
      base,
      edits: [{ cardId: firstCardId, headline: "사람이 고친 표지 문구" }],
      updatedBy: "ysh",
      nowIso: T0,
    });
    persistInstagramCardCopyReview({
      packageRoot,
      review: approveInstagramCardCopyReview({ review: edited, base, approvedBy: "ysh", nowIso: T0 }),
    });

    const plan = readSharedVisualPlan(packageRoot)!;
    expect(resolveSharedVisualPlanLifecycleForPackage({ packageRoot, plan, bundle: readBundle() })).toBe("stale");
    expect(isSharedVisualPlanStaleOnlyFromInstagramCardCopy({ packageRoot, plan, bundle: readBundle() })).toBe(true);
    const writer = astraWriterInvoke();
    expect((await generateAstraHandoffForCandidate({ candidateId: CANDIDATE_ID, invoke: writer })).ok).toBe(false);
    expect(writer).not.toHaveBeenCalled();

    const vraInvoke = vi.fn<VisualRoleArchitectInvoke>(async () => JSON.stringify(VRA_LLM));
    const svpInvoke = vi.fn<(prompt: string) => Promise<string>>(async () => JSON.stringify(SVP_LLM));
    const regenerated = await generateSharedVisualPlanWithLlm({
      packageRoot,
      bundle: readBundle(),
      approvedCanonicalAsset: asset(),
      invoke: svpInvoke,
      invokeVisualRoleArchitect: vraInvoke,
      hermesHome,
      now: RESTORE_AT,
    });
    expect(regenerated.ok).toBe(true);
    expect(vraInvoke.mock.calls[0]![0].text).toContain("사람이 고친 표지 문구");
    const svpPrompt = svpInvoke.mock.calls[0]![0];
    expect(svpPrompt).toContain("TOP PRIORITY — Instagram card text");
    expect(svpPrompt).toContain('"cardTextSource": "approved_card_copy_review"');
    expect(svpPrompt).toContain("사람이 고친 표지 문구");
    expect(readInstagramCardCopyFromPackage(packageRoot)).toEqual(base);
    expect(
      resolveSharedVisualPlanLifecycleForPackage({
        packageRoot,
        plan: readSharedVisualPlan(packageRoot)!,
        bundle: readBundle(),
      }),
    ).toBe("fresh");
  });
});

describe("Instagram cardnews ChatGPT result import", () => {
  function cardnewsResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const base = externalResult();
    const instagram = base.instagram as Record<string, Record<string, unknown[]>>;
    return {
      contract: INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
      candidateId: CANDIDATE_ID,
      assetId: "cma_rev123",
      canonicalVersion: 3,
      sourceRevision: "rev123",
      narrative: base.narrative,
      instagram: {
        carouselPlan: {
          cards: [
            ...instagram.carouselPlan!.cards!,
            { cardId: "c4", role: "cta", beatIds: ["b3"], communicationGoal: "저장을 권한다", visualPriority: "none" },
          ],
        },
        cardCopy: {
          cards: [
            ...instagram.cardCopy!.cards!,
            { cardId: "c4", kicker: null, headline: "저장해 두고 동선부터 적기", body: null, microcopy: null, evidenceRefs: [] },
          ],
        },
        caption: instagram.caption,
        coverTitleKo: "방콕 숙소는 위치부터",
      },
      ...overrides,
    };
  }

  function importCardnews(result: Record<string, unknown> = cardnewsResult(), approvedCanonical = asset()) {
    return importInstagramCardnewsResult({
      packageRoot,
      candidateId: CANDIDATE_ID,
      approvedCanonical,
      raw: JSON.stringify(result),
      importedBy: "ysh",
      now: IMPORT_AT,
    });
  }

  function candidateFiles(): string[] {
    const dir = join(packageRoot, "context", "channel-sources", "external-editorial");
    return existsSync(dir) ? readdirSync(dir) : [];
  }

  it("stores an Instagram-only candidate and returns the thumbnail title suggestion", () => {
    const out = importCardnews();
    if (!out.ok) throw new Error(`${out.code} ${out.details.join("; ")}`);
    expect(out.candidate.resultContract).toBe(INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT);
    expect(out.candidate.channelReadiness.instagram).toEqual({ present: true, materializable: true, issues: [] });
    expect(out.candidate.channelReadiness.threads.present).toBe(false);
    expect(out.coverTitleKo).toBe("방콕 숙소는 위치부터");
    expect(candidateFiles()).toEqual([`${out.candidate.importId}.json`]);
  });

  it("applies to Instagram only, resets the card copy review, and surfaces the cover title suggestion", () => {
    const out = importCardnews();
    if (!out.ok) throw new Error(out.code);
    const threadsBefore = readBundle().threads;

    expectOk(select("instagram", "external_editorial", { importId: out.candidate.importId, allowOverwriteHuman: true }));

    const bundle = readBundle();
    expect(bundle.threads).toEqual(threadsBefore);
    expect(bundle.targetChannels).toContain("instagram");
    expect(bundle.instagram?.provenance.externalCandidateRef).toBe(out.candidateRef);
    expect(readInstagramCarouselPlanFromPackage(packageRoot)!.cards.map((c) => c.cardId)).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
    ]);
    expect(readInstagramCardCopyFromPackage(packageRoot)!.cards[3]!.headline).toBe("저장해 두고 동선부터 적기");
    expect(resolveInstagramCardCopyReviewGate(packageRoot).state).toBe("review_missing");
    expect(resolveExternalInstagramCoverTitleSuggestion(packageRoot, bundle)).toBe("방콕 숙소는 위치부터");
  });

  it("warns but imports when the result echoes an older approved version or exceeds review limits", () => {
    const result = cardnewsResult({ canonicalVersion: 2 });
    const instagram = result.instagram as { cardCopy: { cards: Array<Record<string, unknown>> } };
    instagram.cardCopy.cards[1] = { ...instagram.cardCopy.cards[1], body: "가".repeat(401), evidenceRefs: ["F9"] };
    const out = importCardnews(result);
    if (!out.ok) throw new Error(out.code);
    const warnings = out.candidate.warnings.join("\n");
    expect(warnings).toContain("canonicalVersion");
    expect(warnings).toContain("instagram.cardCopy.cards[1].body 401자");
    expect(warnings).toContain("F9");
  });

  it.each([
    ["contract_mismatch", () => cardnewsResult({ contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT })],
    ["stale_identity", () => cardnewsResult({ candidateId: "other_candidate" })],
    ["unknown_top_level_key", () => cardnewsResult({ threads: { body: "x" } })],
    ["narrative_missing", () => cardnewsResult({ narrative: null })],
    [
      "unknown_instagram_key",
      () => {
        const r = cardnewsResult();
        (r.instagram as Record<string, unknown>).storyboard = {};
        return r;
      },
    ],
    [
      "card_count_out_of_range",
      () => {
        const r = cardnewsResult();
        const ig = r.instagram as { carouselPlan: { cards: unknown[] }; cardCopy: { cards: unknown[] } };
        ig.carouselPlan.cards = ig.carouselPlan.cards.slice(0, 3);
        ig.cardCopy.cards = ig.cardCopy.cards.slice(0, 3);
        return r;
      },
    ],
    [
      "instagram_not_materializable",
      () => {
        const r = cardnewsResult();
        const ig = r.instagram as { cardCopy: { cards: Array<Record<string, unknown>> } };
        ig.cardCopy.cards[3] = { ...ig.cardCopy.cards[3], cardId: "c9" };
        return r;
      },
    ],
  ] as const)("rejects %s without storing a candidate", (code, build) => {
    const out = importCardnews(build());
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe(code);
    expect(candidateFiles()).toEqual([]);
  });

  it("rejects when the current Canonical version is not approved", () => {
    const out = importCardnews(cardnewsResult(), asset({ status: "human_edited", approvedVersion: 2 }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("canonical_not_approved");
  });
});
