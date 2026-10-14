import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { createKkdayAdapter } from "@/lib/affiliate/planner/providers/kkday/kkdayAdapter";
import { createKlookAdapter } from "@/lib/affiliate/planner/providers/klook/klookAdapter";
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
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000";
const NAMED_ON = {
  ENABLE_PLANNER_AFFILIATE_KLOOK: "true",
  ENABLE_PLANNER_AFFILIATE_KKDAY: "true",
};

type CommerceInput = { sourceUrl: string; providerId: string; allowedHosts?: string[] };

function commerce(providerId: "klook" | "kkday", fail = false) {
  return vi.fn(async (input: CommerceInput) => {
    if (fail) throw Object.assign(new Error("rejected"), { code: "provider_rejected" });
    return {
      affiliateUrl: `https://tp.media/r?${providerId}=1`,
      providerSubId: "tp_cccccccccccccccccccccccc",
      affiliateNetwork: "travelpayouts" as const,
      sourceUrlHost: new URL(input.sourceUrl).hostname,
    };
  });
}

function usjContext(overrides?: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: SESSION_ID,
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2027-01-28", endDate: "2027-02-01", durationDays: 5 },
    travelers: { adults: 3, children: 0 },
    companionType: "friends",
    interests: [],
    pace: "balanced",
    placement: "day_item",
    category: "activity",
    dayNumber: 3,
    itemOrder: 2,
    itemType: "activity",
    placeName: "유니버설 스튜디오 재팬",
    sourceProductId: null,
    ...overrides,
  };
}

function namedAdapters(klookFail = false, kkdayFail = false) {
  const klookCommerce = commerce("klook", klookFail);
  const kkdayCommerce = commerce("kkday", kkdayFail);
  return {
    klookCommerce,
    kkdayCommerce,
    adapters: new Map([
      ["klook", createKlookAdapter({ createCommerceTarget: klookCommerce })],
      ["kkday", createKkdayAdapter({ createCommerceTarget: kkdayCommerce })],
    ]),
  };
}

describe("PR-9AJ catalog + registry", () => {
  it("Klook/KKday default OFF; env toggles turn each on independently", () => {
    const enabled = (env: Record<string, string>) =>
      Object.fromEntries(getProductionAffiliateProviderDefinitions(env).map((d) => [d.id, d.enabled]));
    expect(enabled({})).toMatchObject({ klook: false, kkday: false });
    expect(enabled({ ENABLE_PLANNER_AFFILIATE_KLOOK: "true" })).toMatchObject({ klook: true, kkday: false });
    expect(enabled({ ENABLE_PLANNER_AFFILIATE_KKDAY: "1" })).toMatchObject({ klook: false, kkday: true });
  });

  it("production registry includes klook + kkday adapters with deep-link capability", () => {
    const adapters = getProductionAffiliateAdapters();
    expect(adapters.get("klook")?.providerId).toBe("klook");
    expect(adapters.get("kkday")?.providerId).toBe("kkday");
    const defs = getProductionAffiliateProviderDefinitions({});
    for (const id of ["klook", "kkday"] as const) {
      expect(defs.find((d) => d.id === id)?.capabilities).toEqual({
        deepLink: true,
        search: false,
        api: false,
        widget: false,
      });
    }
  });

  it("default env → named providers rejected as disabled, no Commerce call", async () => {
    const { adapters, klookCommerce, kkdayCommerce } = namedAdapters();
    const { offer, decision } = await routeAffiliateOffer({
      context: usjContext(),
      providers: getProductionAffiliateProviderDefinitions({}),
      adapters,
    });
    expect(offer).toBeNull();
    expect(decision.rejectedReasons).toEqual(
      expect.arrayContaining([
        { providerId: "klook", reason: "disabled" },
        { providerId: "kkday", reason: "disabled" },
      ]),
    );
    expect(klookCommerce).not.toHaveBeenCalled();
    expect(kkdayCommerce).not.toHaveBeenCalled();
  });
});

