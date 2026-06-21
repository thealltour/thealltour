import { describe, expect, it } from "vitest";
import {
  deriveDerivedFieldsForSave,
  extractHotelHintFromText,
  normalizeFormFromProduct,
  hasLegacyScheduleOnly,
} from "@/components/admin/products/editor/adminProductForm.derive";
import { createEmptyAdminProductFormState } from "@/components/admin/products/editor/adminProductForm.defaults";

describe("adminProductForm.derive", () => {
  it("deriveDerivedFieldsForSave mirrors duration to overview_duration", () => {
    const form = { ...createEmptyAdminProductFormState(), duration: "5일" };
    const derived = deriveDerivedFieldsForSave(form);
    expect(derived.overview_duration).toBe("5일");
  });

  it("deriveDerivedFieldsForSave uses destinationName for category and overview_region", () => {
    const form = createEmptyAdminProductFormState();
    const derived = deriveDerivedFieldsForSave(form, { destinationName: "일본" });
    expect(derived.category).toBe("일본");
    expect(derived.overview_region).toBe("일본");
  });

  it("normalizeFormFromProduct merges overview_duration into duration", () => {
    const form = {
      ...createEmptyAdminProductFormState(),
      duration: "",
      overview_duration: "4박 5일",
    };
    const normalized = normalizeFormFromProduct(form);
    expect(normalized.duration).toBe("4박 5일");
    expect(normalized.overview_duration).toBe("");
  });

  it("normalizeFormFromProduct extracts hotel hint from meta_info", () => {
    const form = {
      ...createEmptyAdminProductFormState(),
      meta_info: "전일정4성",
    };
    const normalized = normalizeFormFromProduct(form);
    expect(normalized.overview_accommodation).toBe("전일정4성");
  });

  it("extractHotelHintFromText matches 성급 pattern", () => {
    expect(extractHotelHintFromText("전일정 5성")).toBe("전일정 5성");
  });

  it("hasLegacyScheduleOnly is true when only detailed_schedule exists", () => {
    const form = {
      ...createEmptyAdminProductFormState(),
      detailed_schedule: "[1일차] 출발",
      itinerary_v2_json: { days: [] },
    };
    expect(hasLegacyScheduleOnly(form)).toBe(true);
  });

  it("hasLegacyScheduleOnly is false when v2 has content", () => {
    const form = {
      ...createEmptyAdminProductFormState(),
      itinerary_v2_json: {
        days: [{ day: 1, title: "Day1", events: [{ heading: "출발", description: "" }] }],
      },
    };
    expect(hasLegacyScheduleOnly(form)).toBe(false);
  });
});
