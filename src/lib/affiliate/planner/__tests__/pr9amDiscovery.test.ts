import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/affiliate/planner/offerRepository", () => ({
  persistAffiliateOfferToken: vi.fn(),
}));

import { createFakeAffiliateDefinition } from "@/lib/affiliate/planner/__tests__/fixtures";
import { buildAffiliateOffersForSession } from "@/lib/affiliate/planner/buildOffersForSession";
import { resolveAffiliateCanonicalDestination } from "@/lib/affiliate/planner/destinationCanonical";
import { buildActivityDiscovery } from "@/lib/affiliate/planner/discovery/buildActivityDiscovery";
import type { PlannerActivityIntent } from "@/lib/affiliate/planner/discovery/types";
import {
  buildKlookCityWidgetDescriptor,
  KLOOK_TOURS_SIGHTSEEING_CATEGORY_ID,
} from "@/lib/affiliate/planner/providers/klook/klookDiscovery";
import { resolveKlookCityId } from "@/lib/affiliate/planner/providers/klook/klookCityIds";
import {
  discoverTiqetsProducts,
  TIQETS_WIDGET_MAX_PRODUCTS,
} from "@/lib/affiliate/planner/providers/tiqets/tiqetsDiscovery";
import type {
  searchTiqetsSuggest,
  TiqetsSuggestResult,
} from "@/lib/affiliate/planner/providers/tiqets/tiqetsSuggestClient";
import type { AffiliateDestination } from "@/lib/affiliate/planner/types";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

const OSAKA = { countryCode: "JP", cityEnglish: "Osaka" };

function intent(requestIndex: number, rawLabel: string, planItemName: string | null = null): PlannerActivityIntent {
  return {
    requestIndex,
    rawLabel,
    normalizedLabel: rawLabel.toLowerCase(),
    dayNumber: planItemName ? 1 : null,
    itemOrder: planItemName ? requestIndex + 1 : null,
    planItemName,
  };
}

function suggestStub(byTerm: Record<string, TiqetsSuggestResult>) {
  return vi.fn(async ({ term }: { term: string }) => byTerm[term] ?? { candidates: [], outcome: "fetched" as const });
}

function fetched(...candidates: Array<[string, string]>): TiqetsSuggestResult {
  return { candidates: candidates.map(([productId, title]) => ({ productId, title })), outcome: "fetched" };
}

function samplePlan(names: string[] = ["오사카성", "도톤보리"]): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: "JP" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      nights: 1,
      days: 2,
      travelersSummary: "2",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: "2026-10-01",
        title: "1",
        summary: "s",
        items: names.map((name, index) => ({
          order: index + 1,
          time: "10:00",
          type: "attraction",
          name,
          area: null,
          description: "d",
          estimatedDurationMinutes: 60,
          travelToNext: null,
          bookingRecommended: false,
        })),
        tips: [],
      },
    ],
    preparation: { travelTips: ["t"], packingHints: ["p"] },
  };
}

