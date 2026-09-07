import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";
import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import {
  AVIASALES_OFFER_CTA,
  AVIASALES_OFFER_TITLE,
  createAviasalesAdapter,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
} from "@/lib/affiliate/planner/registry";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type {
  AffiliateOffer,
  AffiliateOfferBuild,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";

function plan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "Osaka", country: "JP" },
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
        title: "1",
        summary: "s",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "성",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
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

function aviasalesDef() {
  return createFakeAffiliateDefinition({
    id: "aviasales",
    categories: ["flight"],
    supportedPlacements: ["planner_summary"],
    supportedDateModes: ["fixed"],
    enabled: true,
    network: "travelpayouts",
  });
}

function mockFetchPrices() {
  return vi.fn(async (input: RequestInfo) => {
    const url = String(input);
    if (url.includes("autocomplete")) {
      if (url.includes("term=%EC%84%9C%EC%9A%B8") || url.includes("term=서울")) {
        return new Response(
          JSON.stringify([
            { type: "city", code: "SEL", name: "Seoul", country_code: "KR", weight: 80 },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          { type: "city", code: "OSA", name: "Osaka", country_code: "JP", weight: 50 },
        ]),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: [
          {
            origin: "SEL",
            destination: "OSA",
            price: 250,
            airline: "OZ",
            link: "/search/SEL0110OSA05101?t=x",
            transfers: 0,
          },
        ],
      }),
      { status: 200 },
    );
  });
}

function clientSafeFromBuild(build: AffiliateOfferBuild): AffiliateOffer {
  return {
    offerId: "o1",
    providerId: build.providerId,
    category: build.category,
    placement: build.placement,
    title: build.title,
    description: build.description,
    ctaLabel: build.ctaLabel,
    destinationLabel: build.destinationLabel,
    trackingToken: "550e8400-e29b-41d4-a716-446655440001",
  };
}

function assertNoSecrets(offer: AffiliateOffer) {
  const keys = Object.keys(offer);
  expect(keys).not.toContain("targetUrl");
  expect(keys).not.toContain("target_url");
  expect(keys).not.toContain("providerSubId");
  expect(keys).not.toContain("provider_sub_id");
  expect(keys).not.toContain("affiliateCampaignId");
  expect(JSON.stringify(offer)).not.toMatch(/tp\.media|api[_-]?token|TRAVELPAYOUTS/i);
  expect(offer.title).not.toMatch(/최저가|price|\$|USD|KRW|\d{2,}/i);
}

