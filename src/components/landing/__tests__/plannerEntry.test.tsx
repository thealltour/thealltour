import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LandingHero } from "../LandingHero";
import { getHubHeroConfig } from "@/lib/landingMetadata";

const flags = vi.hoisted(() => ({ ENABLE_FREE_TRAVEL_PLANNER: true }));
const track = vi.hoisted(() => vi.fn());
const openModal = vi.hoisted(() => vi.fn());
vi.mock("@/config/featureFlags", () => flags);
vi.mock("@/lib/analytics/trackEvent", () => ({ trackClientAnalytics: track }));
vi.mock("next/navigation", () => ({ usePathname: () => "/destinations" }));
vi.mock("@/components/inquiry/ConsultModal", () => ({ useConsultModal: () => ({ openModal }) }));
vi.mock("../HeroVisual", () => ({
  HeroVisual: ({ children, imageUrl }: { children: ReactNode; imageUrl?: string }) => (
    <section data-testid="hero-visual" data-image-url={imageUrl}>
      {children}
    </section>
  ),
}));

const imageProps = {
  title: "지역별 여행",
  imageUrl: "/hero.png",
  ctaLabel: "전체 상품 보기",
  ctaHref: "/products",
  secondaryCtaLabel: "맞춤 상담 문의",
  secondaryCtaHref: "/quote",
};

const editorialProps = {
  ...getHubHeroConfig("destinations"),
  variant: "editorial" as const,
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  flags.ENABLE_FREE_TRAVEL_PLANNER = true;
});

describe("hub planner discovery — editorial", () => {
  it.each(["destinations_hero", "themes_hero"] as const)(
    "records %s once and retains product and modal actions",
    (source) => {
      render(<LandingHero {...editorialProps} plannerEntry={{ source }} />);
      expect(screen.queryByTestId("hero-visual")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "지역별 여행" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "전체 상품 보기" })).toHaveAttribute("href", "/products");
      fireEvent.click(screen.getByRole("button", { name: "맞춤 상담 문의" }));
      expect(openModal).toHaveBeenCalledWith({ sourcePath: "/destinations#landing-hero-consult" });
      const links = screen.getAllByRole("link", { name: "여행플래너 시작하기" });
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", "/planner");
      expect(links[1]).toHaveAttribute("href", "/planner");
      expect(screen.getAllByText("여행플래너").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("내 여행을 직접 만들어보세요").length).toBeGreaterThanOrEqual(2);
      expect(
        screen.getByText("출발지와 목적지만 알려주시면 여행 일정을 정리해드려요."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("출발지와 목적지를 알려주시면 일정부터 여행 준비까지 함께 정리해드려요."),
      ).toBeInTheDocument();
      fireEvent.click(links[0]!);
      fireEvent.click(links[1]!);
      expect(track).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          eventName: "planner_entry_click",
          section: source,
          metadata: { variant: "compact" },
        }),
      );
      expect(track).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          eventName: "planner_entry_click",
          section: source,
          metadata: { variant: "card" },
        }),
      );
    },
  );

  it("does not add an entry without the opt-in prop", () => {
    render(<LandingHero {...editorialProps} />);
    expect(screen.queryByRole("link", { name: "여행플래너 시작하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 상품 보기" })).toBeInTheDocument();
  });

  it("hides the entry when disabled even with the prop", () => {
    flags.ENABLE_FREE_TRAVEL_PLANNER = false;
    render(<LandingHero {...editorialProps} plannerEntry={{ source: "destinations_hero" }} />);
    expect(screen.queryByRole("link", { name: "여행플래너 시작하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "맞춤 상담 문의" })).toBeInTheDocument();
  });

  it("ignores imageUrl in editorial mode", () => {
    render(
      <LandingHero
        {...editorialProps}
        imageUrl="/should-be-ignored.png"
        plannerEntry={{ source: "destinations_hero" }}
      />,
    );
    expect(screen.queryByTestId("hero-visual")).not.toBeInTheDocument();
  });

  it("themes hub config preserves left copy and CTAs", () => {
    const themes = getHubHeroConfig("themes");
    render(
      <LandingHero {...themes} variant="editorial" plannerEntry={{ source: "themes_hero" }} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "테마별 여행" })).toBeInTheDocument();
    expect(screen.getByText("테마별 여행", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 상품 보기" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("button", { name: "맞춤 상담 문의" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "여행플래너 시작하기" })).toHaveLength(2);
  });
});

describe("hub planner discovery — image mode regression", () => {
  it("still renders HeroVisual when imageUrl is set without editorial", () => {
    render(<LandingHero {...imageProps} plannerEntry={{ source: "destinations_hero" }} />);
    expect(screen.getByTestId("hero-visual")).toHaveAttribute("data-image-url", "/hero.png");
    expect(screen.getAllByRole("link", { name: "여행플래너 시작하기" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "전체 상품 보기" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "맞춤 상담 문의" }));
    expect(openModal).toHaveBeenCalled();
  });

  it("retains the text-only mode", () => {
    render(<LandingHero {...imageProps} imageUrl={null} plannerEntry={{ source: "themes_hero" }} />);
    expect(screen.queryByRole("link", { name: "여행플래너 시작하기" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "전체 상품 보기" }).length).toBeGreaterThan(0);
  });
});
