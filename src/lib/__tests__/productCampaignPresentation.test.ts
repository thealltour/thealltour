import { describe, expect, it } from "vitest";
import { getCampaignBadgeClassName } from "@/lib/productCampaignPresentation";

describe("getCampaignBadgeClassName unified shell", () => {
  it("추천 primary overlay — rounded-md primary token", () => {
    const cls = getCampaignBadgeClassName("추천", {
      isPrimary: true,
      kind: "grid",
      surface: "overlay",
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--primary)]");
    expect(cls).not.toContain("rounded-full");
  });

  it("인기 primary overlay — accent token", () => {
    const cls = getCampaignBadgeClassName("인기", {
      isPrimary: true,
      kind: "home",
      surface: "overlay",
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--accent)]");
  });

  it("신규 primary overlay — success token", () => {
    const cls = getCampaignBadgeClassName("신규", {
      isPrimary: true,
      kind: "related",
      surface: "overlay",
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--success)]");
  });

  it("promotion — warning token rounded-md", () => {
    const cls = getCampaignBadgeClassName("시즌 / 특가", {
      isPrimary: true,
      kind: "grid",
      surface: "overlay",
      isPromotion: true,
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--warning)]");
  });

  it("secondary overlay — isPrimary false도 동일 풀 컬러", () => {
    const cls = getCampaignBadgeClassName("기타", {
      isPrimary: false,
      kind: "grid",
      surface: "overlay",
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--foreground)]");
    expect(cls).not.toContain("rounded-full");
    expect(cls).not.toContain("surface-muted");
  });

  it("2번째 배지(isPrimary false)도 인기와 동일 accent 컬러", () => {
    const primary = getCampaignBadgeClassName("인기", {
      isPrimary: true,
      kind: "grid",
      surface: "overlay",
    });
    const secondary = getCampaignBadgeClassName("인기", {
      isPrimary: false,
      kind: "grid",
      surface: "overlay",
    });
    expect(secondary).toContain("bg-[var(--accent)]");
    expect(secondary).toContain("rounded-md");
    expect(secondary).not.toContain("surface-muted");
    expect(primary).toContain("bg-[var(--accent)]");
  });

  it("inline 배지도 풀 컬러 rounded-md", () => {
    const cls = getCampaignBadgeClassName("추천", {
      isPrimary: false,
      kind: "list",
      surface: "inline",
      size: "sm",
    });
    expect(cls).toContain("rounded-md");
    expect(cls).toContain("bg-[var(--primary)]");
    expect(cls).not.toContain("surface-muted");
  });
});