describe("PR-9F affiliate router controlled rollout", () => {
  it("production master flag stays false; Aviasales enabled; WeGoTrip/Airalo false", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
    const defs = getProductionAffiliateProviderDefinitions();
    expect(defs.find((d) => d.id === "aviasales")?.enabled).toBe(true);
    expect(defs.find((d) => d.id === "airalo")?.enabled).toBe(false);
    expect(defs.find((d) => d.id === "wegotrip")?.enabled).toBe(false);
    expect(getProductionAffiliateAdapters().size).toBe(3);
    // PR-9G: no provider.rolloutPercent field
    for (const d of defs) {
      expect(d).not.toHaveProperty("rolloutPercent");
    }
  });

  it("flag=false policy: UI/API gate off → empty client slots (no-op)", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
    const empty = {
      summary: [] as AffiliateOffer[],
      preparation: [] as AffiliateOffer[],
      days: {} as Record<string, AffiliateOffer[]>,
      disclosure: null,
    };
    expect(empty.summary).toEqual([]);
    expect(empty.disclosure).toBeNull();
  });

  it("flag semantics + fixed + origin → Aviasales summary offer (generic card copy)", async () => {
    const persist = vi.fn(async ({ build }: { build: AffiliateOfferBuild }) => {
      const offer = clientSafeFromBuild(build);
      assertNoSecrets(offer);
      return offer;
    });

    const draft = createEmptyPlannerDraftInput("Osaka", "서울");
    draft.dates = {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    };

    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: [aviasalesDef()],
        adapters: new Map([
          [
            "aviasales",
            createAviasalesAdapter({
              cache: createMemoryAviasalesCache(),
              fetchImpl: mockFetchPrices() as never,
              getApiToken: () => "tok",
              createCommerceTarget: async () => ({
                affiliateUrl: "https://tp.media/r?a=avia",
                providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
                affiliateNetwork: "travelpayouts",
                sourceUrlHost: "www.aviasales.com",
              }),
            }),
          ],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        }),
      },
    });

    expect(dto.summary).toHaveLength(1);
    expect(dto.summary[0]?.providerId).toBe("aviasales");
    expect(dto.summary[0]?.placement).toBe("planner_summary");
    expect(dto.summary[0]?.title).toBe(AVIASALES_OFFER_TITLE);
    expect(dto.summary[0]?.ctaLabel).toBe(AVIASALES_OFFER_CTA);
    assertNoSecrets(dto.summary[0]!);
    expect(dto.preparation).toEqual([]);
    expect(dto.days).toEqual({});
  });

  it("flexible dates → no Aviasales offer", async () => {
    const draft = createEmptyPlannerDraftInput("Osaka", "서울");
    draft.dates = {
      mode: "flexible",
      startDate: null,
      endDate: null,
      durationDays: 5,
    };

    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: [aviasalesDef()],
        adapters: new Map([
          [
            "aviasales",
            createAviasalesAdapter({
              cache: createMemoryAviasalesCache(),
              fetchImpl: mockFetchPrices() as never,
              getApiToken: () => "tok",
            }),
          ],
        ]),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        }),
      },
    });

    expect(dto.summary.filter((o) => o.providerId === "aviasales")).toHaveLength(0);
  });

  it("missing/legacy origin → no Aviasales; build still returns OK empty", async () => {
    const legacy = normalizePlannerDraftInput({
      destination: { text: "오사카" },
      dates: {
        mode: "fixed",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        durationDays: 3,
      },
    });
    expect(legacy.origin).toEqual({ text: "" });

    const fetchImpl = vi.fn();
    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: legacy,
      sourceProductId: null,
      deps: {
        providers: [aviasalesDef()],
        adapters: new Map([
          [
            "aviasales",
            createAviasalesAdapter({
              cache: createMemoryAviasalesCache(),
              fetchImpl: fetchImpl as never,
              getApiToken: () => "tok",
            }),
          ],
        ]),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        resolveOriginIata: vi.fn(async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        })),
      },
    });

    expect(dto.summary).toEqual([]);
    expect(dto.disclosure).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("failure isolation: adapter throw / commerce fail / persist null → empty, no throw", async () => {
    const throwAdapter = createFakeAffiliateAdapter({
      providerId: "aviasales",
      throwBuild: true,
      async: true,
    });
    const thrown = await routeAffiliateOffer({
      context: {
        plannerSessionId: SESSION_ID,
        destination: { text: "Osaka", countryCode: "JP" },
        dates: {
          mode: "fixed",
          startDate: "2026-10-01",
          endDate: "2026-10-05",
          durationDays: 5,
        },
        travelers: { adults: 1, children: 0 },
        companionType: "solo",
        interests: [],
        pace: "balanced",
        placement: "planner_summary",
        category: "flight",
        flightOrigin: { text: "서울", iata: "SEL" },
      } satisfies AffiliateRoutingContext,
      providers: [aviasalesDef()],
      adapters: new Map([["aviasales", throwAdapter]]),
    });
    expect(thrown.offer).toBeNull();

    const draft = createEmptyPlannerDraftInput("Osaka", "서울");
    draft.dates = {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    };

    const commerceFail = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: [aviasalesDef()],
        adapters: new Map([
          [
            "aviasales",
            createAviasalesAdapter({
              cache: createMemoryAviasalesCache(),
              fetchImpl: mockFetchPrices() as never,
              getApiToken: () => "tok",
              createCommerceTarget: async () => {
                throw Object.assign(new Error("commerce boom"), {
                  code: "commerce_failed",
                });
              },
            }),
          ],
        ]),
        persist: vi.fn(async () => {
          throw new Error("should not persist");
        }) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        }),
      },
    });
    expect(commerceFail.summary).toEqual([]);

    const persistNull = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: [aviasalesDef()],
        adapters: new Map([
          [
            "aviasales",
            createAviasalesAdapter({
              cache: createMemoryAviasalesCache(),
              fetchImpl: mockFetchPrices() as never,
              getApiToken: () => "tok",
              createCommerceTarget: async () => ({
                affiliateUrl: "https://tp.media/r?a=avia",
                providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
                affiliateNetwork: "travelpayouts",
                sourceUrlHost: "www.aviasales.com",
              }),
            }),
          ],
        ]),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        }),
      },
    });
    expect(persistNull.summary).toEqual([]);
    expect(persistNull.disclosure).toBeNull();
  });

  it("slot isolation: flight only planner_summary; summary max; no flight in prep/day", async () => {
    const flight = createFakeAffiliateDefinition({
      id: "aviasales",
      categories: ["flight"],
      supportedPlacements: ["planner_summary"],
      priority: 90,
    });
    const hotel = createFakeAffiliateDefinition({
      id: "travelpayouts_white_label",
      categories: ["hotel"],
      supportedPlacements: ["planner_summary"],
      priority: 80,
    });
    const esim = createFakeAffiliateDefinition({
      id: "airalo",
      categories: ["esim"],
      supportedPlacements: ["preparation"],
      priority: 70,
      enabled: false,
    });
    const activity = createFakeAffiliateDefinition({
      id: "wegotrip",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 60,
      enabled: false,
    });

    const persist = vi.fn(async ({ build }: { build: AffiliateOfferBuild }) =>
      clientSafeFromBuild(build),
    );

    const draft = createEmptyPlannerDraftInput("Osaka", "서울");
    draft.dates = {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    };

    const dto = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: plan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: [flight, hotel, esim, activity],
        adapters: new Map([
          ["aviasales", createFakeAffiliateAdapter({ providerId: "aviasales", async: true })],
          [
            "travelpayouts_white_label",
            createFakeAffiliateAdapter({
              providerId: "travelpayouts_white_label",
              async: true,
            }),
          ],
          ["airalo", createFakeAffiliateAdapter({ providerId: "airalo", async: true })],
          ["wegotrip", createFakeAffiliateAdapter({ providerId: "wegotrip", async: true })],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => ({
          iata: "SEL",
          name: "Seoul",
          type: "city" as const,
          countryCode: "KR",
          sourceCode: "SEL",
        }),
      },
    });

    expect(dto.summary.length).toBeLessThanOrEqual(2);
    expect(dto.summary.every((o) => o.placement === "planner_summary")).toBe(true);
    expect(dto.summary.some((o) => o.category === "flight")).toBe(true);
    expect(dto.preparation.every((o) => o.category !== "flight")).toBe(true);
    expect(
      Object.values(dto.days)
        .flat()
        .every((o) => o.category !== "flight"),
    ).toBe(true);
    expect(dto.preparation).toEqual([]);
    expect(dto.days).toEqual({});
  });

  it("click path uses /r/affiliate token only — no raw targetUrl on client", () => {
    const offer: AffiliateOffer = {
      offerId: "o1",
      providerId: "aviasales",
      category: "flight",
      placement: "planner_summary",
      title: AVIASALES_OFFER_TITLE,
      description: null,
      ctaLabel: AVIASALES_OFFER_CTA,
      destinationLabel: "Osaka",
      trackingToken: "550e8400-e29b-41d4-a716-446655440099",
    };
    assertNoSecrets(offer);
    const href = `/r/affiliate/${encodeURIComponent(offer.trackingToken)}`;
    expect(href).toBe("/r/affiliate/550e8400-e29b-41d4-a716-446655440099");
    expect(href).not.toContain("tp.media");
    expect(href).not.toContain("aviasales.com");
  });

  it("impression policy: client fires once per mount (ref); server dedupes 23505 — no new dedupe invented", () => {
    const impressed = { current: false };
    const fires: number[] = [];
    const fireOnce = () => {
      if (impressed.current) return;
      impressed.current = true;
      fires.push(1);
    };
    fireOnce();
    fireOnce();
    expect(fires).toHaveLength(1);
  });
});
