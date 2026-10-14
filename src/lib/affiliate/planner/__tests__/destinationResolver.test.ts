import { describe, expect, it } from "vitest";
import { resolveAffiliateCountryCode } from "@/lib/affiliate/planner/countryIdentity";
import {
  extractIsoCountryCode,
  resolveAffiliateDestination,
} from "@/lib/affiliate/planner/destinationResolver";
import { isAiraloEligible } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import type { AffiliateRoutingContext } from "@/lib/affiliate/planner/types";

function samplePlan(country?: string | null): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: country === undefined ? "일본" : country },
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
        ],
        tips: [],
      },
    ],
    preparation: { travelTips: ["t"], packingHints: ["p"] },
  };
}

describe("resolveAffiliateCountryCode", () => {
  it.each([
    ["일본", "JP"],
    ["Japan", "JP"],
    ["JP", "JP"],
    ["jp", "JP"],
    ["대한민국", "KR"],
    ["한국", "KR"],
    ["South Korea", "KR"],
    ["Republic of Korea", "KR"],
    ["베트남", "VN"],
    ["Vietnam", "VN"],
    ["Viet Nam", "VN"],
    ["태국", "TH"],
    ["대만", "TW"],
  ])("%s → %s", (raw, expected) => {
    expect(resolveAffiliateCountryCode(raw)).toBe(expected);
  });

  it.each([["오사카"], ["Osaka"], ["JPN"], ["아틀란티스"], [""], [null], [undefined]])(
    "unknown %s → null",
    (raw) => {
      expect(resolveAffiliateCountryCode(raw)).toBeNull();
    },
  );
});

describe("resolveAffiliateDestination", () => {
  it("propagates ISO alpha-2 countryCode when present on plan", async () => {
    const dest = await resolveAffiliateDestination({
      destinationText: "Osaka",
      plan: samplePlan("JP"),
      input: createEmptyPlannerDraftInput("Osaka"),
    });
    expect(dest.countryCode).toBe("JP");
    expect(dest.text).toBe("Osaka");
  });

  it("derives ISO countryCode from Korean display country without mutating the plan", async () => {
    const plan = samplePlan("일본");
    const dest = await resolveAffiliateDestination({
      destinationText: "오사카",
      plan,
      input: createEmptyPlannerDraftInput("오사카"),
    });
    expect(dest.countryCode).toBe("JP");
    expect(dest.text).toBe("오사카");
    expect(plan.destination.country).toBe("일본");
  });

  it("falls back to destination text only when it is a country name", async () => {
    const vietnam = await resolveAffiliateDestination({
      destinationText: "베트남",
      plan: samplePlan(null),
      input: createEmptyPlannerDraftInput("베트남"),
    });
    expect(vietnam.countryCode).toBe("VN");

    const city = await resolveAffiliateDestination({
      destinationText: "오사카",
      plan: samplePlan(null),
      input: createEmptyPlannerDraftInput("오사카"),
    });
    expect(city.countryCode).toBeNull();
  });

  it("extractIsoCountryCode normalizes known names and rejects unknown strings", () => {
    expect(extractIsoCountryCode({ planCountry: "jp" })).toBe("JP");
    expect(extractIsoCountryCode({ planCountry: "일본" })).toBe("JP");
    expect(extractIsoCountryCode({ planCountry: "South Korea" })).toBe("KR");
    expect(extractIsoCountryCode({ planCountry: "JPN" })).toBeNull();
    expect(extractIsoCountryCode({ planCountry: null })).toBeNull();
    expect(extractIsoCountryCode({ planCountry: null, destinationText: "LA" })).toBeNull();
  });

  it("Korean plan country makes Airalo eSIM eligible via derived ISO code", async () => {
    const dest = await resolveAffiliateDestination({
      destinationText: "오사카",
      plan: samplePlan("일본"),
      input: createEmptyPlannerDraftInput("오사카"),
    });
    const context: AffiliateRoutingContext = {
      plannerSessionId: "550e8400-e29b-41d4-a716-446655440000",
      destination: dest,
      dates: { mode: "fixed", startDate: "2026-10-01", endDate: "2026-10-03", durationDays: 3 },
      travelers: { adults: 1, children: 0 },
      companionType: "solo",
      interests: [],
      pace: "balanced",
      placement: "preparation",
      category: "esim",
      sourceProductId: null,
    };
    expect(isAiraloEligible(context)).toBe(true);
    expect(
      isAiraloEligible({ ...context, destination: { ...dest, countryCode: null } }),
    ).toBe(false);
  });
});
