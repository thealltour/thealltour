import { describe, expect, it } from "vitest";
import { mergeBandParsed } from "@/lib/admin/bandImport/mergeBandParsed";
import type { BandParsedMeta } from "@/lib/admin/bandImport/bandProductMetaSchema";
import type { BandParsedItineraryOnly } from "@/lib/admin/bandImport/bandItineraryOnlySchema";

describe("mergeBandParsed", () => {
  it("merges meta and itinerary into BandParsedProduct", () => {
    const meta = {
      title: "연태 골프",
      description: "개요",
      band_marketing_copy: null,
      one_liner: null,
      price: 1000000,
      duration: "3박4일",
      category: "골프투어",
      theme: "골프",
      overview_accommodation: null,
      overview_region: "연태",
      included_items: "항공",
      excluded_items: "팁",
      optional_expenses: null,
      optional_tours: null,
      booking_notes: null,
      options: null,
      status: "AVAILABLE" as const,
      airline_name: null,
      departure_flight_number: null,
      departure_from_airport: null,
      departure_to_airport: null,
      departure_from_date: null,
      departure_from_time: null,
      departure_to_date: null,
      departure_to_time: null,
      departure_baggage_limit: null,
      arrival_flight_number: null,
      arrival_from_airport: null,
      arrival_to_airport: null,
      arrival_from_date: null,
      arrival_from_time: null,
      arrival_to_date: null,
      arrival_to_time: null,
      arrival_baggage_limit: null,
      departure_time: null,
      arrival_time: null,
      departure_schedules: null,
      seasonal_price_bands: null,
      seasonal_price_band_notes: null,
      selling_points_json: null,
      detailed_schedule: null,
      travel_notes: null,
      booking_conditions: null,
      terms_and_notes: null,
      refund_policy: null,
      min_departure_people: null,
      meta_title: null,
      meta_description: null,
      point_benefits: null,
      point_tourism: null,
      point_guide: null,
      meeting_info: null,
      travel_insurance: null,
    } satisfies BandParsedMeta;

    const itinerary: BandParsedItineraryOnly = {
      itinerary_v2_json: [
        {
          day: 1,
          title: "1일차",
          description: "인천 출발",
          meals: { breakfast: null, lunch: null, dinner: null },
        },
      ],
    };

    const merged = mergeBandParsed(meta, itinerary);
    expect(merged.title).toBe("연태 골프");
    expect(merged.itinerary_v2_json).toHaveLength(1);
  });
});
