import { describe, expect, it } from "vitest";
import { buildProductInquiryPrefill } from "@/lib/products/buildProductInquiryPrefill";

describe("buildProductInquiryPrefill", () => {
  it("includes departure and options in inquiry text", () => {
    const text = buildProductInquiryPrefill({
      productTitle: "태국 골프 3박",
      selectedDeparture: {
        label: "7/23(목) · 899,000원",
        inquiryValue: "2026-07-23",
        price: 899000,
      },
      quoteSummary: {
        total: 939000,
        basePrice: 899000,
        breakdown: [
          {
            groupId: "room",
            groupLabel: "싱글룸",
            optionId: "single",
            optionLabel: "싱글룸 이용",
            priceDelta: 40000,
          },
        ],
        durationLabel: null,
      },
    });

    expect(text).toContain("상품: 태국 골프 3박");
    expect(text).toContain("희망 출발일: 2026-07-23");
    expect(text).toContain("선택 요금: 899,000원");
    expect(text).toContain("싱글룸: 싱글룸 이용");
    expect(text).toContain("예상 견적: 939,000원");
  });

  it("includes traveler count after departure", () => {
    const text = buildProductInquiryPrefill({
      productTitle: "태국 골프 3박",
      selectedDeparture: {
        label: "7/23(목)",
        inquiryValue: "2026-07-23",
      },
      travelerCount: 4,
    });

    expect(text).toContain("희망 출발일: 2026-07-23");
    expect(text).toContain("인원: 4명");
    expect(text.indexOf("인원: 4명")).toBeGreaterThan(text.indexOf("희망 출발일"));
  });

  it("formats raw multi selected_options fallback", () => {
    const text = buildProductInquiryPrefill({
      selectedOptions: {
        surcharges: ["surcharge-0", "surcharge-1"],
      },
    });

    expect(text).toContain("- surcharges: surcharge-0");
    expect(text).toContain("- surcharges: surcharge-1");
  });
});
