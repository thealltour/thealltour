import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import {
  createFakeAffiliateAdapter,
  createFakeAffiliateDefinition,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { AFFILIATE_DISCLOSURE_KO } from "@/lib/affiliate/planner/copy";
import type { PlannerActivityDiscoveryDto } from "@/lib/affiliate/planner/discovery/types";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const plan: PlannerPlan = {
  title: "t",
  summary: "s",
  destination: { name: "오사카", country: "JP" },
  tripOverview: {
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    nights: 0,
    days: 1,
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
          name: "오사카성",
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

const TIQETS: PlannerActivityDiscoveryDto["tiqets"] = {
  providerId: "tiqets",
  kind: "product_widget",
  products: [
    { providerId: "tiqets", productId: "1108257", title: "Osaka Castle Museum", matchConfidence: "exact", dayNumber: 1, itemOrder: 1 },
  ],
};
const KLOOK: PlannerActivityDiscoveryDto["klook"] = {
  providerId: "klook",
  kind: "city_widget",
  cityId: "29",
  cityLabel: "오사카",
  categoryId: "2",
};

async function build(params: { discovery: PlannerActivityDiscoveryDto | null; withSummary?: boolean }) {
  const flightDef = createFakeAffiliateDefinition({
    id: "aviasales",
    categories: ["flight"],
    supportedPlacements: ["planner_summary"],
  });
  return buildAffiliateOffersForSession({
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    plan,
    input: createEmptyPlannerDraftInput("오사카"),
    sourceProductId: null,
    deps: {
      providers: params.withSummary ? [flightDef] : [],
      adapters: new Map([["aviasales", createFakeAffiliateAdapter({ providerId: "aviasales" })]]),
      persist: vi.fn(async ({ build }: { build: { providerId: string } }) => ({
        offerId: "o1",
        providerId: build.providerId,
        category: "flight",
        placement: "planner_summary",
        title: "t",
        description: null,
        ctaLabel: "c",
        destinationLabel: "오사카",
        trackingToken: "tok",
      }) satisfies AffiliateOffer) as never,
      resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
      buildDiscovery: vi.fn(async () => params.discovery),
    },
  });
}

describe("PR-9AN backend disclosure includes activity discovery", () => {
  it("routed summary offer only → existing disclosure copy (unchanged)", async () => {
    const dto = await build({ discovery: null, withSummary: true });
    expect(dto.summary).toHaveLength(1);
    expect(dto.disclosure).toBe(AFFILIATE_DISCLOSURE_KO);
  });

  it("Tiqets discovery only → disclosure", async () => {
    const dto = await build({ discovery: { tiqets: TIQETS, klook: null } });
    expect(dto.summary).toEqual([]);
    expect(dto.disclosure).toBe(AFFILIATE_DISCLOSURE_KO);
  });

  it("Klook discovery only → disclosure", async () => {
    const dto = await build({ discovery: { tiqets: null, klook: KLOOK } });
    expect(dto.disclosure).toBe(AFFILIATE_DISCLOSURE_KO);
  });

  it("summary + both discovery widgets → one disclosure value", async () => {
    const dto = await build({ discovery: { tiqets: TIQETS, klook: KLOOK }, withSummary: true });
    expect(dto.disclosure).toBe(AFFILIATE_DISCLOSURE_KO);
    expect(dto.activityDiscovery).toEqual({ tiqets: TIQETS, klook: KLOOK });
  });

  it("no offers and no discovery → null", async () => {
    expect((await build({ discovery: null })).disclosure).toBeNull();
    expect((await build({ discovery: { tiqets: null, klook: null } })).disclosure).toBeNull();
  });
});
