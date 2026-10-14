import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createStay22Adapter } from "@/lib/affiliate/planner/providers/stay22/stay22Adapter";
import { getProductionAffiliateProviderDefinitions } from "@/lib/affiliate/planner/registry";
import type {
  AffiliateDestination,
  AffiliateOffer,
  AffiliateOfferBuild,
} from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function samplePlan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: "JP" },
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
            name: "성",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
          {
            order: 2,
            time: "14:00",
            type: "attraction",
            name: "성2",
            area: null,
            description: "d",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: true,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["t"], packingHints: ["p"] },
  };
}

function offerFromBuild(params: {
  build: { providerId: string; category: AffiliateOffer["category"]; placement: AffiliateOffer["placement"] };
}): AffiliateOffer {
  return {
    offerId: `id-${params.build.providerId}`,
    providerId: params.build.providerId,
    category: params.build.category,
    placement: params.build.placement,
    title: "t",
    description: null,
    ctaLabel: "cta",
    destinationLabel: "오사카",
    trackingToken: "tok",
  };
}

describe("buildAffiliateOffersForSession (PR-9B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awaits async route, persists only after resolved build, respects slot limits", async () => {
    const flightDef = createFakeAffiliateDefinition({
      id: "aviasales",
      categories: ["flight"],
      supportedPlacements: ["planner_summary"],
      priority: 90,
    });
    const hotelDef = createFakeAffiliateDefinition({
      id: "travelpayouts_white_label",
      categories: ["hotel", "flight"],
      supportedPlacements: ["planner_summary"],
      priority: 80,
    });
    const activityDef = createFakeAffiliateDefinition({
      id: "klook",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 70,
    });

    const persist = vi.fn(async (params: Parameters<typeof offerFromBuild>[0] & object) =>
      offerFromBuild(params),
    );

    const resolveDestination = vi.fn(
      async (): Promise<AffiliateDestination> => ({
        text: "오사카",
        countryCode: "JP",
        cityCode: null,
        iataCityCode: null,
      }),
    );

    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: samplePlan(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [flightDef, hotelDef, activityDef],
        adapters: new Map([
          [
            "aviasales",
            createFakeAffiliateAdapter({ providerId: "aviasales", async: true }),
          ],
          [
            "travelpayouts_white_label",
            createFakeAffiliateAdapter({
              providerId: "travelpayouts_white_label",
              async: true,
            }),
          ],
          ["klook", createFakeAffiliateAdapter({ providerId: "klook", async: true })],
        ]),
        persist: persist as never,
        resolveDestination,
      },
    });

    expect(resolveDestination).toHaveBeenCalledTimes(1);
    expect(result.summary.length).toBe(2);
    expect(result.days["1"]?.length).toBe(1);
    expect(persist.mock.calls.length).toBe(3);
    const dayBuild = persist.mock.calls
      .map(([call]) => (call as { build: { placement: string; dayNumber?: number | null; itemOrder?: number | null } }).build)
      .find((build) => build.placement === "day_item");
    expect(dayBuild).toMatchObject({ dayNumber: 1, itemOrder: 2 });
    expect(result.disclosure).toBeTruthy();
  });

  it("activity-only result still carries disclosure; one activity failure does not drop the others", async () => {
    const activityDef = createFakeAffiliateDefinition({
      id: "wegotrip",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
      priority: 70,
    });
    const plan = samplePlan();
    plan.days[0]!.items = plan.days[0]!.items.map((item) => ({ ...item, bookingRecommended: true }));
    const persist = vi.fn(async ({ build }: { build: { itemOrder?: number | null } }) => {
      if (build.itemOrder === 2) throw new Error("persist boom");
      return {
        ...offerFromBuild({
          build: { providerId: "wegotrip", category: "activity", placement: "day_item" },
        }),
        metadata: { dayNumber: 1, itemOrder: build.itemOrder ?? undefined },
      };
    });

    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan,
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [activityDef],
        adapters: new Map([["wegotrip", createFakeAffiliateAdapter({ providerId: "wegotrip", async: true })]]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
      },
    });

    expect(result.summary).toEqual([]);
    expect(result.preparation).toEqual([]);
    expect(result.days["1"]?.map((o) => o.metadata?.itemOrder)).toEqual([1]);
    expect(result.disclosure).toBeTruthy();
  });

  it("fixed session + Stay22 enabled → summary hotel offer persisted once via existing token path", async () => {
    const draft = createEmptyPlannerDraftInput("오사카");
    draft.dates = { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 };
    draft.travelers = { adults: 3, children: 0 };
    const persist = vi.fn(async ({ build }: { build: AffiliateOfferBuild }) => ({
      offerId: "hotel-1",
      providerId: build.providerId,
      category: build.category,
      placement: build.placement,
      title: build.title,
      description: build.description,
      ctaLabel: build.ctaLabel,
      destinationLabel: build.destinationLabel,
      trackingToken: "11111111-2222-4333-8444-555555555555",
    }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: samplePlan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: getProductionAffiliateProviderDefinitions({
          ENABLE_PLANNER_AFFILIATE_STAY22: "true",
        }),
        adapters: new Map([["stay22", createStay22Adapter({ env: { STAY22_AID: "test-aid" } })]]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        resolveOriginIata: vi.fn(async () => null),
      },
    });
    vi.unstubAllGlobals();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(persist).toHaveBeenCalledTimes(1);
    const { build } = persist.mock.calls[0]![0];
    expect(build).toMatchObject({
      providerId: "stay22",
      category: "hotel",
      placement: "planner_summary",
      affiliateNetwork: null,
      affiliateCampaignId: "planner_hotel",
      sourceUrlHost: "www.stay22.com",
    });
    const target = new URL(build.targetUrl);
    expect(`${target.origin}${target.pathname}`).toBe("https://www.stay22.com/allez/roam");
    expect(target.searchParams.get("address")).toBe("Osaka, Japan");
    expect(build.title).toBe("오사카 숙소");
    expect(build.destinationLabel).toBe("오사카");
    expect(target.searchParams.get("checkin")).toBe("2027-01-28");
    expect(target.searchParams.get("checkout")).toBe("2027-02-01");
    expect(target.searchParams.get("adults")).toBe("3");

    expect(result.summary).toHaveLength(1);
    expect(result.summary[0]).toMatchObject({
      providerId: "stay22",
      category: "hotel",
      placement: "planner_summary",
    });
    expect("targetUrl" in result.summary[0]!).toBe(false);
    expect(result.disclosure).toBeTruthy();
  });

  it("flexible session + Stay22 enabled → no hotel offer, result still returned", async () => {
    const draft = createEmptyPlannerDraftInput("오사카");
    draft.dates = { mode: "flexible", startDate: null, endDate: null, durationDays: 4 };
    const persist = vi.fn();
    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: samplePlan(),
      input: draft,
      sourceProductId: null,
      deps: {
        providers: getProductionAffiliateProviderDefinitions({
          ENABLE_PLANNER_AFFILIATE_STAY22: "true",
        }),
        adapters: new Map([["stay22", createStay22Adapter({ env: { STAY22_AID: "test-aid" } })]]),
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        resolveOriginIata: vi.fn(async () => null),
      },
    });
    expect(persist).not.toHaveBeenCalled();
    expect(result.summary).toEqual([]);
    expect(result.disclosure).toBeNull();
  });

  it("skips day item routing when no item is bookingRecommended", async () => {
    const activityDef = createFakeAffiliateDefinition({
      id: "wegotrip",
      categories: ["activity"],
      supportedPlacements: ["day_item"],
    });
    const plan = samplePlan();
    plan.days[0]!.items = plan.days[0]!.items.map((item) => ({ ...item, bookingRecommended: false }));
    const onBuild = vi.fn();
    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan,
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [activityDef],
        adapters: new Map([["wegotrip", createFakeAffiliateAdapter({ providerId: "wegotrip", onBuild })]]),
        persist: vi.fn() as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
      },
    });
    expect(onBuild).not.toHaveBeenCalled();
    expect(result.days).toEqual({});
  });

  it("does not persist when build returns null", async () => {
    const def = createFakeAffiliateDefinition({
      id: "aviasales",
      categories: ["flight"],
      supportedPlacements: ["planner_summary"],
      priority: 90,
    });
    const persist = vi.fn();

    const result = await buildAffiliateOffersForSession({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      plan: samplePlan(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: [def],
        adapters: new Map([
          [
            "aviasales",
            createFakeAffiliateAdapter({
              providerId: "aviasales",
              async: true,
              failBuild: true,
            }),
          ],
        ]),
        persist: persist as never,
        resolveDestination: async () => ({
          text: "오사카",
          countryCode: null,
        }),
      },
    });

    expect(persist).not.toHaveBeenCalled();
    expect(result.summary).toEqual([]);
    expect(result.disclosure).toBeNull();
  });
});