const tiqetsDef = createFakeAffiliateDefinition({ id: "tiqets", categories: ["activity"] });
const klookDef = createFakeAffiliateDefinition({ id: "klook", categories: ["activity"] });
const osakaDestination: AffiliateDestination = { text: "오사카", countryCode: "JP" };

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PR-9AM Tiqets discovery", () => {
  it("verified hit → no suggest call", async () => {
    const searchSuggest = suggestStub({});
    const { descriptor, stats } = await discoverTiqetsProducts({
      intents: [intent(0, "오사카성", "오사카성"), intent(1, "USJ")],
      destination: OSAKA,
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(searchSuggest).not.toHaveBeenCalled();
    expect(descriptor?.products.map((p) => [p.productId, p.matchConfidence, p.dayNumber])).toEqual([
      ["1108257", "exact", 1],
      ["1102887", "exact", null],
    ]);
    expect(stats).toMatchObject({ requestCount: 2, verifiedHitCount: 2, suggestCallCount: 0 });
  });

  it("verified miss + suggest ON → one suggest call with plan item name first", async () => {
    const searchSuggest = suggestStub({
      "Kaiyukan Aquarium": fetched(["555", "Kaiyukan Aquarium: Entry Ticket"]),
    });
    const { descriptor, stats } = await discoverTiqetsProducts({
      intents: [intent(0, "가이유칸", "Kaiyukan Aquarium")],
      destination: OSAKA,
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(searchSuggest).toHaveBeenCalledTimes(1);
    expect(searchSuggest.mock.calls[0]![0]).toMatchObject({
      term: "Kaiyukan Aquarium",
      destinationScope: "JP|Osaka",
    });
    expect(descriptor?.products).toEqual([
      {
        providerId: "tiqets",
        productId: "555",
        title: "Kaiyukan Aquarium: Entry Ticket",
        matchConfidence: "exact",
        dayNumber: 1,
        itemOrder: 1,
      },
    ]);
    expect(stats).toMatchObject({ suggestCallCount: 1, suggestMatchCount: 1, suggestMissCount: 0 });
  });

  it("suggest OFF + verified miss → null descriptor, no call", async () => {
    const searchSuggest = suggestStub({});
    const { descriptor } = await discoverTiqetsProducts({
      intents: [intent(0, "Kaiyukan Aquarium")],
      destination: OSAKA,
      suggestEnabled: false,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(descriptor).toBeNull();
    expect(searchSuggest).not.toHaveBeenCalled();
  });

  it("suggest error/throw → partial result kept, never throws", async () => {
    const searchSuggest = vi.fn(async ({ term }: { term: string }) => {
      if (term === "Boom") throw new Error("boom");
      return { candidates: [], outcome: "error" as const };
    });
    const { descriptor, stats } = await discoverTiqetsProducts({
      intents: [intent(0, "오사카성"), intent(1, "Boom"), intent(2, "Kaiyukan Aquarium")],
      destination: OSAKA,
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(descriptor?.products.map((p) => p.productId)).toEqual(["1108257"]);
    expect(stats).toMatchObject({ suggestCallCount: 2, suggestErrorCount: 2, suggestMatchCount: 0 });
  });

  it("more than 3 matches → capped at 3; duplicate product IDs deduped", async () => {
    const searchSuggest = suggestStub({
      "Kaiyukan Aquarium": fetched(["555", "Kaiyukan Aquarium"]),
      "Umeda Sky Building": fetched(["666", "Umeda Sky Building"]),
    });
    const { descriptor } = await discoverTiqetsProducts({
      intents: [
        intent(0, "USJ"),
        intent(1, "유니버설 스튜디오 재팬"),
        intent(2, "Kaiyukan Aquarium"),
        intent(3, "Umeda Sky Building"),
        intent(4, "Osaka Castle"),
      ],
      destination: OSAKA,
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    const ids = descriptor?.products.map((p) => p.productId) ?? [];
    expect(ids).toHaveLength(TIQETS_WIDGET_MAX_PRODUCTS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["1102887", "555", "666"]);
  });

  it("exact before high, then requestIndex order", async () => {
    const searchSuggest = suggestStub({
      "Tempozan Ferris Wheel": fetched(["701", "Tempozan Ferris Wheel Ride: Entry Ticket"]),
      "Kaiyukan Aquarium": fetched(["555", "Kaiyukan Aquarium"]),
      "Umeda Sky Building": fetched(["666", "Umeda Sky Building Observatory: Ticket"]),
    });
    const { descriptor } = await discoverTiqetsProducts({
      intents: [
        intent(0, "Tempozan Ferris Wheel"),
        intent(1, "Umeda Sky Building"),
        intent(2, "Kaiyukan Aquarium"),
      ],
      destination: OSAKA,
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(descriptor?.products.map((p) => [p.productId, p.matchConfidence])).toEqual([
      ["555", "exact"],
      ["701", "high"],
      ["666", "high"],
    ]);
  });

  it("unknown destination country → no lookups at all", async () => {
    const searchSuggest = suggestStub({});
    const { descriptor } = await discoverTiqetsProducts({
      intents: [intent(0, "USJ")],
      destination: { countryCode: null, cityEnglish: null },
      suggestEnabled: true,
      deps: { searchSuggest: searchSuggest as unknown as typeof searchTiqetsSuggest },
    });
    expect(descriptor).toBeNull();
    expect(searchSuggest).not.toHaveBeenCalled();
  });
});

describe("PR-9AM Klook city discovery", () => {
  const descriptorFor = (destination: AffiliateDestination, enabled = true) =>
    buildKlookCityWidgetDescriptor({ destination: resolveAffiliateCanonicalDestination(destination), enabled });

  it("Osaka + JP → cityId 29", () => {
    expect(resolveKlookCityId(OSAKA)).toBe("29");
    expect(descriptorFor(osakaDestination)).toEqual({
      providerId: "klook",
      kind: "city_widget",
      cityId: "29",
      cityLabel: "오사카",
      categoryId: KLOOK_TOURS_SIGHTSEEING_CATEGORY_ID,
    });
  });

  it("Osaka + wrong or missing country → null", () => {
    expect(resolveKlookCityId({ cityEnglish: "Osaka", countryCode: "KR" })).toBeNull();
    expect(descriptorFor({ text: "오사카", countryCode: "KR" })).toBeNull();
    expect(descriptorFor({ text: "오사카", countryCode: null })).toBeNull();
  });

  it("unknown/unverified city → null (never guessed); provider off → null", () => {
    expect(descriptorFor({ text: "도쿄", countryCode: "JP" })).toBeNull();
    expect(descriptorFor({ text: "사이판", countryCode: "MP" })).toBeNull();
    expect(descriptorFor(osakaDestination, false)).toBeNull();
  });

  it("widget contract: verified category 2, DTO carries ids only (embed params live in the builder)", () => {
    expect(KLOOK_TOURS_SIGHTSEEING_CATEGORY_ID).toBe("2");
    expect(descriptorFor(osakaDestination)?.categoryId).toBe("2");
    const serialized = JSON.stringify(descriptorFor(osakaDestination));
    for (const forbidden of ["http", "trs", "shmarker", "campaign", "script", "KRW"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("PR-9AM activity discovery DTO", () => {
  const sessionId = "550e8400-e29b-41d4-a716-446655440000";

  function draftWith(mustDo: string[]) {
    const draft = createEmptyPlannerDraftInput("오사카");
    draft.mustDo = mustDo;
    return draft;
  }

  it("existing DTO fields unchanged + activityDiscovery additive (both providers)", async () => {
    const result = await buildAffiliateOffersForSession({
      sessionId,
      plan: samplePlan(),
      input: draftWith(["오사카성"]),
      sourceProductId: null,
      deps: {
        providers: [tiqetsDef, klookDef],
        adapters: new Map(),
        persist: vi.fn() as never,
        resolveDestination: async () => osakaDestination,
      },
    });
    expect(Object.keys(result).sort()).toEqual(
      ["activityDiscovery", "days", "disclosure", "preparation", "summary"].sort(),
    );
    expect(result.summary).toEqual([]);
    expect(result.preparation).toEqual([]);
    expect(result.days).toEqual({});
    expect(result.activityDiscovery?.tiqets?.products.map((p) => p.productId)).toEqual(["1108257"]);
    expect(result.activityDiscovery?.klook?.cityId).toBe("29");
    const serialized = JSON.stringify(result.activityDiscovery);
    for (const forbidden of ["http", "suggest", "marker", "Authorization"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("no discovery → activityDiscovery null", async () => {
    const result = await buildAffiliateOffersForSession({
      sessionId,
      plan: samplePlan(),
      input: draftWith(["오사카성"]),
      sourceProductId: null,
      deps: {
        providers: [],
        adapters: new Map(),
        persist: vi.fn() as never,
        resolveDestination: async () => osakaDestination,
      },
    });
    expect(result.activityDiscovery).toBeNull();
  });

  it("discovery failure never fails the offers build", async () => {
    const result = await buildAffiliateOffersForSession({
      sessionId,
      plan: samplePlan(),
      input: draftWith(["오사카성"]),
      sourceProductId: null,
      deps: {
        providers: [tiqetsDef, klookDef],
        adapters: new Map(),
        persist: vi.fn() as never,
        resolveDestination: async () => osakaDestination,
        buildDiscovery: vi.fn(async () => {
          throw new Error("boom");
        }),
      },
    });
    expect(result.activityDiscovery).toBeNull();
    expect(result.summary).toEqual([]);
  });

  it("mustDo=[] → no Tiqets lookup or network call, Klook still resolved", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const discoverTiqets = vi.fn();
    const dto = await buildActivityDiscovery({
      draft: draftWith([]),
      plan: samplePlan(),
      destination: osakaDestination,
      providers: [tiqetsDef, klookDef],
      deps: {
        env: { ENABLE_PLANNER_AFFILIATE_TIQETS_SUGGEST: "true" },
        discoverTiqets: discoverTiqets as never,
      },
    });
    expect(discoverTiqets).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dto).toEqual({ tiqets: null, klook: expect.objectContaining({ cityId: "29" }) });
  });

  it("Klook city only (Tiqets provider off) → tiqets null + klook descriptor", async () => {
    const dto = await buildActivityDiscovery({
      draft: draftWith(["오사카성"]),
      plan: samplePlan(),
      destination: osakaDestination,
      providers: [klookDef, { ...tiqetsDef, enabled: false }],
    });
    expect(dto?.tiqets).toBeNull();
    expect(dto?.klook).toMatchObject({ providerId: "klook", cityId: "29" });
  });

  it("Tiqets only (Klook off) → klook null + tiqets descriptor", async () => {
    const dto = await buildActivityDiscovery({
      draft: draftWith(["USJ"]),
      plan: samplePlan(["유니버설 스튜디오 재팬"]),
      destination: osakaDestination,
      providers: [tiqetsDef],
    });
    expect(dto?.klook).toBeNull();
    expect(dto?.tiqets?.products).toEqual([
      expect.objectContaining({ productId: "1102887", matchConfidence: "exact" }),
    ]);
  });

  it("suggest path wired: env ON passes through, logs counts only", async () => {
    const info = vi.mocked(console.info);
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ title: "Kaiyukan Aquarium", value: 555 }]), { status: 200 }),
    );
    const dto = await buildActivityDiscovery({
      draft: draftWith(["Kaiyukan Aquarium"]),
      plan: samplePlan(),
      destination: osakaDestination,
      providers: [tiqetsDef],
      deps: {
        env: { ENABLE_PLANNER_AFFILIATE_TIQETS_SUGGEST: "true" },
        tiqets: { suggestDeps: { fetchImpl: fetchImpl as unknown as typeof fetch } },
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(dto?.tiqets?.products.map((p) => p.productId)).toEqual(["555"]);
    const logCall = info.mock.calls.find(([tag]) => tag === "[planner/affiliate/activity_discovery]");
    expect(logCall?.[1]).toEqual({
      requestCount: 1,
      verifiedHitCount: 0,
      suggestCallCount: 1,
      suggestMatchCount: 1,
      suggestMissCount: 0,
      suggestErrorCount: 0,
      tiqetsProductCount: 1,
      klookCityResolved: false,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("Kaiyukan");
  });

  it("suggest env OFF (default) → verified miss yields no fetch and null", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const dto = await buildActivityDiscovery({
      draft: draftWith(["Kaiyukan Aquarium"]),
      plan: samplePlan(),
      destination: osakaDestination,
      providers: [tiqetsDef],
      deps: { env: {} },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dto).toBeNull();
  });
});