describe("PR-9AJ routing: priority + fallback (one CTA per item)", () => {
  const providers = getProductionAffiliateProviderDefinitions(NAMED_ON);

  it("both succeed → Klook wins (priority 60 > 55); KKday never built", async () => {
    const { adapters, kkdayCommerce } = namedAdapters();
    const { offer, decision } = await routeAffiliateOffer({ context: usjContext(), providers, adapters });
    expect(offer?.providerId).toBe("klook");
    expect(decision.eligibleProviderIds).toEqual(["klook", "kkday"]);
    expect(kkdayCommerce).not.toHaveBeenCalled();
  });

  it("Klook Commerce failure → KKday fallback", async () => {
    const { adapters, klookCommerce } = namedAdapters(true);
    const { offer, decision } = await routeAffiliateOffer({ context: usjContext(), providers, adapters });
    expect(klookCommerce).toHaveBeenCalledTimes(1);
    expect(offer?.providerId).toBe("kkday");
    expect(offer?.sourceUrlHost).toBe("www.kkday.com");
    expect(decision.rejectedReasons).toContainEqual({ providerId: "klook", reason: "offer_build_failed" });
  });

  it("both fail → no offer", async () => {
    const { adapters } = namedAdapters(true, true);
    const { offer } = await routeAffiliateOffer({ context: usjContext(), providers, adapters });
    expect(offer).toBeNull();
  });

  it("unknown activity → both adapters ineligible, no false CTA, no Commerce call", async () => {
    const { adapters, klookCommerce, kkdayCommerce } = namedAdapters();
    const { offer, decision } = await routeAffiliateOffer({
      context: usjContext({ placeName: "우메다 스카이 빌딩" }),
      providers,
      adapters,
    });
    expect(offer).toBeNull();
    expect(decision.rejectedReasons).toEqual(
      expect.arrayContaining([
        { providerId: "klook", reason: "adapter_ineligible" },
        { providerId: "kkday", reason: "adapter_ineligible" },
      ]),
    );
    expect(klookCommerce).not.toHaveBeenCalled();
    expect(kkdayCommerce).not.toHaveBeenCalled();
  });
});

function item(order: number, name: string, bookingRecommended: boolean, type: "activity" | "attraction") {
  return {
    order,
    time: null,
    type,
    name,
    area: null,
    description: "d",
    estimatedDurationMinutes: 120,
    travelToNext: null,
    bookingRecommended,
  };
}

function osakaPlan(): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2027-01-28",
      endDate: "2027-01-30",
      nights: 2,
      days: 3,
      travelersSummary: "3",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: "2027-01-28",
        title: "1",
        summary: "s",
        items: [
          item(1, "우메다 스카이 빌딩", true, "attraction"),
          item(2, "유니버설 스튜디오 재팬", true, "activity"),
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["t"], packingHints: ["p"] },
  };
}

function persistLikeRepository() {
  return vi.fn(async ({ build }: { build: AffiliateOfferBuild }): Promise<AffiliateOffer> => ({
    offerId: `offer-${build.providerId}-${build.itemOrder}`,
    providerId: build.providerId,
    category: build.category,
    placement: build.placement,
    title: build.title,
    description: build.description,
    ctaLabel: build.ctaLabel,
    destinationLabel: build.destinationLabel,
    trackingToken: "11111111-2222-4333-8444-555555555555",
    metadata: { dayNumber: build.dayNumber ?? undefined, itemOrder: build.itemOrder ?? undefined },
  }));
}

describe("PR-9AJ item independence (buildAffiliateOffersForSession)", () => {
  it("first target unknown (null) no longer skips the later USJ target", async () => {
    const { adapters, klookCommerce } = namedAdapters();
    const persist = persistLikeRepository();

    const result = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: osakaPlan(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: getProductionAffiliateProviderDefinitions(NAMED_ON),
        adapters,
        persist: persist as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        resolveOriginIata: vi.fn(async () => null),
      },
    });

    expect(klookCommerce).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(result.days["1"]).toHaveLength(1);
    expect(result.days["1"]![0]).toMatchObject({
      providerId: "klook",
      category: "activity",
      placement: "day_item",
      title: "유니버설 스튜디오 재팬 입장권",
      ctaLabel: "이 장소의 투어·티켓 보기",
      metadata: { dayNumber: 1, itemOrder: 2 },
    });
    expect(result.summary).toEqual([]);
    expect(result.disclosure).toBeTruthy();
  });

  it("client DTO never carries target/source URLs", async () => {
    const { adapters } = namedAdapters();
    const result = await buildAffiliateOffersForSession({
      sessionId: SESSION_ID,
      plan: osakaPlan(),
      input: createEmptyPlannerDraftInput("오사카"),
      sourceProductId: null,
      deps: {
        providers: getProductionAffiliateProviderDefinitions(NAMED_ON),
        adapters,
        persist: persistLikeRepository() as never,
        resolveDestination: async () => ({ text: "오사카", countryCode: "JP" }),
        resolveOriginIata: vi.fn(async () => null),
      },
    });
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/klook\.com|kkday\.com|tp\.media|targetUrl|providerSubId|sourceUrlHost/);
  });
});
