import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AutolinkPlainText,
  isSafeHttpUrl,
  splitAutolinkSegments,
} from "@/lib/products/autolinkPlainText";

const LONG_URL =
  "https://efamily.scourt.go.kr/very/very/very/long/path/that/should/wrap/inside/mobile/viewport";

describe("autolinkPlainText", () => {
  it("links https URLs only", () => {
    const segments = splitAutolinkSegments(`안내 ${LONG_URL} 끝`);
    expect(segments.some((s) => s.kind === "url" && s.value === LONG_URL)).toBe(true);
    expect(isSafeHttpUrl(LONG_URL)).toBe(true);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("renders clickable anchor with wrapping classes", () => {
    render(<AutolinkPlainText text={`Visit ${LONG_URL} today`} />);
    const link = screen.getByRole("link", { name: LONG_URL });
    expect(link).toHaveAttribute("href", LONG_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link.className).toMatch(/overflow-wrap:anywhere/);
    expect(link.className).toMatch(/break-words/);
  });

  it("leaves non-URL text unchanged", () => {
    render(<AutolinkPlainText text="일반 안내 문구입니다." />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("일반 안내 문구입니다.")).toBeInTheDocument();
  });

  it("does not autolink javascript scheme", () => {
    const segments = splitAutolinkSegments("javascript:alert(1)");
    expect(segments.every((s) => s.kind === "text")).toBe(true);
  });
});
