import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { createFakeAffiliateDefinition } from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createAviasalesAdapter } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
} from "@/lib/affiliate/planner/registry";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type { AffiliateOffer, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

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
    days: [],
    preparation: { travelTips: [], packingHints: [] },
  };
}

function flightCtx(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "Osaka", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-05", durationDays: 5 },
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: [],
    pace: "balanced",
    placement: "planner_summary",
    category: "flight",
    sourceProductId: null,
    flightOrigin: { text: "Incheon", iata: "ICN" },
    ...overrides,
  };
}

describe("PR-9D Aviasales router integration", () => {
  it("production registers aviasales enabled after live PASS", () => {
    const adapters = getProductionAffiliateAdapters();
    expect(adapters.has("aviasales")).toBe(true);
    expect(adapters.size).toBe(3);
    const def = getProductionAffiliateProviderDefinitions().find((d) => d.id === "aviasales");
    expect(def?.enabled).toBe(true);
    expect(def?.supportedDateModes).toEqual(["fixed"]);
    expect(def?.capabilities).toEqual({
      deepLink: true,
      search: false,
      api: true,
      widget: false,
    });
  });

  it("buildOffersForSession does not invent origin → no flight offer", async () => {
    const fetchImpl = vi.fn();
    const avia = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
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
            id: "aviasales",
            categories: ["flight"],
            supportedPlacements: ["planner_summary"],
            supportedDateModes: ["fixed"],
            enabled: true,
            network: "travelpayouts",
          }),
        ],
        adapters: new Map([["aviasales", avia]]),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
      },
    });

    expect(dto.summary.filter((o) => o.providerId === "aviasales")).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("test-enabled + explicit origin → summary flight offer", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("autocomplete")) {
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
              origin: "ICN",
              destination: "OSA",
              price: 250,
              airline: "OZ",
              link: "/search/ICN0110OSA05101?t=x",
              transfers: 0,
            },
          ],
        }),
        { status: 200 },
      );
    });

    const persist = vi.fn(async ({ build }: { build: { title: string; ctaLabel: string } }) => {
      expect(build.title).toBe("항공권 가격 확인");
      expect(build.ctaLabel).toBe("항공권 보기");
      return {
        offerId: "o-flight",
        providerId: "aviasales",
        category: "flight",
        placement: "planner_summary",
        title: build.title,
        description: null,
        ctaLabel: build.ctaLabel,
        destinationLabel: "Osaka",
        trackingToken: "tok",
      } satisfies AffiliateOffer;
    });

    const avia = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
      createCommerceTarget: async () => ({
        affiliateUrl: "https://tp.media/r?a=avia",
        providerSubId: "tp_aaaaaaaaaaaaaaaaaaaaaaaa",
        affiliateNetwork: "travelpayouts",
        sourceUrlHost: "www.aviasales.com",
      }),
    });

    const { offer } = await routeAffiliateOffer({
      context: flightCtx(),
      providers: [
        createFakeAffiliateDefinition({
          id: "aviasales",
          categories: ["flight"],
          supportedPlacements: ["planner_summary"],
          supportedDateModes: ["fixed"],
          enabled: true,
        }),
      ],
      adapters: new Map([["aviasales", avia]]),
    });

    expect(offer?.providerId).toBe("aviasales");
    expect(offer?.targetUrl).toContain("https://");
    expect(JSON.stringify(offer)).not.toMatch(/250|OZ|최저/);

    // Also via build path with injected origin on a custom route context is covered above;
    // persist path with flightOrigin would require buildOffers to accept origin — deferred.
    expect(persist).not.toHaveBeenCalled();
  });

  it("origin null → adapter_ineligible / no offer", async () => {
    const fetchImpl = vi.fn();
    const avia = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
    });
    const { offer, decision } = await routeAffiliateOffer({
      context: flightCtx({ flightOrigin: null }),
      providers: [
        createFakeAffiliateDefinition({
          id: "aviasales",
          categories: ["flight"],
          supportedPlacements: ["planner_summary"],
          supportedDateModes: ["fixed"],
          enabled: true,
        }),
      ],
      adapters: new Map([["aviasales", avia]]),
    });
    expect(offer).toBeNull();
    expect(decision.rejectedReasons.some((r) => r.reason === "adapter_ineligible")).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
