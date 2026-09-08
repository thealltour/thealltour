import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DesktopMegaMenu } from "../DesktopMegaMenu";
import { MobileHeaderDrawer } from "../MobileHeaderDrawer";
import { withPlannerNavigation, isPlannerPath } from "@/lib/planner/entryNavigation";
import { HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF } from "../headerNav.constants";
import SiteHeaderUI from "@/components/site-chrome/SiteHeaderUI";

const flags = vi.hoisted(() => ({ ENABLE_FREE_TRAVEL_PLANNER: true }));
const track = vi.hoisted(() => vi.fn());
const nav = vi.hoisted(() => ({ pathname: "/planner" }));
vi.mock("@/config/featureFlags", () => flags);
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/analytics/trackClientEvent", () => ({ trackClientEvent: track }));
vi.mock("@/components/auth/AuthModalProvider", () => ({ useAuthModal: () => ({ openAuth: vi.fn() }) }));
vi.mock("@/components/header/HeaderProductSearch", () => ({ default: () => null }));
vi.mock("@/components/header/HeaderQuickConsultCtas", () => ({ default: () => null }));
vi.mock("@/components/header/UserMenuDropdown", () => ({ default: () => null }));
vi.mock("@/components/header/GuestAuthHoverMenu", () => ({ default: () => null }));
vi.mock("@/components/header/HeaderExpandSearch", () => ({ HeaderExpandSearch: () => null }));
vi.mock("@/components/header/HeaderBrandLogo", () => ({ HeaderBrandLogo: () => null }));
vi.mock("@/components/header/MobileHeaderMenu", () => ({ MobileHeaderMenu: () => null }));
vi.mock("@/components/site-chrome/GuestSignupPromoBanner", () => ({ GuestSignupPromoBanner: () => null }));
const fallback = HEADER_PRIMARY_NAV_ITEMS.map(({ key, label }) => ({ key, label, href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key] }));
beforeEach(() => { cleanup(); vi.clearAllMocks(); flags.ENABLE_FREE_TRAVEL_PLANNER = true; nav.pathname = "/planner"; });

describe("public planner navigation", () => {
  it.each([null, { primaryNav: [] }, { primaryNav: [{ key: "region", label: "지역별 여행", href: "/destinations" }] }])("renders the public link through SiteHeaderUI normal/fallback paths: %s", (data) => {
    const { rerender } = render(<SiteHeaderUI headerNavigationData={data} session={null} memberPoints={null} />);
    expect(screen.getAllByRole("link", { name: "여행플래너" })).toHaveLength(1);
    flags.ENABLE_FREE_TRAVEL_PLANNER = false;
    rerender(<SiteHeaderUI headerNavigationData={data} session={null} memberPoints={null} />);
    expect(screen.queryByRole("link", { name: "여행플래너" })).not.toBeInTheDocument();
  });
  it.each([{ input: [] }, { input: fallback }, { input: [{ key: "region", label: "지역별 여행", href: "/destinations" }] }])("normalizes sparse, fallback and server menus without duplicates", ({ input }) => {
    const on = withPlannerNavigation(withPlannerNavigation(input, true), true);
    expect(on.filter((item) => item.key === "planner")).toEqual([{ key: "planner", label: "여행플래너", href: "/planner" }]);
    expect(withPlannerNavigation(on, false).some((item) => item.key === "planner")).toBe(false);
  });
  it.each(["/planner", "/planner/my", "/planner/abc"])("recognizes planner route %s", (path) => expect(isPlannerPath(path)).toBe(true));
  it("does not activate unrelated prefix paths", () => expect(isPlannerPath("/planner-other")).toBe(false));
  it("renders golf then a direct planner link then inquiry with the right position", () => {
    render(<DesktopMegaMenu primaryNav={withPlannerNavigation(fallback)} />);
    const links = within(screen.getByRole("navigation", { name: "탐색 메뉴" })).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["여행추천", "지역별 여행", "테마별 여행", "골프", "여행플래너", "맞춤/단체문의"]);
    const planner = screen.getByRole("link", { name: "여행플래너" });
    expect(planner).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: /여행플래너/ })).not.toBeInTheDocument();
    fireEvent.click(planner);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ eventName: "header_nav_click", section: "planner", position: 4 }));
  });
  it.each([null, { name: "회원" }])("exposes mobile creation for session=%s and closes on the same route", (session) => {
    const close = vi.fn();
    render(<MobileHeaderDrawer primaryNav={withPlannerNavigation(fallback)} isOpen onClose={close} session={session} />);
    close.mockClear();
    fireEvent.click(screen.getByRole("link", { name: "여행플래너" }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ eventName: "mobile_menu_click", source: "header_mobile_drawer", section: "planner" }));
    if (session) expect(screen.getByRole("link", { name: "내 여행 플랜" })).toHaveAttribute("href", "/planner/my");
  });
  it("removes public entries when disabled", () => {
    flags.ENABLE_FREE_TRAVEL_PLANNER = false;
    const primaryNav = withPlannerNavigation(fallback);
    render(<><DesktopMegaMenu primaryNav={primaryNav} /><MobileHeaderDrawer primaryNav={primaryNav} isOpen onClose={vi.fn()} session={null} /></>);
    expect(screen.queryByRole("link", { name: "여행플래너" })).not.toBeInTheDocument();
  });
});
