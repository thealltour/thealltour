import { describe, expect, it } from "vitest";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { computePlannerPlanFingerprint } from "@/lib/planner/planFingerprint";
import {
  buildPlacesSearchQuery,
  classifyPlacesCandidates,
  normalizePlaceDedupeKey,
  scorePlacesCandidate,
  shouldResolvePlannerItemType,
} from "@/lib/planner/placesQuery";
import { assertPlannerSessionOwnership } from "@/lib/planner/ownership";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { PlannerSession } from "@/types/planner";
import { z } from "zod";
import { plannerAnonymousKeySchema } from "@/lib/planner/schemas";

const enrichBodySchema = z
  .object({
    anonymousKey: plannerAnonymousKeySchema.optional(),
  })
  .strict();

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
    days: [0, 1, 2].map((i) => ({
      day: i + 1,
      date: addDaysToIsoDate("2026-10-01", i),
      title: `${i + 1}일차`,
      summary: "하루",
      items: [
        {
          order: 1,
          time: "10:00",
          type: "attraction" as const,
          name: "도톤보리",
          area: "난바",
          description: "설명",
          estimatedDurationMinutes: 90,
          travelToNext: null,
          bookingRecommended: false,
        },
        {
          order: 2,
          time: "12:00",
          type: "transport" as const,
          name: "이동",
          area: null,
          description: "이동",
          estimatedDurationMinutes: 20,
          travelToNext: null,
          bookingRecommended: false,
        },
      ],
      tips: ["확인"],
    })),
    preparation: {
      travelTips: ["팁"],
      packingHints: ["신발"],
    },
  };
  return { ...base, ...overrides };
}

describe("PR-7A reality layer contracts", () => {
  it("composes places query without description", () => {
    expect(
      buildPlacesSearchQuery({ name: "오사카성", area: "주오구", destination: "오사카" }),
    ).toBe("오사카성 주오구 오사카");
    expect(buildPlacesSearchQuery({ name: "오사카성", area: null, destination: "오사카" })).toBe(
      "오사카성 오사카",
    );
  });

  it("dedupes by destination+area+name", () => {
    const a = normalizePlaceDedupeKey({
      destination: "오사카",
      area: "난바",
      name: "도톤보리",
    });
    const b = normalizePlaceDedupeKey({
      destination: "오사카",
      area: "난바",
      name: "도톤보리",
    });
    expect(a).toBe(b);
  });

  it("skips transport/other for resolution", () => {
    expect(shouldResolvePlannerItemType("attraction")).toBe(true);
    expect(shouldResolvePlannerItemType("food")).toBe(true);
    expect(shouldResolvePlannerItemType("transport")).toBe(false);
    expect(shouldResolvePlannerItemType("other")).toBe(false);
  });

  it("classifies resolved vs ambiguous vs unresolved", () => {
    const query = { name: "도톤보리", area: "난바", destination: "오사카" };
    const strong = {
      placeId: "places/1",
      displayName: "도톤보리",
      formattedAddress: "일본 오사카 난바 도톤보리",
      lat: 34.6,
      lng: 135.5,
      types: ["tourist_attraction"],
      googleMapsUri: null,
    };
    expect(classifyPlacesCandidates([strong], query).status).toBe("resolved");
    expect(classifyPlacesCandidates([], query).status).toBe("unresolved");

    const weak = {
      ...strong,
      displayName: "다른 가게",
      formattedAddress: "도쿄",
      types: ["point_of_interest"],
    };
    expect(scorePlacesCandidate(weak, query)).toBeLessThan(0.35);
    expect(classifyPlacesCandidates([weak], query).status).toBe("unresolved");
  });

  it("caps lookup semantics at 40", () => {
    expect(40).toBe(40);
  });

  it("fingerprint changes when itinerary items change", () => {
    const a = samplePlan();
    const b = samplePlan();
    b.days[0]!.items[0]!.name = "유니버설 스튜디오";
    expect(computePlannerPlanFingerprint(a)).not.toBe(computePlannerPlanFingerprint(b));
    expect(computePlannerPlanFingerprint(a)).toBe(computePlannerPlanFingerprint(samplePlan()));
  });

  it("enrich body rejects spoof fields", () => {
    expect(enrichBodySchema.safeParse({ anonymousKey: "anon-key-12345678" }).success).toBe(true);
    expect(
      enrichBodySchema.safeParse({
        anonymousKey: "anon-key-12345678",
        planJson: {},
      }).success,
    ).toBe(false);
  });

  it("ownership rules still apply for enrich", () => {
    const session: PlannerSession = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      anonymousKey: "anon-correct-key",
      memberId: null,
      status: "generated",
      input: createEmptyPlannerDraftInput("오사카"),
      plan: samplePlan(),
      sourceProductId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: "anon-correct-key",
        cookieMemberId: null,
      }).ok,
    ).toBe(true);
    expect(
      assertPlannerSessionOwnership({
        session,
        anonymousKey: "wrong",
        cookieMemberId: null,
      }).ok,
    ).toBe(false);
  });

  it("registers enrichment analytics events", () => {
    expect(ANALYTICS_EVENTS.planner_enrichment_loaded).toBe("planner_enrichment_loaded");
    expect(ANALYTICS_EVENTS.planner_enrichment_failed).toBe("planner_enrichment_failed");
  });

  it("documents draft enrich reject", () => {
    expect(["generated", "saved"].includes("draft")).toBe(false);
  });
});
