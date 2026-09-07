import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import type { AffiliateDestination, AffiliateOffer } from "@/lib/affiliate/planner/types";
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
            bookingRecommended: false,
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
    expect(result.disclosure).toBeTruthy();
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
