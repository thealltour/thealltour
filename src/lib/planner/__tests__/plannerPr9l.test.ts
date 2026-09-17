import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDaysToIsoDate, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerPlaceEnrichmentItem } from "@/lib/planner/enrichmentTypes";
import {
  PLACE_ATTRIBUTE_CACHE_TTL_MS,
  PLACE_UNRESOLVED_CACHE_TTL_MS,
  placeCacheTtlMsForStatus,
} from "@/lib/planner/placeEnrichmentRepository";
import {
  buildPlacesSearchQuery,
  isConcretePlannerPlaceCandidate,
} from "@/lib/planner/placesQuery";
import { PlacesProviderError } from "@/lib/planner/placesClient";
import { PLANNER_PLAN_SYSTEM_PROMPT } from "@/lib/planner/prompts";
import {
  buildConsecutiveRoutePairs,
} from "@/lib/planner/routePairs";

const listPlaceEnrichmentsForFingerprint = vi.hoisted(() => vi.fn());
const replacePlaceEnrichmentsForFingerprint = vi.hoisted(() => vi.fn());
const searchPlacesText = vi.hoisted(() => vi.fn());
const isPlacesProviderConfigured = vi.hoisted(() => vi.fn());
const fetchPlannerWeatherSummary = vi.hoisted(() => vi.fn());
const resolvePlannerRoutes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

vi.mock("@/lib/planner/placeEnrichmentRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/planner/placeEnrichmentRepository")>();
  return {
    ...actual,
    listPlaceEnrichmentsForFingerprint,
    replacePlaceEnrichmentsForFingerprint,
  };
});

vi.mock("@/lib/planner/placesClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/planner/placesClient")>();
  return {
    ...actual,
    searchPlacesText,
    isPlacesProviderConfigured,
  };
});

vi.mock("@/lib/planner/plannerWeather", () => ({
  fetchPlannerWeatherSummary,
}));

vi.mock("@/lib/planner/resolvePlannerRoutes", () => ({
  resolvePlannerRoutes,
}));

import { enrichPlannerSession } from "@/lib/planner/enrichPlannerSession";

