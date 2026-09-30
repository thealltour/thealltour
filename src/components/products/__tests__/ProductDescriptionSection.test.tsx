import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  needsDescriptionCollapse,
  ProductDescriptionSection,
  shouldShowDescriptionSection,
  shouldShowGolfCourseInfo,
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

describe("shouldShowGolfCourseInfo", () => {
  it("hides empty golf course copy", () => {
    expect(shouldShowGolfCourseInfo(null)).toBe(false);
    expect(shouldShowGolfCourseInfo("   ")).toBe(false);
  });

  it("shows filled golf course copy", () => {
    expect(shouldShowGolfCourseInfo("18홀")).toBe(true);
  });
});

describe("shouldShowDescriptionSection", () => {
  it("shows the section for description or legacy golf course text only", () => {
    expect(shouldShowDescriptionSection("밴드 특가", null)).toBe(true);
    expect(shouldShowDescriptionSection("", "클럽하우스 안내")).toBe(true);
    expect(shouldShowDescriptionSection("", null)).toBe(false);
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

  it("renders golf course info in a second column", () => {
    render(
      <ProductDescriptionSection
        description="이왕가시는 해외골프여행"
        golfCourseInfo={"챔피언십 18홀\n페어웨이 상태가 좋습니다."}
      />,
    );
    expect(screen.getByRole("region", { name: "상품 소개와 골프장 정보" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "상품 소개" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "골프장 정보" })).toBeTruthy();
    expect(screen.getByText(/챔피언십 18홀/)).toBeTruthy();
  });

  it("hides golf course column when empty", () => {
    render(<ProductDescriptionSection description="밴드 특가" golfCourseInfo="   " />);
    expect(screen.getByRole("region", { name: "상품 소개" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "골프장 정보" })).toBeNull();
  });

  it("renders golf course info alone when description is missing", () => {
    render(<ProductDescriptionSection description="" golfCourseInfo="클럽하우스 안내" />);
    expect(screen.getByRole("region", { name: "골프장 정보" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "상품 소개" })).toBeNull();
    expect(screen.getByText("클럽하우스 안내")).toBeTruthy();
  });

  it("stacks description and golf info in embedded mode", () => {
    render(
      <ProductDescriptionSection
        description="골프와 휴양의 완벽한 조합"
        golfCourseInfo="코랄오션 18홀"
        embedded
      />,
    );
    const region = screen.getByRole("region", { name: "상품 소개와 골프장 정보" });
    expect(region.className).not.toContain("grid");
    expect(screen.getByRole("heading", { name: "상품 소개" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "골프장 정보" })).toBeTruthy();
  });

  it("collapses runs of blank lines so the preview keeps real content", () => {
    const copy = Array.from({ length: 6 }, (_, i) => `문단 ${i + 1}`).join("\n\n\n\n");
    render(<ProductDescriptionSection description={copy} embedded />);
    expect(screen.queryByRole("button", { name: "더보기" })).toBeNull();
    expect(screen.getByText(/문단 6/)).toBeTruthy();
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
