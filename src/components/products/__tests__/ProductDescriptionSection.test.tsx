import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  needsDescriptionCollapse,
  ProductDescriptionSection,
  shouldShowProductDescription,
} from "@/components/products/ProductDescriptionSection";

describe("shouldShowProductDescription", () => {
  it("hides empty and placeholder copy", () => {
    expect(shouldShowProductDescription(null)).toBe(false);
    expect(shouldShowProductDescription("   ")).toBe(false);
    expect(shouldShowProductDescription("상품 설명을 확인해 주세요.")).toBe(false);
  });

  it("shows real product copy", () => {
    expect(shouldShowProductDescription("🔥 밴드 특가")).toBe(true);
  });
});

describe("needsDescriptionCollapse", () => {
  it("collapses long line count or character count", () => {
    expect(needsDescriptionCollapse("짧음")).toBe(false);
    expect(needsDescriptionCollapse(Array.from({ length: 13 }, (_, i) => `줄 ${i}`).join("\n"))).toBe(true);
    expect(needsDescriptionCollapse("가".repeat(801))).toBe(true);
  });
});

describe("ProductDescriptionSection", () => {
  it("renders band marketing copy", () => {
    render(<ProductDescriptionSection description={"🔥 72홀 골프 특가!\n지금 신청하세요."} />);
    expect(screen.getByRole("region", { name: "상품 소개" })).toBeTruthy();
    expect(screen.getByText(/72홀 골프 특가/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "더보기" })).toBeNull();
  });

  it("does not render placeholder description", () => {
    const { container } = render(<ProductDescriptionSection description="상품 설명을 확인해 주세요." />);
    expect(container.firstChild).toBeNull();
  });

  it("expands collapsed long copy", () => {
    const longCopy = Array.from({ length: 20 }, (_, i) => `밴드 본문 줄 ${i + 1}`).join("\n");
    render(<ProductDescriptionSection description={longCopy} />);
    expect(screen.queryByText(/밴드 본문 줄 20/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "더보기" }));
    expect(screen.getByText(/밴드 본문 줄 20/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "접기" })).toBeTruthy();
  });
});
