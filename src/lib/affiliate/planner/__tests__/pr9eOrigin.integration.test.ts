import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { createFakeAffiliateDefinition } from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createAviasalesAdapter } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  resolveAviasalesLocationIata,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
} from "@/lib/affiliate/planner/registry";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { normalizePlannerDraftInput } from "@/lib/planner/normalizeDraftInput";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { ENABLE_PLANNER_AFFILIATE_ROUTER } from "@/config/featureFlags";

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

describe("PR-9E origin + Aviasales wiring", () => {
  it("legacy draft without origin normalizes safely", () => {
    const draft = normalizePlannerDraftInput({
      destination: { text: "오사카" },
      dates: {
        mode: "fixed",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        durationDays: 3,
      },
    });
    expect(draft.origin).toEqual({ text: "" });
    expect(draft.destination.text).toBe("오사카");
  });

  it("resolveAviasalesLocationIata reuses autocomplete cache path", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          { type: "city", code: "SEL", name: "Seoul", country_code: "KR", weight: 100 },
        ]),
        { status: 200 },
      ),
    );
    const cache = createMemoryAviasalesCache();
    const resolved = await resolveAviasalesLocationIata({
      locationText: "서울",
      deps: { fetchImpl: fetchImpl as never, cache },
    });
    expect(resolved?.iata).toBe("SEL");
    expect(resolved?.iata).not.toBe("ICN");
  });

  it("buildOffers resolves origin once → flight offer when aviasales test-enabled", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo) => {
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

    const resolveOriginIata = vi.fn(async () => ({
      iata: "SEL",
      name: "Seoul",
      type: "city" as const,
      countryCode: "KR",
      sourceCode: "SEL",
    }));

    const persist = vi.fn(async ({ build }: { build: { providerId: string } }) => {
      return {
        offerId: "o-flight",
        providerId: build.providerId,
        category: "flight",
        placement: "planner_summary",
        title: "항공권 가격 확인",
        description: null,
        ctaLabel: "항공권 보기",
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

    const draft = createEmptyPlannerDraftInput("Osaka", "서울");
    draft.dates = {
      mode: "fixed",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      durationDays: 5,
    };

    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input: draft,
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
        persist: persist as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata,
      },
    });

    expect(resolveOriginIata).toHaveBeenCalledTimes(1);
    expect(resolveOriginIata).toHaveBeenCalledWith(
      expect.objectContaining({ locationText: "서울" }),
    );
    expect(dto.summary.some((o) => o.providerId === "aviasales")).toBe(true);
  });

  it("origin resolve failure → no flight offer; WeGoTrip path unchanged", async () => {
    const fetchImpl = vi.fn();
    const avia = createAviasalesAdapter({
      cache: createMemoryAviasalesCache(),
      fetchImpl: fetchImpl as never,
      getApiToken: () => "tok",
    });

    const dto = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input: createEmptyPlannerDraftInput("Osaka", "존재하지않는도시xyz"),
      sourceProductId: null,
      deps: {
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
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata: async () => null,
      },
    });

    expect(dto.summary.filter((o) => o.providerId === "aviasales")).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips origin resolve when no enabled flight provider (lazy)", async () => {
    const resolveOriginIata = vi.fn();
    await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: plan(),
      input: createEmptyPlannerDraftInput("Osaka", "서울"),
      sourceProductId: null,
      deps: {
        providers: [
          createFakeAffiliateDefinition({
            id: "aviasales",
            categories: ["flight"],
            supportedPlacements: ["planner_summary"],
            enabled: false,
          }),
        ],
        adapters: new Map(),
        persist: vi.fn(async () => null) as never,
        resolveDestination: async () => ({ text: "Osaka", countryCode: "JP" }),
        resolveOriginIata,
      },
    });
    expect(resolveOriginIata).not.toHaveBeenCalled();
  });

  it("production: aviasales may be enabled after live PASS; Airalo/WeGoTrip stay false; master flag false", () => {
    const defs = getProductionAffiliateProviderDefinitions();
    const avia = defs.find((d) => d.id === "aviasales");
    const airalo = defs.find((d) => d.id === "airalo");
    const wego = defs.find((d) => d.id === "wegotrip");
    expect(avia).toBeTruthy();
    expect(avia?.supportedDateModes).toEqual(["fixed"]);
    expect(airalo?.enabled).toBe(false);
    expect(wego?.enabled).toBe(false);
    expect(getProductionAffiliateAdapters().has("aviasales")).toBe(true);
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
    // Prefer enabled:true only after live acceptance; otherwise false + LIVE PENDING.
    expect(avia?.enabled).toBe(true);
  });
});
