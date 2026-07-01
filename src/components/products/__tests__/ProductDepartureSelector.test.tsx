import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProductDepartureSelector from "@/components/products/ProductDepartureSelector";

describe("ProductDepartureSelector", () => {
  it("renders schedule chips with price labels", () => {
    render(
      <ProductDepartureSelector
        schedules={[
          { departureDate: "2025-07-23", label: "7/23(수)", price: 890000 },
          { departureDate: "2025-07-30", price: 920000 },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: /7\/23\(수\) · 890,000원/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /2025-07-30 · 920,000원/ })).toBeTruthy();
  });

  it("passes selected departure and price to inquiry callback", () => {
    const onInquiryClick = vi.fn();
    render(
      <ProductDepartureSelector
        schedules={[{ departureDate: "2025-07-23", label: "7/23(수)", price: 890000 }]}
        onInquiryClick={onInquiryClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /7\/23\(수\) · 890,000원/ }));
    fireEvent.click(screen.getByRole("button", { name: "예약 문의" }));

    expect(onInquiryClick).toHaveBeenCalledWith("7/23(수) (890,000원)", 890000);
  });
});
