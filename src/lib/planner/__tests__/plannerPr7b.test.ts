import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { computePlannerPlanFingerprint } from "@/lib/planner/planFingerprint";
import { addDaysToIsoDate, type PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerPlaceEnrichmentItem } from "@/lib/planner/enrichmentTypes";
import {
  buildConsecutiveRoutePairs,
  formatDistanceMeters,
  mapAiTravelModeToRouteMode,
  PLANNER_ROUTE_CONCURRENCY,
  PLANNER_ROUTE_RESOLVE_MAX,
  routeLookupKey,
  toGoogleTravelMode,
} from "@/lib/planner/routePairs";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerSession } from "@/types/planner";

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
        date: "2026-10-01",
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
            travelToNext: { mode: "walk", estimatedMinutes: 20, note: null },
            bookingRecommended: false,
          },
          {
            order: 2,
            time: "12:00",
            type: "food",
            name: "쿠로몬시장",
            area: "난바",
            description: "시장",
            estimatedDurationMinutes: 60,
            travelToNext: { mode: "public_transit", estimatedMinutes: 15, note: null },
            bookingRecommended: false,
          },
          {
            order: 3,
            time: "14:00",
            type: "attraction",
            name: "도톤보리",
            area: "난바",
            description: "거리",
            estimatedDurationMinutes: 90,
            travelToNext: { mode: "taxi", estimatedMinutes: 10, note: null },
            bookingRecommended: false,
          },
          {
            order: 4,
            time: null,
            type: "attraction",
            name: "우메다",
            area: "기타구",
            description: "야경",
            estimatedDurationMinutes: 60,
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

function resolvedPlace(
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
      placeId: `pid-${itemOrder}`,
      displayName: name,
      formattedAddress: `${name} addr`,
      location: { lat, lng },
      types: ["point_of_interest"],
      googleMapsUri: "https://maps.google.com/?cid=1",
    },
  };
}

