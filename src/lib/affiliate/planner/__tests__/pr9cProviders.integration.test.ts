import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { createAiraloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createMemoryAiraloCatalogCache } from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { createWeGoTripAdapter } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripAdapter";
import { createMemoryWeGoTripCache } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripCache";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createFakeAffiliateDefinition } from "@/lib/affiliate/planner/__tests__/fixtures";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
} from "@/lib/affiliate/planner/registry";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type { AffiliateOffer, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const AIRALO_FEED = `<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0"><channel>
<item>
  <g:id>jp-1</g:id><g:title>JP</g:title>
  <g:link>https://www.airalo.com/japan-esim/jp-1</g:link>
  <g:price>4.00 USD</g:price><g:availability>in stock</g:availability>
  <g:product_type>esim &gt; Asia &gt; Japan &gt; Data &gt; 1GB &gt; 7 Days</g:product_type>
  <g:is_bundle>false</g:is_bundle>
</item></channel></rss>`;

function plan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "Osaka", country: "JP" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
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
            name: "Castle",
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

function baseCtx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "Osaka", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-05", durationDays: 5 },
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: [],
    pace: "balanced",
    placement: "preparation",
    category: "esim",
    sourceProductId: null,
    ...overrides,
  };
}

describe("PR-9C router integration", () => {
  it("production registers adapters but keeps providers disabled", () => {
    const adapters = getProductionAffiliateAdapters();
    expect(adapters.size).toBe(3);
    expect(adapters.has("airalo")).toBe(true);
    expect(adapters.has("wegotrip")).toBe(true);
    expect(adapters.has("aviasales")).toBe(true);
    const defs = getProductionAffiliateProviderDefinitions();
    expect(defs.find((d) => d.id === "airalo")?.enabled).toBe(false);
    expect(defs.find((d) => d.id === "wegotrip")?.enabled).toBe(false);
    expect(defs.find((d) => d.id === "aviasales")?.enabled).toBe(true);
    expect(defs.find((d) => d.id === "airalo")?.capabilities).toEqual({
      deepLink: true,
      search: false,
      api: false,
      widget: false,
    });
    expect(defs.find((d) => d.id === "wegotrip")?.supportedPlacements).toEqual(["day_item"]);
  });

  it("enabled Airalo + country context → preparation offer with attribution", async () => {
    const persist = vi.fn(async ({ build }: { build: { providerSubId?: string | null; affiliateNetwork?: string | null; sourceUrlHost?: string | null } }) => {
      expect(build.providerSubId).toMatch(/^tp_/);
      expect(build.affiliateNetwork).toBe("travelpayouts");
      expect(build.sourceUrlHost).toContain("airalo");
      return {
        offerId: "o1",
        providerId: "airalo",
        category: "esim",
        placement: "preparation",
        title: "t",
        description: null,
        ctaLabel: "cta",
        destinationLabel: "Osaka",
        trackingToken: "tok",
      } satisfies AffiliateOffer;
    });

    const airalo = createAiraloAdapter({
      cache: createMemoryAiraloCatalogCache(),
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response(AIRALO_FEED, { status: 200 })) as never,
      createCommerceTarget: async () => ({
        affiliateUrl: "https://tp.media/r?a=1",
        providerSubId: "tp_dddddddddddddddddddddddd",
        affiliateNetwork: "travelpayouts",
        campaignId: "541",
        sourceUrlHost: "www.airalo.com",
      }),
    });

    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input: createEmptyPlannerDraftInput("Osaka"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "airalo",
            categories: ["esim"],
            supportedPlacements: ["preparation"],
            enabled: true,
            network: "travelpayouts",
          }),
        ],
        adapters: new Map([["airalo", airalo]]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
      },
    });

    expect(dto.preparation).toHaveLength(1);
    expect(dto.preparation[0]?.providerId).toBe("airalo");
    expect("targetUrl" in dto.preparation[0]!).toBe(false);
    expect(persist).toHaveBeenCalled();
  });

  it("Airalo no country match → no preparation offer", async () => {
    const airalo = createAiraloAdapter({
      cache: createMemoryAiraloCatalogCache(),
      feedUrl: "https://example.com/feed.xml",
      fetchImpl: (async () => new Response(AIRALO_FEED, { status: 200 })) as never,
      createCommerceTarget: vi.fn(),
    });
    const { offer } = await routeAffiliateOffer({
      context: baseCtx({ destination: { text: "Osaka", countryCode: "FR" } }),
      providers: [
        createFakeAffiliateDefinition({
          id: "airalo",
          categories: ["esim"],
          supportedPlacements: ["preparation"],
          enabled: true,
        }),
      ],
      adapters: new Map([["airalo", airalo]]),
    });
    expect(offer).toBeNull();
  });

  it("WeGoTrip API failure does not break planner build", async () => {
    const wego = createWeGoTripAdapter({
      cache: createMemoryWeGoTripCache(),
      fetchImpl: (async () => {
        throw new Error("network down");
      }) as never,
      createCommerceTarget: vi.fn(),
    });
    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input: createEmptyPlannerDraftInput("Osaka"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "wegotrip",
            categories: ["activity"],
            supportedPlacements: ["day_item"],
            enabled: true,
            network: "travelpayouts",
          }),
        ],
        adapters: new Map([["wegotrip", wego]]),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
      },
    });
    expect(dto.days).toEqual({});
    expect(dto.disclosure).toBeNull();
  });

  it("respects day slot limit of 1", async () => {
    const wego = createWeGoTripAdapter({
      cache: createMemoryWeGoTripCache(),
      fetchImpl: vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/languages/")) return new Response("{}", { status: 404 });
        if (url.includes("/currencies/")) {
          return new Response(JSON.stringify({ data: [{ code: "USD" }] }), { status: 200 });
        }
        if (url.includes("/search/")) {
          return new Response(
            JSON.stringify({
              data: {
                results: [{ id: 1853909, name: "Osaka", slug: "osaka", type: "city", available: true }],
              },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            data: {
              results: [
                {
                  id: 1,
                  title: "Tour",
                  slug: "tour",
                  available: true,
                  city: { id: 1853909, name: "Osaka", slug: "osaka" },
                },
              ],
            },
          }),
          { status: 200 },
        );
      }) as never,
      createCommerceTarget: async () => ({
        affiliateUrl: "https://tp.media/r?w=1",
        providerSubId: "tp_eeeeeeeeeeeeeeeeeeeeeeee",
        affiliateNetwork: "travelpayouts",
        sourceUrlHost: "wegotrip.com",
      }),
    });

    const multiDayPlan = plan();
    multiDayPlan.days[0]!.items.push({
      order: 2,
      time: "14:00",
      type: "attraction",
      name: "Second",
      area: null,
      description: "d",
      estimatedDurationMinutes: 60,
      travelToNext: null,
      bookingRecommended: false,
    });

    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: multiDayPlan,
      input: createEmptyPlannerDraftInput("Osaka"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "wegotrip",
            categories: ["activity"],
            supportedPlacements: ["day_item"],
            enabled: true,
          }),
        ],
        adapters: new Map([["wegotrip", wego]]),
        persist: vi.fn(async ({ build }) => ({
          offerId: `id-${build.itemOrder}`,
          providerId: build.providerId,
          category: build.category,
          placement: build.placement,
          title: build.title,
          description: build.description,
          ctaLabel: build.ctaLabel,
          destinationLabel: "Osaka",
          trackingToken: "tok",
        })) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
      },
    });

    expect(dto.days["1"]).toHaveLength(1);
  });
});
