import { describe, expect, it, vi } from "vitest";
import { isPlannerAffiliateMasterEnabled, parseAffiliateEnvToggle } from "@/config/affiliateRollout";
import {
  createFakeAffiliateAdapter,
} from "@/lib/affiliate/planner/__tests__/fixtures";
import {
  getItemOffersForDay,
  getUnattachedDayOffers,
} from "@/lib/affiliate/planner/contextualOffers";
import {
  DAY_ACTIVITY_ITEM_MAX,
  selectActivityItemTargets,
  TRIP_ACTIVITY_ITEM_MAX,
} from "@/lib/affiliate/planner/eligibility";
import {
  applyAffiliateProviderEnvOverrides,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
} from "@/lib/affiliate/planner/providerConfig";
import { getProductionAffiliateProviderDefinitions } from "@/lib/affiliate/planner/registry";
import { routeAffiliateOffer } from "@/lib/affiliate/planner/router";
import type {
  AffiliateOffer,
  AffiliateRoutingContext,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";

function enabledOf(defs: ReturnType<typeof getProductionAffiliateProviderDefinitions>) {
  return Object.fromEntries(defs.map((d) => [d.id, d.enabled]));
}

function ctx(overrides: Partial<AffiliateRoutingContext>): AffiliateRoutingContext {
  return {
    plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
    destination: { text: "오사카", countryCode: "JP" },
    dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-03", durationDays: 3 },
    travelers: { adults: 1, children: 0 },
    companionType: "solo",
    interests: [],
    pace: "balanced",
    placement: "day_item",
    category: "activity",
    sourceProductId: null,
    ...overrides,
  };
}

describe("PR-9AF provider env toggles", () => {
  it("parser accepts true/1/false/0 only", () => {
    expect(parseAffiliateEnvToggle("true")).toBe(true);
    expect(parseAffiliateEnvToggle("1")).toBe(true);
    expect(parseAffiliateEnvToggle("false")).toBe(false);
    expect(parseAffiliateEnvToggle("0")).toBe(false);
    expect(parseAffiliateEnvToggle("yes")).toBeNull();
    expect(parseAffiliateEnvToggle("TRUE")).toBeNull();
    expect(parseAffiliateEnvToggle("")).toBeNull();
    expect(parseAffiliateEnvToggle(undefined)).toBeNull();
  });

  it("no env → committed catalog defaults (Aviasales ON, WeGoTrip/Airalo/Stay22 OFF)", () => {
    const enabled = enabledOf(getProductionAffiliateProviderDefinitions({}));
    expect(enabled.aviasales).toBe(true);
    expect(enabled.wegotrip).toBe(false);
    expect(enabled.airalo).toBe(false);
    expect(enabled.stay22).toBe(false);
  });

  it("ENABLE_PLANNER_AFFILIATE_STAY22: true/1 enable, false/0 disable, invalid keeps default OFF", () => {
    const stay22 = (raw: string | undefined) =>
      enabledOf(getProductionAffiliateProviderDefinitions({ ENABLE_PLANNER_AFFILIATE_STAY22: raw }))
        .stay22;
    expect(stay22("true")).toBe(true);
    expect(stay22("1")).toBe(true);
    expect(stay22("false")).toBe(false);
    expect(stay22("0")).toBe(false);
    expect(stay22("yes")).toBe(false);
    expect(stay22(undefined)).toBe(false);
    expect(
      isPlannerAffiliateMasterEnabled({ ENABLE_PLANNER_AFFILIATE_STAY22: "true" }),
    ).toBe(false);
  });

  it("env true enables WeGoTrip/Airalo; env false disables Aviasales", () => {
    const enabled = enabledOf(
      getProductionAffiliateProviderDefinitions({
        ENABLE_PLANNER_AFFILIATE_AVIASALES: "false",
        ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "true",
        ENABLE_PLANNER_AFFILIATE_AIRALO: "1",
      }),
    );
    expect(enabled.aviasales).toBe(false);
    expect(enabled.wegotrip).toBe(true);
    expect(enabled.airalo).toBe(true);
  });

  it("invalid env values keep catalog defaults", () => {
    const enabled = enabledOf(
      getProductionAffiliateProviderDefinitions({
        ENABLE_PLANNER_AFFILIATE_AVIASALES: "off",
        ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "yes",
        ENABLE_PLANNER_AFFILIATE_AIRALO: "enabled",
      }),
    );
    expect(enabled.aviasales).toBe(true);
    expect(enabled.wegotrip).toBe(false);
    expect(enabled.airalo).toBe(false);
  });

  it("overrides never mutate the committed catalog and leave catalog-only providers alone", () => {
    const before = enabledOf(PLANNER_AFFILIATE_PROVIDER_CATALOG);
    const after = applyAffiliateProviderEnvOverrides(PLANNER_AFFILIATE_PROVIDER_CATALOG, {
      ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "true",
      ENABLE_PLANNER_AFFILIATE_KLOOK: "true",
    });
    expect(enabledOf(PLANNER_AFFILIATE_PROVIDER_CATALOG)).toEqual(before);
    expect(enabledOf(after).wegotrip).toBe(true);
    expect(enabledOf(after).klook).toBe(before.klook);
  });

  it("provider toggles do not turn on the master switch", () => {
    expect(
      isPlannerAffiliateMasterEnabled({
        ENABLE_PLANNER_AFFILIATE_AVIASALES: "true",
        ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "true",
        ENABLE_PLANNER_AFFILIATE_AIRALO: "true",
        ENABLE_PLANNER_AFFILIATE_STAY22: "true",
      }),
    ).toBe(false);
  });

  it("provider disabled by env → adapter never builds (no external request)", async () => {
    const onBuild = vi.fn();
    const { offer } = await routeAffiliateOffer({
      context: ctx({ placeName: "USJ", dayNumber: 1, itemOrder: 2 }),
      providers: getProductionAffiliateProviderDefinitions({
        ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "false",
      }),
      adapters: new Map([["wegotrip", createFakeAffiliateAdapter({ providerId: "wegotrip", onBuild })]]),
    });
    expect(offer).toBeNull();
    expect(onBuild).not.toHaveBeenCalled();
  });

  it("provider enabled by env → eligible and builds", async () => {
    const onBuild = vi.fn();
    const { offer } = await routeAffiliateOffer({
      context: ctx({ placeName: "USJ", dayNumber: 1, itemOrder: 2 }),
      providers: getProductionAffiliateProviderDefinitions({
        ENABLE_PLANNER_AFFILIATE_WEGOTRIP: "true",
      }),
      adapters: new Map([["wegotrip", createFakeAffiliateAdapter({ providerId: "wegotrip", onBuild })]]),
    });
    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(offer?.providerId).toBe("wegotrip");
    expect(offer?.itemOrder).toBe(2);
  });
});

type CandidateItem = { order: number; type: string; name: string; bookingRecommended: boolean };

function item(order: number, type: string, bookingRecommended: boolean, name = `p${order}`): CandidateItem {
  return { order, type, name, bookingRecommended };
}

describe("PR-9AF per-item activity targets", () => {
  it("attaches to the bookingRecommended attraction, not the first item", () => {
    const targets = selectActivityItemTargets([
      {
        day: 1,
        items: [item(1, "food", false, "식당"), item(2, "attraction", true, "유니버설 스튜디오 재팬")],
      },
    ]);
    expect(targets).toEqual([
      { dayNumber: 1, itemOrder: 2, itemType: "attraction", placeName: "유니버설 스튜디오 재팬" },
    ]);
  });

  it("prefers bookingRecommended items and does not flood every attraction", () => {
    const targets = selectActivityItemTargets([
      {
        day: 1,
        items: [
          item(1, "attraction", false),
          item(2, "attraction", true),
          item(3, "activity", true),
          item(4, "attraction", true),
          item(5, "food", true),
        ],
      },
    ]);
    expect(targets.map((t) => t.itemOrder)).toEqual([2, 3]);
    expect(targets.length).toBe(DAY_ACTIVITY_ITEM_MAX);
  });

  it("caps per trip", () => {
    const days = Array.from({ length: 5 }, (_, i) => ({
      day: i + 1,
      items: [item(1, "attraction", true), item(2, "activity", true)],
    }));
    const targets = selectActivityItemTargets(days);
    expect(targets.length).toBe(TRIP_ACTIVITY_ITEM_MAX);
    expect(targets.at(-1)).toMatchObject({ dayNumber: 3, itemOrder: 2 });
  });

  it("no bookingRecommended activity → no targets", () => {
    expect(
      selectActivityItemTargets([
        { day: 1, items: [item(1, "attraction", false), item(2, "food", true)] },
      ]),
    ).toEqual([]);
  });
});

function offer(token: string, metadata?: AffiliateOffer["metadata"]): AffiliateOffer {
  return {
    offerId: `id-${token}`,
    providerId: "wegotrip",
    category: "activity",
    placement: "day_item",
    title: "투어",
    description: null,
    ctaLabel: "이 장소의 투어·티켓 보기",
    destinationLabel: "오사카",
    trackingToken: token,
    metadata,
  };
}

describe("PR-9AF contextual offer mapping", () => {
  const dto: PlannerAffiliateOffersDto = {
    summary: [],
    preparation: [],
    days: {
      "1": [
        offer("a", { dayNumber: 1, itemOrder: 2 }),
        offer("dup", { dayNumber: 1, itemOrder: 2 }),
        offer("b", { dayNumber: 1 }),
        offer("wrong-day", { dayNumber: 2, itemOrder: 1 }),
      ],
    },
    disclosure: "고지",
  };

  it("maps offers to the exact dayNumber + itemOrder; first offer per item wins", () => {
    const byOrder = getItemOffersForDay(dto, 1);
    expect([...byOrder.keys()]).toEqual([2]);
    expect(byOrder.get(2)?.trackingToken).toBe("a");
    expect(getItemOffersForDay(dto, 2).size).toBe(0);
  });

  it("offers without itemOrder stay day-level; mismatched day is dropped", () => {
    expect(getUnattachedDayOffers(dto, 1).map((o) => o.trackingToken)).toEqual(["b"]);
  });
});
