import { describe, expect, it } from "vitest";
import { resolveCheckoutBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";

describe("resolveCheckoutBenefitMode", () => {
  it("returns golf_coupon for golf tour category", () => {
    expect(
      resolveCheckoutBenefitMode({ category: "골프투어", product_line_id: null }),
    ).toBe("golf_coupon");
    expect(
      resolveCheckoutBenefitMode({ category: "파크골프투어", product_line_id: null }),
    ).toBe("golf_coupon");
  });

  it("returns golf_coupon when product_line map says golf", () => {
    expect(
      resolveCheckoutBenefitMode(
        { category: null, product_line_id: "line-1" },
        { "line-1": "골프투어" },
      ),
    ).toBe("golf_coupon");
  });

  it("returns package_points for non-golf packages", () => {
    expect(
      resolveCheckoutBenefitMode({ category: "패키지여행", product_line_id: null }),
    ).toBe("package_points");
    expect(
      resolveCheckoutBenefitMode(
        { category: "휴양", product_line_id: "line-2" },
        { "line-2": "패키지여행" },
      ),
    ).toBe("package_points");
  });
});
