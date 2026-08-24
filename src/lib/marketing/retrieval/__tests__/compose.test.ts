import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { executeRetrievalPlan } from "@/lib/marketing/retrieval/executeRetrievalPlan";
import { runMarketingRetrieval } from "@/lib/marketing/retrieval/runMarketingRetrieval";
import { buildRetrievalPlan } from "@/lib/marketing/retrieval/planner";
import { parseMarketingRetrievalRequest, withComposePeriodDefaults } from "@/lib/marketing/retrieval/validation";
import type { RetrievalAdapters } from "@/lib/marketing/retrieval/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function emptyResult<T>(data: T, sourceType: string, sourceTable: string) {
  return {
    data,
    retrievedAt: "2026-08-24T00:00:00.000Z",
    sources: [
      {
        sourceType: sourceType as never,
        sourceId: null,
        sourceTable,
        retrievedAt: "2026-08-24T00:00:00.000Z",
        periodStart: null,
        periodEnd: null,
      },
    ],
  };
}

function mockAdapters(): RetrievalAdapters & { calls: string[] } {
  const calls: string[] = [];
  const adapters: RetrievalAdapters & { calls: string[] } = {
    calls,
    retrieveProduct: vi.fn(async () => {
      calls.push("product");
      return emptyResult(null, "product", "products");
    }),
    retrieveCustomerInsights: vi.fn(async () => {
      calls.push("customerInsights");
      return emptyResult(
        {
          topic: "voice_of_customer",
          productId: null,
          period: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-24T00:00:00.000Z" },
          inquiryCount: 0,
          topQuestions: [],
          topConcerns: [],
          conversionSummary: { none: 0, reserved: 0, completed: 0, canceled: 0, other: 0 },
          reviewSummary: null,
        },
        "inquiry_insight",
        "inquiries",
      );
    }),
    retrieveBookings: vi.fn(async () => {
      calls.push("bookings");
      return emptyResult(
        {
          bookingCount: 0,
          pendingDepositCount: 0,
          reservedCount: 0,
          completedCount: 0,
          canceledCount: 0,
          otherStatusCount: 0,
          travelerCount: 0,
          revenue: 0,
          period: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-24T00:00:00.000Z" },
          productId: null,
          departureDateRange: { start: null, end: null },
        },
        "booking_insight",
        "travel_bookings",
      );
    }),
    retrieveReviews: vi.fn(async () => {
      calls.push("reviews");
      return emptyResult(
        {
          reviewCount: 0,
          averageRating: null,
          positivePoints: [],
          negativePoints: [],
          contentTips: [],
          scheduleRating: null,
          stayRating: null,
          guideRating: null,
          foodRating: null,
          recommendedFor: [],
        },
        "review_insight",
        "reviews",
      );
    }),
    retrieveContentHistory: vi.fn(async () => {
      calls.push("contentHistory");
      return emptyResult([], "content_history", "ai_contents");
    }),
    retrievePublications: vi.fn(async () => {
      calls.push("publications");
      return emptyResult([], "publication", "ai_publications");
    }),
    retrievePerformance: vi.fn(async () => {
      calls.push("performance");
      return emptyResult(
        {
          period: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-24T00:00:00.000Z" },
          channel: null,
          productId: null,
          publicationCount: 0,
          metrics: [],
          topPerformingContent: [],
          bottomPerformingContent: [],
          topAgendas: [],
          conversionSummary: null,
        },
        "performance",
        "ai_feedback",
      );
    }),
    retrieveMemory: vi.fn(async () => {
      calls.push("memory");
      return emptyResult([], "memory", "ai_memory");
    }),
    retrieveAgendas: vi.fn(async () => {
      calls.push("agendas");
      return emptyResult([], "agenda", "ai_agendas");
    }),
  };
  return adapters;
}