function samplePlan(overrides?: Partial<PlannerPlan>): PlannerPlan {
  const base: PlannerPlan = {
    title: "오사카 2박 3일",
    summary: "요약",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      nights: 2,
      days: 3,
      travelersSummary: "성인 2명",
      styleSummary: "균형",
    },
    days: [
      {
        day: 1,
        date: addDaysToIsoDate("2026-10-01", 0),
        title: "1일차",
        summary: "하루",
        items: [
          {
            order: 1,
            time: "10:00",
            type: "attraction",
            name: "오사카성",
            area: "주오구",
            description: "성",
            estimatedDurationMinutes: 90,
            travelToNext: { mode: "walk", estimatedMinutes: 15 },
            bookingRecommended: false,
          },
          {
            order: 2,
            time: "12:00",
            type: "attraction",
            name: "도톤보리",
            area: "난바",
            description: "거리",
            estimatedDurationMinutes: 60,
            travelToNext: null,
            bookingRecommended: false,
          },
          {
            order: 3,
            time: "14:00",
            type: "transport",
            name: "이동",
            area: null,
            description: "이동",
            estimatedDurationMinutes: 20,
            travelToNext: null,
            bookingRecommended: false,
          },
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["팁"], packingHints: ["신발"] },
  };
  return { ...base, ...overrides };
}

function resolvedPlaceItem(
  dayNumber: number,
  itemOrder: number,
  name: string,
  lat: number,
  lng: number,
): PlannerPlaceEnrichmentItem {
  return {
    dayNumber,
    itemOrder,
    place: {
      status: "resolved",
      originalName: name,
      placeId: `places/${itemOrder}`,
      displayName: name,
      formattedAddress: `${name} addr`,
      location: { lat, lng },
      types: ["tourist_attraction"],
      googleMapsUri: "https://maps.google.com/?cid=1",
    },
  };
}

function unresolvedPlaceItem(
  dayNumber: number,
  itemOrder: number,
  name: string,
): PlannerPlaceEnrichmentItem {
  return {
    dayNumber,
    itemOrder,
    place: {
      status: "unresolved",
      originalName: name,
      placeId: null,
      displayName: null,
      formattedAddress: null,
      location: null,
      types: [],
      googleMapsUri: null,
    },
  };
}

describe("PR-9L places enrichment reliability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPlaceEnrichmentsForFingerprint.mockResolvedValue({ items: [], fresh: false });
    replacePlaceEnrichmentsForFingerprint.mockResolvedValue(undefined);
    isPlacesProviderConfigured.mockReturnValue(true);
    searchPlacesText.mockResolvedValue([]);
    fetchPlannerWeatherSummary.mockResolvedValue({ availability: "unavailable", days: [] });
    resolvePlannerRoutes.mockResolvedValue({
      routes: [],
      requestCount: 0,
      partialFailure: false,
    });
  });

  it("missing key → no Google fetch, provider failure, partialFailure, single unavailable log", async () => {
    isPlacesProviderConfigured.mockReturnValue(false);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const plan = samplePlan();
    const result = await enrichPlannerSession({ sessionId: "sess-1", plan });

    expect(searchPlacesText).not.toHaveBeenCalled();
    expect(result.partialFailure).toBe(true);
    expect(result.places.every((p) => p.place.status === "unresolved")).toBe(true);
    expect(replacePlaceEnrichmentsForFingerprint).not.toHaveBeenCalled();

    const unavailableLogs = infoSpy.mock.calls.filter(
      (c) => c[0] === "[planner] places unavailable",
    );
    expect(unavailableLogs).toHaveLength(1);
    expect(unavailableLogs[0]![1]).toMatchObject({
      sessionId: "sess-1",
      category: "missing_key",
    });

    infoSpy.mockRestore();
  });

  it("HTTP 403 → PlacesProviderError category http + httpStatus 403", () => {
    const err = new PlacesProviderError("http", "Places HTTP 403", { httpStatus: 403 });
    expect(err.category).toBe("http");
    expect(err.httpStatus).toBe(403);
    expect(err.message).toBe("Places HTTP 403");
    expect(err.message).not.toMatch(/api[_-]?key/i);
  });

  it("network failure → provider_failure (no persist)", async () => {
    searchPlacesText.mockRejectedValue(new PlacesProviderError("network", "Places network error"));
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await enrichPlannerSession({ sessionId: "sess-net", plan: samplePlan() });

    expect(result.partialFailure).toBe(true);
    expect(result.places.every((p) => p.place.status === "unresolved")).toBe(true);
    expect(replacePlaceEnrichmentsForFingerprint).not.toHaveBeenCalled();

    const failLogs = infoSpy.mock.calls.filter((c) => c[0] === "[planner] places resolve failed");
    expect(failLogs.length).toBeGreaterThan(0);
    expect(failLogs.every((c) => (c[1] as { category?: string }).category === "network")).toBe(
      true,
    );

    infoSpy.mockRestore();
  });

  it("provider failure → replacePlaceEnrichmentsForFingerprint not called", async () => {
    searchPlacesText.mockRejectedValue(
      new PlacesProviderError("http", "Places HTTP 500", { httpStatus: 500 }),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});

    await enrichPlannerSession({ sessionId: "sess-fail", plan: samplePlan() });

    expect(replacePlaceEnrichmentsForFingerprint).not.toHaveBeenCalled();
  });

  it("provider failure mixed with classified → persist only classified items", async () => {
    searchPlacesText
      .mockResolvedValueOnce([
        {
          placeId: "places/osaka-castle",
          displayName: "오사카성",
          formattedAddress: "일본 오사카 주오구",
          lat: 34.687,
          lng: 135.526,
          types: ["tourist_attraction"],
          googleMapsUri: null,
        },
      ])
      .mockRejectedValueOnce(new PlacesProviderError("network", "Places network error"));
    vi.spyOn(console, "info").mockImplementation(() => {});

    await enrichPlannerSession({ sessionId: "sess-mixed", plan: samplePlan() });

    expect(replacePlaceEnrichmentsForFingerprint).toHaveBeenCalledTimes(1);
    const persisted = replacePlaceEnrichmentsForFingerprint.mock.calls[0]![0] as {
      items: Array<{ place: { status: string; originalName: string } }>;
    };
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0]!.place.originalName).toBe("오사카성");
    expect(persisted.items[0]!.place.status).toBe("resolved");
  });

  it("Google success + places:[] → actual unresolved → cache persist allowed", async () => {
    searchPlacesText.mockResolvedValue([]);
    vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await enrichPlannerSession({ sessionId: "sess-empty", plan: samplePlan() });

    expect(result.partialFailure).toBe(false);
    expect(result.places.every((p) => p.place.status === "unresolved")).toBe(true);
    expect(replacePlaceEnrichmentsForFingerprint).toHaveBeenCalledTimes(1);
    const persisted = replacePlaceEnrichmentsForFingerprint.mock.calls[0]![0] as {
      items: Array<{ place: { status: string } }>;
    };
    expect(persisted.items.length).toBeGreaterThan(0);
    expect(persisted.items.every((i) => i.place.status === "unresolved")).toBe(true);
  });

  it("query country includes name, area, destination, country", () => {
    expect(
      buildPlacesSearchQuery({
        name: "우메다 스카이빌딩 공중정원 야경",
        area: "우메다",
        destination: "오사카",
        country: "일본",
      }),
    ).toBe("우메다 스카이빌딩 공중정원 야경 우메다 오사카 일본");
  });

  it("generic filter: concrete POI vs soft phrases", () => {
    expect(
      isConcretePlannerPlaceCandidate({
        type: "food",
        name: "난바 근처 이자카야 저녁 식사",
      }),
    ).toBe(false);
    expect(
      isConcretePlannerPlaceCandidate({
        type: "cafe",
        name: "우메다 분위기 좋은 카페에서 휴식",
      }),
    ).toBe(false);
    expect(
      isConcretePlannerPlaceCandidate({
        type: "attraction",
        name: "오사카성 및 니시노마루 정원",
      }),
    ).toBe(true);
    expect(
      isConcretePlannerPlaceCandidate({
        type: "attraction",
        name: "우메다 스카이빌딩 공중정원 야경",
      }),
    ).toBe(true);
    expect(
      isConcretePlannerPlaceCandidate({
        type: "attraction",
        name: "쓰텐카쿠",
      }),
    ).toBe(true);
    expect(isConcretePlannerPlaceCandidate({ type: "other", name: "휴식" })).toBe(false);
    expect(isConcretePlannerPlaceCandidate({ type: "transport", name: "지하철 이동" })).toBe(
      false,
    );
  });

  it("unresolved TTL shorter than resolved", () => {
    expect(placeCacheTtlMsForStatus("unresolved")).toBe(PLACE_UNRESOLVED_CACHE_TTL_MS);
    expect(placeCacheTtlMsForStatus("resolved")).toBe(PLACE_ATTRIBUTE_CACHE_TTL_MS);
    expect(placeCacheTtlMsForStatus("ambiguous")).toBe(PLACE_ATTRIBUTE_CACHE_TTL_MS);
    expect(PLACE_UNRESOLVED_CACHE_TTL_MS).toBeLessThan(PLACE_ATTRIBUTE_CACHE_TTL_MS);
    expect(PLACE_UNRESOLVED_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(PLACE_ATTRIBUTE_CACHE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("fresh resolved cache → searchPlacesText not called", async () => {
    listPlaceEnrichmentsForFingerprint.mockResolvedValue({
      fresh: true,
      items: [
        resolvedPlaceItem(1, 1, "오사카성", 34.687, 135.526),
        resolvedPlaceItem(1, 2, "도톤보리", 34.668, 135.501),
      ],
    });
    vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await enrichPlannerSession({ sessionId: "sess-cache", plan: samplePlan() });

    expect(searchPlacesText).not.toHaveBeenCalled();
    expect(replacePlaceEnrichmentsForFingerprint).not.toHaveBeenCalled();
    expect(result.places).toHaveLength(2);
    expect(result.partialFailure).toBe(false);
  });

  it("expired unresolved (fresh:false) → Places API retried", async () => {
    listPlaceEnrichmentsForFingerprint.mockResolvedValue({
      fresh: false,
      items: [
        unresolvedPlaceItem(1, 1, "오사카성"),
        unresolvedPlaceItem(1, 2, "도톤보리"),
      ],
    });
    searchPlacesText.mockResolvedValue([
      {
        placeId: "places/osaka-castle",
        displayName: "오사카성",
        formattedAddress: "일본 오사카 주오구",
        lat: 34.687,
        lng: 135.526,
        types: ["tourist_attraction"],
        googleMapsUri: null,
      },
    ]);
    vi.spyOn(console, "info").mockImplementation(() => {});

    await enrichPlannerSession({ sessionId: "sess-retry", plan: samplePlan() });

    expect(searchPlacesText).toHaveBeenCalled();
    expect(searchPlacesText.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("buildConsecutiveRoutePairs: 2+ resolved coords → pairs; 0 resolved → no pairs", () => {
    const plan = samplePlan();
    const withCoords = [
      resolvedPlaceItem(1, 1, "오사카성", 34.687, 135.526),
      resolvedPlaceItem(1, 2, "도톤보리", 34.668, 135.501),
    ];
    const pairs = buildConsecutiveRoutePairs({ plan, places: withCoords });
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0]).toMatchObject({ fromOrder: 1, toOrder: 2, mode: "walk" });

    const none = [
      unresolvedPlaceItem(1, 1, "오사카성"),
      unresolvedPlaceItem(1, 2, "도톤보리"),
    ];
    expect(buildConsecutiveRoutePairs({ plan, places: none })).toHaveLength(0);
  });

  it("prompts contain concrete POI guidance and anti-hallucination", () => {
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("단일 장소명");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toMatch(/또는\/및\/&/);
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toContain("임의의 식당/가게 이름을 지어내지 마세요");
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toMatch(/21\./);
    expect(PLANNER_PLAN_SYSTEM_PROMPT).toMatch(/22\./);
  });
});
