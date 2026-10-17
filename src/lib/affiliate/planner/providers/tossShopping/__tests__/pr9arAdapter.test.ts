import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import {
  applyAffiliateProviderEnvOverrides,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
  PLANNER_AFFILIATE_PROVIDER_ENV_KEYS,
} from "@/lib/affiliate/planner/providerConfig";
import {
  buildTossTravelGoodsOfferBuilds,
  createTossShoppingAdapter,
  TOSS_TRAVEL_GOODS_CTA,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingAdapter";
import { createMemoryTossShoppingCache } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCache";
import { getProductionAffiliateAdapters } from "@/lib/affiliate/planner/registry";
import type {
  AffiliateOffer,
  AffiliateOfferBuild,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

afterEach(() => {
  vi.restoreAllMocks();
});

function routing(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-05", durationDays: 5 },
    travelers: { adults: 2, children: 0 },
    companionType: "couple",
    interests: [],
    pace: "balanced",
    placement: "preparation",
    category: "travel_goods",
    sourceProductId: null,
    ...overrides,
  };
}

function planWithBeach(): PlannerPlan {
  return {
    title: "오키나와",
    summary: "s",
    destination: { name: "오키나와", country: "JP" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      nights: 4,
      days: 5,
      travelersSummary: "2",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "해변",
        summary: "s",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "만좌 해변",
            area: null,
            description: "수영",
            estimatedDurationMinutes: 120,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: [], packingHints: [] },
  };
}

function mockTossApi(params: {
  fetchImpl: ReturnType<typeof vi.fn>;
  products?: Array<Record<string, unknown>>;
  detailSoldOut?: boolean;
}) {
  const products = params.products ?? [
    {
      tacaItemId: 1001,
      displayName: "테스트 보조배터리 20000mAh",
      rank: 1,
      displayPrice: 29900,
      originalPrice: 39900,
      discountRate: 25,
      isSoldOut: false,
      thumbnailUrl: "https://shopping.toss.im/thumb/1001.jpg",
      reviewScore: 4.8,
      reviewCount: 1200,
      categoryIds: [20037],
      productUrl: "https://toss.shopping/t/1001",
    },
  ];

  params.fetchImpl.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/products/best-categories/")) {
      return new Response(JSON.stringify({ resultType: "SUCCESS", success: { items: products } }), {
        status: 200,
      });
    }
    if (url.includes("/products/detail")) {
      return new Response(
        JSON.stringify({
          resultType: "SUCCESS",
          success: {
            items: products.map((p) => ({
              ...p,
              isSoldOut: params.detailSoldOut ?? false,
            })),
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/links") && init?.method === "POST") {
      return new Response(
        JSON.stringify({
          resultType: "SUCCESS",
          success: {
            shortUrl: "https://toss.shopping/_m/testLink",
            originUrl: "https://toss.shopping/t/1001?k=x",
          },
        }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  });
}

describe("PR-9AR Toss adapter build", () => {
  it("builds a travel_goods offer without price metadata or raw Sharelink in title fields", async () => {
    const fetchImpl = vi.fn();
    mockTossApi({ fetchImpl });
    const builds = await buildTossTravelGoodsOfferBuilds({
      routing: routing(),
      plan: planWithBeach(),
      hasRentalCarOffer: false,
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessToken: async () => "bearer",
        cache: createMemoryTossShoppingCache(),
        env: { TOSS_SHARELINK_PUBLISHER_ID: "pub" } as unknown as NodeJS.ProcessEnv,
      },
    });
    expect(builds.length).toBeGreaterThan(0);
    const offer = builds[0]!;
    expect(offer.providerId).toBe("toss_shopping");
    expect(offer.category).toBe("travel_goods");
    expect(offer.ctaLabel).toBe(TOSS_TRAVEL_GOODS_CTA);
    expect(offer.targetUrl).toBe("https://toss.shopping/_m/testLink");
    expect(offer.affiliateNetwork).toBe("toss");
    expect(JSON.stringify(offer.metadata)).not.toMatch(/displayPrice|discountRate|29900/);
    expect(offer.metadata?.travelGoods?.intent).toBeTruthy();
  });

  it("sold-out detail → no card for that intent", async () => {
    const fetchImpl = vi.fn();
    mockTossApi({ fetchImpl, detailSoldOut: true });
    const builds = await buildTossTravelGoodsOfferBuilds({
      routing: routing(),
      plan: null,
      hasRentalCarOffer: false,
      deps: {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        getAccessToken: async () => "bearer",
        cache: createMemoryTossShoppingCache(),
        env: { TOSS_SHARELINK_PUBLISHER_ID: "pub" } as unknown as NodeJS.ProcessEnv,
        selectIntents: () => ["power_bank"],
      },
    });
    expect(builds).toEqual([]);
  });

  it("API fail → empty builds (fail-soft)", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const builds = await buildTossTravelGoodsOfferBuilds({
      routing: routing(),
      plan: null,
      hasRentalCarOffer: false,
      deps: {
        fetchImpl: vi.fn(async () => new Response("err", { status: 500 })) as unknown as typeof fetch,
        getAccessToken: async () => "bearer",
        cache: createMemoryTossShoppingCache(),
        env: { TOSS_SHARELINK_PUBLISHER_ID: "pub" } as unknown as NodeJS.ProcessEnv,
        selectIntents: () => ["power_bank"],
      },
    });
    expect(builds).toEqual([]);
  });
});

describe("PR-9AR config + registry", () => {
  it("catalog defaults off with toss network + api/deepLink", () => {
    const def = PLANNER_AFFILIATE_PROVIDER_CATALOG.find((d) => d.id === "toss_shopping");
    expect(def).toMatchObject({
      categories: ["travel_goods"],
      enabled: false,
      network: "toss",
      capabilities: { deepLink: true, search: false, api: true, widget: false },
    });
    expect(PLANNER_AFFILIATE_PROVIDER_ENV_KEYS.toss_shopping).toBe(
      "ENABLE_PLANNER_AFFILIATE_TOSS_SHOPPING",
    );
    expect(
      applyAffiliateProviderEnvOverrides(PLANNER_AFFILIATE_PROVIDER_CATALOG, {
        ENABLE_PLANNER_AFFILIATE_TOSS_SHOPPING: "true",
      }).find((d) => d.id === "toss_shopping")!.enabled,
    ).toBe(true);
  });

  it("registry wires toss_shopping adapter", () => {
    expect(getProductionAffiliateAdapters().get("toss_shopping")?.providerId).toBe("toss_shopping");
    expect(createTossShoppingAdapter().providerId).toBe("toss_shopping");
  });
});

describe("PR-9AR integration — Planner offers", () => {
  const SESSION = "550e8400-e29b-41d4-a716-446655440000";

  function persistEcho() {
    return vi.fn(
      async ({ build }: { build: AffiliateOfferBuild }): Promise<AffiliateOffer> => ({
        offerId: `offer-${build.providerId}-${build.metadata?.travelGoods?.intent ?? build.category}`,
        providerId: build.providerId,
        category: build.category,
        placement: build.placement,
        title: build.title,
        description: build.description,
        ctaLabel: build.ctaLabel,
        destinationLabel: build.destinationLabel,
        trackingToken: `token-${build.providerId}-${build.metadata?.travelGoods?.intent ?? "x"}`,
        metadata: build.metadata?.travelGoods
          ? { travelGoods: { intent: build.metadata.travelGoods.intent, imageUrl: build.metadata.travelGoods.imageUrl } }
          : undefined,
      }),
    );
  }

  it("eligible trip → travel goods cards (max 3) alongside service prep", async () => {
    const persist = persistEcho();
    const tossBuilds: AffiliateOfferBuild[] = [
      {
        providerId: "toss_shopping",
        category: "travel_goods",
        placement: "preparation",
        title: "보조배터리 A",
        description: "d",
        ctaLabel: TOSS_TRAVEL_GOODS_CTA,
        destinationLabel: "오사카",
        targetUrl: "https://toss.shopping/_m/a",
        affiliateNetwork: "toss",
        metadata: { travelGoods: { intent: "power_bank" } },
      },
      {
        providerId: "toss_shopping",
        category: "travel_goods",
        placement: "preparation",
        title: "방수팩 B",
        description: "d",
        ctaLabel: TOSS_TRAVEL_GOODS_CTA,
        destinationLabel: "오사카",
        targetUrl: "https://toss.shopping/_m/b",
        affiliateNetwork: "toss",
        metadata: { travelGoods: { intent: "waterproof_pouch" } },
      },
    ];

    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION,
      plan: planWithBeach(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "airalo",
            categories: ["esim"],
            supportedPlacements: ["preparation"],
            enabled: true,
          }),
          createFakeAffiliateDefinition({
            id: "toss_shopping",
            categories: ["travel_goods"],
            supportedPlacements: ["preparation"],
            enabled: true,
          }),
        ],
        adapters: new Map([
          ["airalo", createFakeAffiliateAdapter({ providerId: "airalo", targetUrl: "https://example.com/esim" })],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        buildDiscovery: async () => ({ tiqets: null, klook: null }),
        buildTossTravelGoods: async () => tossBuilds,
      },
    });

    const goods = dto.preparation.filter((o) => o.category === "travel_goods");
    const services = dto.preparation.filter((o) => o.category !== "travel_goods");
    expect(services.some((o) => o.providerId === "airalo")).toBe(true);
    expect(goods.length).toBe(2);
    expect(goods.every((o) => o.ctaLabel === TOSS_TRAVEL_GOODS_CTA)).toBe(true);
    expect(JSON.stringify(dto)).not.toContain("toss.shopping");
    expect(dto.disclosure).toBeTruthy();
  });

  it("Toss toggle false → zero Toss builds", async () => {
    const buildToss = vi.fn(async () => []);
    await buildAffiliateOffersForSession({
      sessionId: SESSION,
      plan: planWithBeach(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "toss_shopping",
            categories: ["travel_goods"],
            enabled: false,
          }),
        ],
        adapters: new Map(),
        persist: persistEcho() as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        buildDiscovery: async () => ({ tiqets: null, klook: null }),
        buildTossTravelGoods: buildToss,
      },
    });
    expect(buildToss).not.toHaveBeenCalled();
  });

  it("Toss API fail does not drop Airalo", async () => {
    const persist = persistEcho();
    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION,
      plan: planWithBeach(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "airalo",
            categories: ["esim"],
            supportedPlacements: ["preparation"],
            enabled: true,
          }),
          createFakeAffiliateDefinition({
            id: "toss_shopping",
            categories: ["travel_goods"],
            supportedPlacements: ["preparation"],
            enabled: true,
          }),
        ],
        adapters: new Map([
          ["airalo", createFakeAffiliateAdapter({ providerId: "airalo", targetUrl: "https://example.com/esim" })],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        buildDiscovery: async () => ({ tiqets: null, klook: null }),
        buildTossTravelGoods: async () => {
          throw new Error("boom");
        },
      },
    });
    expect(dto.preparation.some((o) => o.providerId === "airalo")).toBe(true);
    expect(dto.preparation.filter((o) => o.category === "travel_goods")).toHaveLength(0);
  });
});
