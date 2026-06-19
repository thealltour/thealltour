import { describe, expect, it } from "vitest";
import { inferMainMenuKey, resolveActiveSubTab } from "@/lib/adminNav/adminNav.config";

describe("adminNav.config", () => {
  it("resolves bookings sub tabs", () => {
    expect(inferMainMenuKey("/theall_manager_only/bookings/new", null)).toBe("bookings");
    expect(
      resolveActiveSubTab("bookings", "/theall_manager_only/bookings/new", {
        view: null,
        status: null,
        tab: null,
      }),
    ).toBe("예약 생성");
    expect(
      resolveActiveSubTab("bookings", "/theall_manager_only/bookings", {
        view: null,
        status: null,
        tab: null,
      }),
    ).toBe("예약 목록");
  });
});
