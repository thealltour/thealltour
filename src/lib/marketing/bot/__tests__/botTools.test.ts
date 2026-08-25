import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { getMarketingContextTool } from "@/lib/marketing/bot/getMarketingContextTool";
import { searchMarketingMemoryTool } from "@/lib/marketing/bot/searchMarketingMemoryTool";
import { prepareMarketingTask } from "@/lib/marketing/bot/prepareMarketingTask";
import { evaluateGovernanceTool, reviewGeneratedContent } from "@/lib/marketing/bot/evaluateGovernanceTool";
import { parseMarketingBotCliArgs } from "@/lib/marketing/bot/cli";
import { MARKETING_BOT_CONTRACT_FILES, MARKETING_BOT_ROLES } from "@/lib/marketing/bot/contracts";
import { applyGovernancePolicy } from "@/lib/marketing/governance/applyGovernancePolicy";
import { emptyAgendaStats } from "@/lib/marketing/governance/evaluators";
import { revisionHintsForReasons } from "@/lib/marketing/governance/revisionHints";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import type { MarketingContextPackage, ProductContext } from "@/lib/marketing/context/types";
import type { GovernanceCandidate, GovernanceResult } from "@/lib/marketing/governance/types";
import type { GovernanceWorkflowResult } from "@/lib/marketing/governance/workflowTypes";
import type { SemanticMemoryMatch, SemanticRetrievalResult } from "@/lib/marketing/semantic/types";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";

const PRODUCT_ID = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const NOW = new Date("2026-08-25T00:00:00.000Z");

function product(overrides: Partial<ProductContext> = {}): ProductContext {
  return {
    id: PRODUCT_ID,
    title: "스페인 포르투갈 10일",
    oneLiner: "부모님과 떠나는 서유럽 일정",
    description: "일정과 포함사항은 상품 정보를 따른다. contact name 홍길동 email secret@test.com",
    status: "active",
    isActive: true,
    price: 3990000,
    priceMeta: null,
    duration: "10일",
    destination: {
      id: "dest-1",
      name: "스페인",
      slug: "spain",
      taxonomyType: "destination",
      parentId: null,
      displayLabel: "스페인",
      badgeDescription: null,
      seoTitle: null,
      seoDescription: null,
    },
    productLine: null,
    campaigns: [],
    unresolvedCampaignLabels: [],
    tags: ["효도여행"],
    sellingPoints: null,
    benefits: "전 일정 한국어 가이드",
    tourismPoints: null,
    guidePoints: null,
    inclusions: "항공, 호텔, 식사",
    includedItems: null,
    exclusions: "개인 경비",
    optionalTours: null,
    optionalExpenses: null,
    itinerary: null,
    detailedSchedule: null,
    itineraryDays: [],
    itineraryV2: null,
    departureSchedules: [],
    accommodation: null,
    transportation: null,
    insurance: null,
    bookingNotes: null,
    travelNotes: null,
    refundPolicy: null,
    images: [],
    sourceUrl: null,
    ...overrides,
  };
}

