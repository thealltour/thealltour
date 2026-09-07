import { describe, expect, it } from "vitest";
import {
  extractIsoCountryCode,
  resolveAffiliateDestination,
} from "@/lib/affiliate/planner/destinationResolver";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function samplePlan(country?: string | null): PlannerPlan {
  return {
    title: "t",
    summary: "s",
    destination: { name: "오사카", country: country ?? "일본" },
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

  it("keeps countryCode null for display-name country fields", async () => {
    const dest = await resolveAffiliateDestination({
      destinationText: "오사카",
      plan: samplePlan("일본"),
      input: createEmptyPlannerDraftInput("오사카"),
    });
    expect(dest.countryCode).toBeNull();
    expect(dest.text).toBe("오사카");
  });

  it("extractIsoCountryCode rejects non-ISO strings", () => {
    expect(extractIsoCountryCode({ planCountry: "jp" })).toBe("JP");
    expect(extractIsoCountryCode({ planCountry: "일본" })).toBeNull();
    expect(extractIsoCountryCode({ planCountry: "JPN" })).toBeNull();
    expect(extractIsoCountryCode({ planCountry: null })).toBeNull();
  });
});
