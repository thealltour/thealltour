import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SiteHeaderUI from "@/components/site-chrome/SiteHeaderUI";

const nav = vi.hoisted(() => ({ pathname: "/about" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/config/featureFlags", () => ({ ENABLE_FREE_TRAVEL_PLANNER: true }));
vi.mock("@/lib/analytics/trackClientEvent", () => ({ trackClientEvent: vi.fn() }));
vi.mock("@/components/auth/AuthModalProvider", () => ({ useAuthModal: () => ({ openAuth: vi.fn() }) }));
vi.mock("@/components/header/HeaderProductSearch", () => ({
  default: () => <div data-testid="header-product-search" />,
}));
vi.mock("@/components/header/HeaderQuickConsultCtas", () => ({ default: () => null }));
vi.mock("@/components/header/UserMenuDropdown", () => ({ default: () => null }));
vi.mock("@/components/header/GuestAuthHoverMenu", () => ({ default: () => null }));
vi.mock("@/components/header/HeaderBrandLogo", () => ({ HeaderBrandLogo: () => null }));
vi.mock("@/components/header/DesktopMegaMenu", () => ({ DesktopMegaMenu: () => null }));
vi.mock("@/components/site-chrome/GuestSignupPromoBanner", () => ({ GuestSignupPromoBanner: () => null }));

beforeEach(() => {
  cleanup();
  nav.pathname = "/about";
});

describe("SiteHeaderUI mobile search row", () => {
  it("shows mobile search row on home (banner search is hidden instead)", () => {
    nav.pathname = "/";
    render(<SiteHeaderUI session={null} memberPoints={null} />);
    expect(screen.getAllByTestId("header-product-search").length).toBeGreaterThanOrEqual(1);
  });

  it("shows mobile search row on non-home pages by default", () => {
    nav.pathname = "/about";
    render(<SiteHeaderUI session={null} memberPoints={null} />);
    expect(screen.getAllByTestId("header-product-search").length).toBeGreaterThanOrEqual(1);
  });

  it("hides mobile search row when hideMobileSearchRow is set (planner write/result)", () => {
    nav.pathname = "/planner/550e8400-e29b-41d4-a716-446655440000";
    render(<SiteHeaderUI session={null} memberPoints={null} hideMobileSearchRow />);
    // Desktop always-visible search still mounts; mobile row is gated by showHeaderSearchRow.
    // MobileHeaderMenu receives showHeaderSearchRow=false — mock search is only from desktop row.
    expect(screen.getAllByTestId("header-product-search").length).toBe(1);
  });

  it("keeps mobile search row on /planner when hideMobileSearchRow is not set", () => {
    nav.pathname = "/planner";
    render(<SiteHeaderUI session={null} memberPoints={null} />);
    expect(screen.getAllByTestId("header-product-search").length).toBeGreaterThanOrEqual(1);
  });
});
