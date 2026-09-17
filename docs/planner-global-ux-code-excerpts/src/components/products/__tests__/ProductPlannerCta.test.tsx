import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductPlannerCta } from "@/components/products/ProductPlannerCta";

describe("ProductPlannerCta", () => {
  it("links to /planner with sourceProductId query", () => {
    render(
      <ProductPlannerCta
        productId="550e8400-e29b-41d4-a716-446655440000"
        enabled
      />,
    );
    const link = screen.getByRole("link", { name: "자유여행 플랜 만들기" });
    expect(link).toHaveAttribute(
      "href",
      "/planner?sourceProductId=550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("renders nothing when feature flag is off", () => {
    const { container } = render(
      <ProductPlannerCta
        productId="550e8400-e29b-41d4-a716-446655440000"
        enabled={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
