import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { withPlannerNavigation } from "@/lib/planner/entryNavigation";
import {
  HEADER_PRIMARY_NAV_DEFAULT_HREF,
  HEADER_PRIMARY_NAV_ITEMS,
} from "@/components/header/headerNav.constants";

const nav = vi.hoisted(() => ({ pathname: "/corporate/business" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/analytics/trackClientEvent", () => ({ trackClientEvent: vi.fn() }));

const fallback = HEADER_PRIMARY_NAV_ITEMS.filter((item) =>
  ["recommended", "region", "theme", "inquiry", "guides", "support"].includes(item.key),
).map(({ key, label }) => ({ key, label, href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key] }));

describe("DesktopMegaMenu corporate active state", () => {
  it("marks 기업·단체여행 active on /corporate child paths", () => {
    render(<DesktopMegaMenu primaryNav={withPlannerNavigation(fallback)} />);
    const corporate = within(screen.getByRole("navigation", { name: "탐색 메뉴" })).getByRole(
      "link",
      { name: "기업·단체여행" },
    );
    expect(corporate.className).toMatch(/font-semibold/);
  });
});
