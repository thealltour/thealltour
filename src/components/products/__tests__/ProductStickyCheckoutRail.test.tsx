import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductStickyCheckoutRail } from "@/components/products/ProductStickyCheckoutRail";

vi.mock("@/components/inquiry/ConsultModal", () => ({
  useConsultModal: () => ({ openModal: vi.fn() }),
}));

vi.mock("@/components/products/ProductQuoteContext", () => ({
  useProductQuote: () => ({
    selectedOptions: {},
    selectedDeparture: null,
    selectedDepartureKey: null,
    travelerCount: 1,
    requiredGroupsMissing: false,
    departureRequired: false,
    departureSelectionMissing: true,
    scrollToBooking: vi.fn(),
    setDepartureSelection: vi.fn(),
    paxDiscountPreview: null,
  }),
}));

vi.mock("@/config/featureFlags", () => ({
  ENABLE_PRODUCT_OPTIONS: false,
}));

describe("ProductStickyCheckoutRail bar layout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies min-w-0 truncate contract on mobile bar CTA row", () => {
    render(
      <ProductStickyCheckoutRail
        layout="bar"
        product={{ id: "p1", title: "테스트 상품" } as never}
        productTitle="테스트 상품"
      />,
    );

    const reserve = screen.getByRole("button", { name: /출발일 선택 후 예약|예약하기/ });
    expect(reserve.className).toMatch(/min-w-0/);
    expect(reserve.className).toMatch(/flex-1/);

    const label = reserve.querySelector("span");
    expect(label?.className).toMatch(/truncate/);

    const kakao = screen.getByRole("button", { name: "카톡 상담" });
    expect(kakao.className).toMatch(/shrink-0/);
    expect(kakao.className).toMatch(/min-w-12/);
    expect(kakao.className).toMatch(/w-12/);
    expect(kakao.textContent?.trim()).toBe("");
  });
});