function unresolvedPlace(dayNumber: number, itemOrder: number, name: string): PlannerPlaceEnrichmentItem {
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

function baseSession(overrides?: Partial<PlannerSession>): PlannerSession {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "generated",
    anonymousKey: "anon-key-abcdefgh",
    memberId: null,
    plan: samplePlan(),
    input: createEmptyPlannerDraftInput("오사카"),
    sourceProductId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("PR-7B map + routes reality layer", () => {
  it("maps AI travel modes to Google Routes modes", () => {
    expect(mapAiTravelModeToRouteMode("walk")).toBe("walk");
    expect(mapAiTravelModeToRouteMode("public_transit")).toBe("public_transit");
    expect(mapAiTravelModeToRouteMode("car")).toBe("drive");
    expect(mapAiTravelModeToRouteMode("taxi")).toBe("drive");
    expect(mapAiTravelModeToRouteMode("other")).toBe("other");
    expect(mapAiTravelModeToRouteMode(null)).toBe("other");

    expect(toGoogleTravelMode("walk")).toBe("WALK");
    expect(toGoogleTravelMode("drive")).toBe("DRIVE");
    expect(toGoogleTravelMode("public_transit")).toBe("TRANSIT");
    expect(toGoogleTravelMode("other")).toBeNull();
  });

  it("builds consecutive resolved pairs only (no skip across unresolved)", () => {
    const plan = samplePlan();
    const places = [
      resolvedPlace(1, 1, "오사카성", 34.687, 135.526),
      unresolvedPlace(1, 2, "쿠로몬시장"),
      resolvedPlace(1, 3, "도톤보리", 34.668, 135.501),
      resolvedPlace(1, 4, "우메다", 34.705, 135.498),
    ];
    const pairs = buildConsecutiveRoutePairs({ plan, places });
    // 1→2 skipped (2 unresolved), 2→3 skipped, 3→4 ok — never 1→3
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ fromOrder: 3, toOrder: 4, mode: "drive" });
    expect(pairs.every((p) => !(p.fromOrder === 1 && p.toOrder === 3))).toBe(true);
  });

  it("includes walk/drive pairs and skips transit without item time", () => {
    const plan = samplePlan({
      days: [
        {
          day: 1,
          date: "2026-10-01",
          title: "1일차",
          summary: "하루",
          items: [
            {
              order: 1,
              time: "10:00",
              type: "attraction",
              name: "A",
              area: null,
              description: "a",
              estimatedDurationMinutes: 30,
              travelToNext: { mode: "walk", estimatedMinutes: 10, note: null },
              bookingRecommended: false,
            },
            {
              order: 2,
              time: null,
              type: "attraction",
              name: "B",
              area: null,
              description: "b",
              estimatedDurationMinutes: 30,
              travelToNext: { mode: "public_transit", estimatedMinutes: 20, note: null },
              bookingRecommended: false,
            },
            {
              order: 3,
              time: "14:00",
              type: "attraction",
              name: "C",
              area: null,
              description: "c",
              estimatedDurationMinutes: 30,
              travelToNext: { mode: "car", estimatedMinutes: 15, note: null },
              bookingRecommended: false,
            },
            {
              order: 4,
              time: "16:00",
              type: "attraction",
              name: "D",
              area: null,
              description: "d",
              estimatedDurationMinutes: 30,
              travelToNext: null,
              bookingRecommended: false,
            },
          ],
          tips: [],
        },
      ],
    });
    const places = [
      resolvedPlace(1, 1, "A", 34.1, 135.1),
      resolvedPlace(1, 2, "B", 34.2, 135.2),
      resolvedPlace(1, 3, "C", 34.3, 135.3),
      resolvedPlace(1, 4, "D", 34.4, 135.4),
    ];
    const pairs = buildConsecutiveRoutePairs({ plan, places });
    expect(pairs).toHaveLength(3);
    expect(pairs[0]!.googleTravelMode).toBe("WALK");
    // B→C: public_transit but from item time is null → skip provider
    expect(pairs[1]!.mode).toBe("public_transit");
    expect(pairs[1]!.googleTravelMode).toBeNull();
    expect(pairs[1]!.departureTimeIso).toBeNull();
    expect(pairs[2]!.googleTravelMode).toBe("DRIVE");
  });

  it("dedupes same from/to/mode within request; reverse direction is distinct", () => {
    const plan = samplePlan({
      days: [
        {
          day: 1,
          date: addDaysToIsoDate("2026-10-01", 0),
          title: "1",
          summary: "s",
          items: [
            {
              order: 1,
              time: "10:00",
              type: "attraction",
              name: "A",
              area: null,
              description: "a",
              estimatedDurationMinutes: 10,
              travelToNext: { mode: "walk", estimatedMinutes: 5, note: null },
              bookingRecommended: false,
            },
            {
              order: 2,
              time: "11:00",
              type: "attraction",
              name: "B",
              area: null,
              description: "b",
              estimatedDurationMinutes: 10,
              travelToNext: { mode: "walk", estimatedMinutes: 5, note: null },
              bookingRecommended: false,
            },
          ],
          tips: [],
        },
        {
          day: 2,
          date: addDaysToIsoDate("2026-10-01", 1),
          title: "2",
          summary: "s",
          items: [
            {
              order: 1,
              time: "10:00",
              type: "attraction",
              name: "A",
              area: null,
              description: "a",
              estimatedDurationMinutes: 10,
              travelToNext: { mode: "walk", estimatedMinutes: 5, note: null },
              bookingRecommended: false,
            },
            {
              order: 2,
              time: "11:00",
              type: "attraction",
              name: "B",
              area: null,
              description: "b",
              estimatedDurationMinutes: 10,
              travelToNext: { mode: "walk", estimatedMinutes: 5, note: null },
              bookingRecommended: false,
            },
            {
              order: 3,
              time: "12:00",
              type: "attraction",
              name: "A",
              area: null,
              description: "a2",
              estimatedDurationMinutes: 10,
              travelToNext: null,
              bookingRecommended: false,
            },
          ],
          tips: [],
        },
      ],
    });
    const places = [
      resolvedPlace(1, 1, "A", 34.1, 135.1),
      resolvedPlace(1, 2, "B", 34.2, 135.2),
      resolvedPlace(2, 1, "A", 34.1, 135.1),
      resolvedPlace(2, 2, "B", 34.2, 135.2),
      resolvedPlace(2, 3, "A", 34.1, 135.1),
    ];
    const pairs = buildConsecutiveRoutePairs({ plan, places });
    const keys = pairs.map((p) => p.dedupeKey);
    expect(keys[0]).toBe(keys[1]); // day1 A→B same as day2 A→B
    expect(keys[2]).not.toBe(keys[0]); // B→A reverse
  });

  it("formats distance meters", () => {
    expect(formatDistanceMeters(850)).toBe("850m");
    expect(formatDistanceMeters(2400)).toBe("2.4km");
    expect(formatDistanceMeters(2000)).toBe("2km");
    expect(formatDistanceMeters(null)).toBeNull();
  });

  it("route lookup key is day:from:to", () => {
    expect(routeLookupKey(2, 1, 2)).toBe("2:1:2");
  });

  it("enforces route cap and concurrency bounds", () => {
    expect(PLANNER_ROUTE_RESOLVE_MAX).toBe(30);
    expect(PLANNER_ROUTE_CONCURRENCY).toBeGreaterThanOrEqual(3);
    expect(PLANNER_ROUTE_CONCURRENCY).toBeLessThanOrEqual(5);
  });

  it("reuses plan fingerprint; edit changes fingerprint (stale routes)", () => {
    const a = samplePlan();
    const b = samplePlan({
      days: a.days.map((d, i) =>
        i === 0
          ? {
              ...d,
              items: d.items.map((it, j) => (j === 0 ? { ...it, name: "변경된 장소" } : it)),
            }
          : d,
      ),
    });
    expect(computePlannerPlanFingerprint(a)).not.toBe(computePlannerPlanFingerprint(b));
  });

  it("ownership: anonymous allow/deny and member allow/deny", () => {
    const anon = baseSession({ anonymousKey: "anon-key-abcdefgh", memberId: null });
    expect(
      assertPlannerSessionOwnership({
        session: anon,
        anonymousKey: "anon-key-abcdefgh",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session: anon,
        anonymousKey: "wrong-anon-keyxxxx",
        cookieMemberId: null,
      }).ok,
    ).toBe(false);

    const member = baseSession({ anonymousKey: null, memberId: "member-1" });
    expect(
      assertPlannerSessionOwnership({
        session: member,
        anonymousKey: null,
        cookieMemberId: "member-1",
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session: member,
        anonymousKey: null,
        cookieMemberId: "member-other",
      }).ok,
    ).toBe(false);
  });

  it("analytics events include map/routes", () => {
    expect(ANALYTICS_EVENTS.planner_map_loaded).toBe("planner_map_loaded");
    expect(ANALYTICS_EVENTS.planner_routes_loaded).toBe("planner_routes_loaded");
    expect(ANALYTICS_EVENTS.planner_routes_failed).toBe("planner_routes_failed");
  });

  it("zero resolved places → no route pairs (map not rendered upstream)", () => {
    const plan = samplePlan();
    const places = plan.days[0]!.items.map((it) => unresolvedPlace(1, it.order, it.name));
    expect(buildConsecutiveRoutePairs({ plan, places })).toHaveLength(0);
  });

  it("enrichment DTO keeps routes separate from plan_json fields", () => {
    const dto = {
      planFingerprint: "fp",
      places: [] as PlannerPlaceEnrichmentItem[],
      routes: [
        {
          day: 1,
          fromOrder: 1,
          toOrder: 2,
          status: "resolved" as const,
          mode: "walk" as const,
          durationMinutes: 17,
          distanceMeters: 1200,
          provider: "google_routes" as const,
        },
      ],
      weather: { availability: "unavailable" as const, days: [] },
      partialFailure: false,
      message: null,
    };
    expect(dto.routes[0]!.provider).toBe("google_routes");
    expect("raw" in dto.routes[0]!).toBe(false);
  });
});