describe("composeMarketingContext via retrieval plan", () => {
  it("calls only create_content sources", async () => {
    const adapters = mockAdapters();
    const pkg = await runMarketingRetrieval({ purpose: "create_content", productId: PRODUCT_ID }, adapters);
    expect(adapters.calls.sort()).toEqual(
      ["contentHistory", "customerInsights", "memory", "product", "publications"].sort(),
    );
    expect(adapters.retrievePerformance).not.toHaveBeenCalled();
    expect(adapters.retrieveBookings).not.toHaveBeenCalled();
    expect(pkg.context.performance).toBeNull();
    expect(pkg.context.bookingInsights).toBeNull();
  });

  it("calls only analyze_performance sources", async () => {
    const adapters = mockAdapters();
    await runMarketingRetrieval({ purpose: "analyze_performance" }, adapters);
    expect(adapters.calls.sort()).toEqual(
      ["bookings", "customerInsights", "performance", "publications", "reviews"].sort(),
    );
    expect(adapters.retrieveProduct).not.toHaveBeenCalled();
  });

  it("does not fail the package when retrieval data is empty", async () => {
    const adapters = mockAdapters();
    const parsed = parseMarketingRetrievalRequest(
      withComposePeriodDefaults({ purpose: "governance_check", productId: PRODUCT_ID }),
    );
    const plan = buildRetrievalPlan(parsed);
    const retrieved = await executeRetrievalPlan(parsed, plan, adapters);
    expect(retrieved.contentHistory).toEqual([]);
    expect(retrieved.publications).toEqual([]);
    expect(retrieved.memory).toEqual([]);
    expect(retrieved.agendaHistory).toEqual([]);
    expect(retrieved.product).toBeNull();
    expect(retrieved.sources.length).toBeGreaterThan(0);
  });

  it("scores candidates and keeps only the context top-K", async () => {
    const adapters = mockAdapters();
    const items = Array.from({ length: 25 }, (_, index) => ({
      id: `content-${index}`,
      sourceType: "ai_content" as const,
      sourceId: `content-${index}`,
      channel: "threads",
      productId: PRODUCT_ID,
      title: `item ${index}`,
      body: null,
      summary: null,
      publishedAt: new Date(Date.parse("2026-08-24T00:00:00.000Z") - index * 86_400_000).toISOString(),
      createdAt: "2026-08-01T00:00:00.000Z",
      metadata: null,
      similarityAvailable: false,
    }));
    adapters.retrieveContentHistory = vi.fn(async () => emptyResult(items, "content_history", "ai_contents"));
    const pkg = await runMarketingRetrieval(
      {
        purpose: "create_content",
        productId: PRODUCT_ID,
        includeProduct: false,
        includeCustomerInsights: false,
        includePublications: false,
        includeMemory: false,
        includeContentHistory: true,
      },
      adapters,
      { contextLimit: 5, now: new Date("2026-08-24T00:00:00.000Z") },
    );
    expect(pkg.context.contentHistory).toHaveLength(5);
    expect(pkg.ranking?.candidateCount).toBe(25);
    expect(pkg.ranking?.selectedCount).toBe(5);
    expect(pkg.ranking?.contextLimit).toBe(5);
    expect(pkg.context.contentHistory?.[0]?.id).toBe("content-0");
  });

  it("returns structured context when the semantic provider is not configured", async () => {
    const adapters = mockAdapters();
    const pkg = await runMarketingRetrieval({ purpose: "create_content", productId: PRODUCT_ID }, adapters, {
      env: { EMBEDDING_PROVIDER: "none" },
    });
    expect(pkg.context.customerInsights).not.toBeUndefined();
    expect(pkg.semantic?.status).toBe("skipped");
    expect(pkg.semantic?.reason).toBe("provider_not_configured");
  });

  it("keeps structured retrieval when Mini PC embedding is configured but vector search is not", async () => {
    const adapters = mockAdapters();
    const pkg = await runMarketingRetrieval({ purpose: "create_content", productId: PRODUCT_ID }, adapters, {
      env: {
        EMBEDDING_PROVIDER: "mini_pc",
        EMBEDDING_BASE_URL: "http://embedding.test",
        EMBEDDING_MODEL: "BAAI/bge-m3",
        EMBEDDING_DIMENSION: "1024",
      },
    });
    expect(pkg.context.customerInsights).not.toBeUndefined();
    expect(pkg.context.product).toBeNull();
    expect(pkg.semantic?.status).toBe("skipped");
    expect(pkg.semantic?.reason).toBe("repository_not_configured");
  });

  it("keeps structured retrieval when Mini PC config is invalid", async () => {
    const adapters = mockAdapters();
    const pkg = await runMarketingRetrieval({ purpose: "create_content", productId: PRODUCT_ID }, adapters, {
      env: { EMBEDDING_PROVIDER: "mini_pc" },
    });
    expect(pkg.context.customerInsights).not.toBeUndefined();
    expect(pkg.semantic?.status).toBe("skipped");
    expect(pkg.semantic?.reason).toBe("provider_not_configured");
  });
});
