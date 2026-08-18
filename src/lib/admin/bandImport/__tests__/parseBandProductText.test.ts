import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateObjectMock = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: (model: string) => `openai:${model}`,
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI:
    ({ apiKey }: { apiKey: string }) =>
    (model: string) =>
      `google:${apiKey}:${model}`,
}));

import { parseBandProductText } from "@/lib/admin/bandImport/parseBandProductText";

const baseMeta = {
  title: "테스트 상품",
  description: "설명",
  band_marketing_copy: null,
  one_liner: null,
  price: 500000,
  duration: "3박4일",
  category: null,
  theme: null,
  overview_accommodation: null,
  overview_region: null,
  included_items: null,
  excluded_items: null,
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
};

describe("parseBandProductText", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    delete process.env.IMPORT_AI_PROVIDER;
    delete process.env.BAND_IMPORT_MODEL;
    delete process.env.IMPORT_AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-google-key";
  });

  it("calls generateObject twice for meta and itinerary passes", async () => {
    generateObjectMock
      .mockResolvedValueOnce({ object: baseMeta })
      .mockResolvedValueOnce({
        object: {
          itinerary_v2_json: [
            { day: 1, title: "1일차", description: "출발", meals: null },
          ],
          theme_chart_json: {
            items: [
              { label: "골프", percent: 60 },
              { label: "관광", percent: 40 },
            ],
          },
        },
      });

    const result = await parseBandProductText({
      bandText: "밴드 본문",
      hwpText: "HWP 본문",
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(result.title).toBe("테스트 상품");
    expect(result.itinerary_v2_json).toHaveLength(1);
    expect(result.theme_chart_json).toEqual({
      items: [
        { label: "골프", percent: 60 },
        { label: "관광", percent: 40 },
      ],
    });
    expect(generateObjectMock.mock.calls[0][0].model).toBe(
      "google:test-google-key:gemini-3.6-flash",
    );
  });
});
