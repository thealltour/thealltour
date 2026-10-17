import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import HeroSection from "../HeroSection";
import { HomeTravelEntries } from "../HomeTravelEntries";
import { HomeTravelPathways } from "../HomeTravelPathways";
import { HomeQuickKeywords } from "../HomeQuickKeywords";
import { HomeHeroGolfFindCtas } from "../HomeHeroGolfFindCtas";

const flags = vi.hoisted(() => ({ ENABLE_FREE_TRAVEL_PLANNER: true }));
const track = vi.hoisted(() => vi.fn());
vi.mock("@/config/featureFlags", () => flags);
vi.mock("@/lib/analytics/trackEvent", () => ({ trackClientAnalytics: track }));
vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerEntryClick: (params: { source: string; variant: string }) => {
    track({
      eventName: "planner_entry_click",
      section: params.source,
      href: "/planner",
      metadata: { variant: params.variant },
    });
  },
}));
vi.mock("../HomeHeroSearch", () => ({ HomeHeroSearch: () => <input aria-label="상품 검색" /> }));
vi.mock("../HeroPanoramaSlideshowClient", () => ({ HeroPanoramaSlideshowClient: () => null }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  flags.ENABLE_FREE_TRAVEL_PLANNER = true;
});

describe("home hero golf find CTAs", () => {
  it("shows recommended and departure find buttons that deep-link into golf body", () => {
    render(<HomeHeroGolfFindCtas toursHref="#home-golf-tours" datesHref="#home-golf-dates" />);
    const tours = screen.getByRole("link", { name: "추천상품으로 찾기" });
    const dates = screen.getByRole("link", { name: "출발 날짜로 찾기" });
    expect(tours).toHaveAttribute("href", "#home-golf-tours");
    expect(dates).toHaveAttribute("href", "#home-golf-dates");
    fireEvent.click(tours);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ section: "golf_find_tours", href: "#home-golf-tours" }),
    );
  });

  it("hides missing golf find CTAs", () => {
    render(<HomeHeroGolfFindCtas toursHref="#home-golf-tours" datesHref={null} />);
    expect(screen.getByRole("link", { name: "추천상품으로 찾기" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "출발 날짜로 찾기" })).not.toBeInTheDocument();
  });
});

describe("home travel pathways", () => {
  it("renders golf and planner as independent pathway sections", () => {
    render(<HomeTravelPathways golfHref="#home-golf-explore" plannerEnabled />);
    expect(screen.getByRole("heading", { name: "골프여행 찾기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "자유여행 만들기" })).toBeInTheDocument();
    const golf = screen.getByRole("link", { name: /골프여행 찾기/ });
    const planner = screen.getByRole("link", { name: /자유여행 만들기/ });
    expect(golf).toHaveAttribute("href", "#home-golf-explore");
    expect(planner).toHaveAttribute("href", "/planner");
    fireEvent.click(planner);
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "planner_entry_click",
        section: "home_pathways",
        metadata: { variant: "card" },
      }),
    );
  });

  it("keeps legacy HomeTravelEntries styling for shared entry shell", () => {
    render(<HomeTravelEntries golfHref="#home-golf-explore" />);
    const golf = screen.getByRole("link", { name: "골프여행 찾기" });
    const planner = screen.getByRole("link", { name: "자유여행 만들기" });
    expect(golf.className).toBe(planner.className);
  });
});

describe("balanced home discovery", () => {
  it("removes only duplicate quick actions when travel pathways own golf/planner", () => {
    render(<HomeQuickKeywords pairedEntriesVisible />);
    expect(screen.queryByRole("link", { name: /골프|플랜/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "전체 상품 목록으로 이동" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("puts golf find CTAs in the hero and keeps search", () => {
    render(
      <HeroSection
        golfToursHref="#home-golf-tours"
        golfDatesHref="#home-golf-dates"
        hero={{
          badge: null,
          main_copy_accent: "품격 있는",
          main_copy_tail: " 여행",
          sub_description: null,
          recommended_text: null,
          search_placeholder: null,
        }}
      />,
    );
    expect(screen.getByRole("textbox", { name: "상품 검색" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "여행 준비 방법" })).not.toBeInTheDocument();
    const golfFind = screen.getByRole("navigation", { name: "골프여행 탐색" });
    expect(within(golfFind).getAllByRole("link")).toHaveLength(2);
  });
});
