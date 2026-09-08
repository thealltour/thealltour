import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import HeroSection from "../HeroSection";
import { HomeTravelEntries } from "../HomeTravelEntries";
import { HomeQuickKeywords } from "../HomeQuickKeywords";

const flags = vi.hoisted(() => ({ ENABLE_FREE_TRAVEL_PLANNER: true }));
const track = vi.hoisted(() => vi.fn());
vi.mock("@/config/featureFlags", () => flags);
vi.mock("@/lib/analytics/trackEvent", () => ({ trackClientAnalytics: track }));
vi.mock("../HomeHeroSearch", () => ({ HomeHeroSearch: () => <input aria-label="상품 검색" /> }));
vi.mock("../HeroPanoramaSlideshowClient", () => ({ HeroPanoramaSlideshowClient: () => null }));

beforeEach(() => { cleanup(); vi.clearAllMocks(); flags.ENABLE_FREE_TRAVEL_PLANNER = true; });

describe("balanced home discovery", () => {
  it("offers golf and planner once with equal styling and separate destinations", () => {
    render(<HomeTravelEntries golfHref="#home-golf-explore" />);
    const golf = screen.getByRole("link", { name: "골프여행 찾기" });
    const planner = screen.getByRole("link", { name: "자유여행 만들기" });
    expect(golf).toHaveAttribute("href", "#home-golf-explore");
    expect(planner).toHaveAttribute("href", "/planner");
    expect(golf.className).toBe(planner.className);
    expect(golf.querySelector("button,a")).toBeNull();
    expect(planner.querySelector("button,a")).toBeNull();
    expect(screen.queryByText("골프여행 둘러보기")).not.toBeInTheDocument();
    expect(screen.queryByText("여행플래너 시작하기")).not.toBeInTheDocument();
    expect(screen.getByText("출발일별 추천 골프상품")).toBeInTheDocument();
    expect(screen.getByText("일정·취향 맞춤 여행 설계")).toBeInTheDocument();
    expect(screen.getByText("출발 일정과 추천 상품을 확인해보세요")).toBeInTheDocument();
    expect(screen.getByText("내 일정과 취향에 맞는 여행을 만들어보세요")).toBeInTheDocument();
    fireEvent.click(golf);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenLastCalledWith(expect.objectContaining({ eventName: "home_travel_entry_click", section: "golf" }));
    fireEvent.click(planner);
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenLastCalledWith(expect.objectContaining({ eventName: "planner_entry_click", section: "home_hero", href: "/planner", metadata: { variant: "paired" } }));
  });

  it("removes only duplicate quick actions when the paired entries are present", () => {
    render(<HomeQuickKeywords pairedEntriesVisible />);
    expect(screen.queryByRole("link", { name: /골프|플랜/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "전체 상품 목록으로 이동" })).toHaveAttribute("href", "/products");
  });

  it.each([true, false])("gates the hero pair and preserves search with flag=%s", (enabled) => {
    flags.ENABLE_FREE_TRAVEL_PLANNER = enabled;
    render(<HeroSection golfEntryHref="#home-golf-explore" hero={{ badge: null, main_copy_accent: "품격 있는", main_copy_tail: " 여행", sub_description: null, recommended_text: null, search_placeholder: null }} />);
    expect(screen.getByRole("textbox", { name: "상품 검색" })).toBeInTheDocument();
    const pair = screen.queryByRole("navigation", { name: "여행 준비 방법" });
    if (enabled) {
      expect(pair).toBeInTheDocument();
      expect(within(pair!).getAllByRole("link")).toHaveLength(2);
    } else {
      expect(pair).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /플랜/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "골프 여행 상품 보기" })).toBeInTheDocument();
    }
  });
});