function pkg(overrides: Partial<MarketingContextPackage> = {}): MarketingContextPackage {
  return {
    request: { purpose: "create_content", productId: PRODUCT_ID, channel: "threads" },
    context: {
      product: product(),
      customerInsights: {
        topic: "voice_of_customer",
        productId: PRODUCT_ID,
        period: { start: "2026-07-26T00:00:00.000Z", end: "2026-08-25T00:00:00.000Z" },
        inquiryCount: 4,
        topQuestions: ["비행 시간이 어떻게 되나요?"],
        topConcerns: ["부모님이 걷기 편한지"],
        conversionSummary: { none: 2, reserved: 1, completed: 1, canceled: 0, other: 0 },
        reviewSummary: null,
      },
      reviewInsights: {
        reviewCount: 3,
        averageRating: 4.6,
        summaryText: "가이드와 일정이 좋다는 평가",
        positivePoints: ["가이드"],
        negativePoints: ["이동 시간"],
        contentTips: ["일정 여유를 강조"],
        scheduleRating: 4.5,
        stayRating: 4.4,
        guideRating: 4.8,
        foodRating: 4.2,
        recommendedFor: ["5070"],
      },
      performance: {
        period: { start: "2026-07-26T00:00:00.000Z", end: "2026-08-25T00:00:00.000Z" },
        channel: "threads",
        productId: PRODUCT_ID,
        publicationCount: 2,
        metrics: [{ metricType: "impressions", value: 1200, change: null, measuredAt: null }],
        topPerformingContent: ["효도여행 후기"],
        bottomPerformingContent: [],
        topAgendas: ["filial-trip"],
        conversionSummary: null,
      },
      contentHistory: [
        {
          id: "c1",
          sourceType: "ai_content",
          sourceId: "c1",
          channel: "threads",
          productId: PRODUCT_ID,
          title: "지난 효도여행 안내",
          body: "이전 본문",
          summary: "이전 본문",
          publishedAt: "2026-08-20T00:00:00.000Z",
          createdAt: "2026-08-20T00:00:00.000Z",
          metadata: null,
          similarityAvailable: false,
        },
      ],
    },
    governance: {},
    sources: [
      {
        sourceType: "product",
        sourceTable: "products",
        retrievedAt: NOW.toISOString(),
        sourceId: PRODUCT_ID,
      },
    ],
    generatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function semanticMatch(): SemanticMemoryMatch {
  return {
    memoryId: "mem-1",
    score: 0.81,
    memory: {
      id: "mem-1",
      memoryType: "content_knowledge",
      title: "효도여행 기억",
      content: "부모님 일정은 걷기를 줄이는 것이 좋다.",
      sourceType: "ai_content",
      sourceId: "c1",
    },
    source: { sourceType: "memory", sourceTable: "ai_memory", sourceId: "mem-1" },
  };
}

function workflowFrom(
  governance: Partial<GovernanceResult>,
  candidate: GovernanceCandidate,
): GovernanceWorkflowResult {
  const result: GovernanceResult = {
    decision: "ALLOW",
    riskScore: 0,
    reasons: [{ code: "NO_RISK_SIGNAL", severity: "info" }],
    checkedAt: NOW.toISOString(),
    semanticAvailable: true,
    matchedMemories: [],
    agendaStats: emptyAgendaStats(),
    channelStats: { channel: candidate.channel, dailyCount: 0, dailyMax: 3, cooldownDays: 7, sameAgendaRecentCount: 0 },
    ...governance,
  };
  const policy = applyGovernancePolicy(result, { now: NOW });
  return {
    ...policy,
    candidate,
    approvalRequest: null,
    revisionRequest:
      policy.action === "REQUEST_REVISION"
        ? {
            reasonCodes: result.reasons.map((reason) => reason.code),
            matchedContent: [],
            riskScore: result.riskScore,
            revisionHints: revisionHintsForReasons(result.reasons),
          }
        : null,
  };
}

function deps(overrides: MarketingBotDeps = {}): MarketingBotDeps {
  return {
    now: NOW,
    composeContext: async () => pkg(),
    semanticRetrieve: async () => ({ status: "ok", matches: [semanticMatch()] }),
    evaluateWorkflow: async (candidate) => workflowFrom({}, candidate),
    ...overrides,
  };
}

describe("getMarketingContextTool", () => {
  it("returns a compact context without PII or embeddings", async () => {
    const result = await getMarketingContextTool(
      { purpose: "create_content", productId: PRODUCT_ID, channel: "threads" },
      deps(),
    );
    expect(result.productFound).toBe(true);
    expect(result.context.product?.title).toBe("스페인 포르투갈 10일");
    expect(result.context.customerInsights?.inquiryCount).toBe(4);
    expect(jsonContainsForbiddenBotLeak(result)).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/secret@test\.com/);
    expect(JSON.stringify(result)).not.toContain("홍길동");
  });

  it("reports missing product without throwing", async () => {
    const result = await getMarketingContextTool(
      { purpose: "create_content", productId: PRODUCT_ID },
      deps({
        composeContext: async () => pkg({ context: { ...pkg().context, product: null } }),
      }),
    );
    expect(result.productFound).toBe(false);
    expect(result.context.product).toBeNull();
  });
});

describe("searchMarketingMemoryTool", () => {
  it("returns compact semantic matches without vectors", async () => {
    const result = await searchMarketingMemoryTool({ query: "효도여행" }, deps());
    expect(result.status).toBe("ok");
    expect(result.matchCount).toBe(1);
    expect(result.matches[0]?.title).toBe("효도여행 기억");
    expect(result.matches[0]?.similarity).toBe(0.81);
    expect(JSON.stringify(result)).not.toContain("embedding");
  });

  it("returns no matches as success", async () => {
    const result = await searchMarketingMemoryTool(
      { query: "없는주제" },
      deps({ semanticRetrieve: async () => ({ status: "ok", matches: [] }) }),
    );
    expect(result.matchCount).toBe(0);
    expect(result.matches).toEqual([]);
  });

  it("passes through provider unavailable", async () => {
    const skipped: SemanticRetrievalResult = {
      status: "skipped",
      reason: "provider_not_configured",
      matches: [],
    };
    const result = await searchMarketingMemoryTool(
      { query: "효도여행" },
      deps({ semanticRetrieve: async () => skipped }),
    );
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("provider_not_configured");
    expect(result.matches).toEqual([]);
  });
});

describe("governance and workflow tools", () => {
  const content = {
    title: "효도여행",
    body: "부모님과 떠나는 스페인 일정입니다.",
    channel: "threads",
    productId: PRODUCT_ID,
  };

  it("maps ALLOW to publish_ready without a publish action", async () => {
    const governance = await evaluateGovernanceTool(content, deps());
    expect(governance.governanceDecision).toBe("ALLOW");
    const reviewed = await reviewGeneratedContent(content, deps());
    expect(reviewed.status).toBe("publish_ready");
    expect(reviewed.nextAction).toBe("stop_before_publish");
    expect(reviewed.publishActionIncluded).toBe(false);
  });

  it("maps REVIEW to approval_required with a handoff payload", async () => {
    const reviewed = await reviewGeneratedContent(
      content,
      deps({
        evaluateWorkflow: async (candidate) =>
          workflowFrom(
            {
              decision: "REVIEW",
              riskScore: 0.55,
              reasons: [{ code: "SEMANTIC_SIMILARITY_REVIEW", severity: "medium" }],
            },
            candidate,
          ),
      }),
    );
    expect(reviewed.status).toBe("approval_required");
    expect(reviewed.approvalHandoff?.type).toBe("approval_required");
    expect(reviewed.publishActionIncluded).toBe(false);
  });

  it("maps BLOCK to revision_required", async () => {
    const reviewed = await reviewGeneratedContent(
      content,
      deps({
        evaluateWorkflow: async (candidate) =>
          workflowFrom(
            {
              decision: "BLOCK",
              riskScore: 1,
              reasons: [{ code: "EXACT_DUPLICATE", severity: "critical" }],
            },
            candidate,
          ),
      }),
    );
    expect(reviewed.status).toBe("revision_required");
    expect(reviewed.governance?.revisionHints.length).toBeGreaterThan(0);
  });

  it("prepares a brief for Hermes to write, without publishing", async () => {
    const prepared = await prepareMarketingTask(
      { productId: PRODUCT_ID, channel: "threads", goal: "스페인 포르투갈 패키지 홍보 콘텐츠" },
      deps(),
    );
    expect(prepared.status).toBe("draft_ready");
    expect(prepared.brief.productFound).toBe(true);
    expect(prepared.memoryMatchCount).toBe(1);
    expect(prepared.nextAction).toBe("generate_content_then_review");
    expect(prepared.publishActionIncluded).toBe(false);
    expect(prepared.generationInstructions.join(" ")).toContain("실제 SNS 게시");
  });

  it("uses create_content retrieval when the goal is free text", async () => {
    const purposes: string[] = [];
    await prepareMarketingTask(
      { productId: PRODUCT_ID, channel: "threads", goal: "스페인 포르투갈 패키지 홍보 콘텐츠" },
      deps({
        composeContext: async (request) => {
          purposes.push(request.purpose);
          return pkg();
        },
      }),
    );
    expect(purposes).toEqual(["create_content"]);
  });
});

describe("bot contracts and CLI", () => {
  it("keeps role contracts as files, not inline prompts", () => {
    expect(MARKETING_BOT_ROLES).toEqual(["marketing_manager", "content", "governance"]);
    expect(MARKETING_BOT_CONTRACT_FILES.marketing_manager).toContain("marketing-manager.md");
  });

  it("requires product id and channel", () => {
    expect(() => parseMarketingBotCliArgs([])).toThrow(GovernanceValidationError);
    expect(
      parseMarketingBotCliArgs(["--product-id", PRODUCT_ID, "--channel", "threads", "--goal", "홍보"]),
    ).toMatchObject({ productId: PRODUCT_ID, channel: "threads", goal: "홍보" });
  });
});
