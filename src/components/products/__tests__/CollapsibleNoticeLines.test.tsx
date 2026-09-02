import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapsibleNoticeLines } from "@/components/products/CollapsibleNoticeLines";

const LONG_URL =
  "https://efamily.scourt.go.kr/very/very/very/long/path/for/mobile/wrapping/check";

describe("CollapsibleNoticeLines", () => {
  it("shows toggle for long notice and preserves full content when expanded", () => {
    const lines = Array.from({ length: 15 }, (_, i) => `여행 유의사항 ${i + 1}`);
    render(<CollapsibleNoticeLines lines={lines} />);

    expect(screen.getByRole("button", { name: "내용 더보기" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("여행 유의사항 15")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "내용 더보기" }));
    expect(screen.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("여행 유의사항 15")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(screen.getByRole("button", { name: "내용 더보기" })).toBeInTheDocument();
  });

  it("does not show toggle for short notice", () => {
    render(<CollapsibleNoticeLines lines={["짧은 안내"]} />);
    expect(screen.getByText("짧은 안내")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "내용 더보기" })).not.toBeInTheDocument();
  });

  it("autolinks URLs inside notice lines", () => {
    render(<CollapsibleNoticeLines lines={[`전자가족관계등록: ${LONG_URL}`]} />);
    const link = screen.getByRole("link", { name: LONG_URL });
    expect(link).toHaveAttribute("href", LONG_URL);
  });
});
