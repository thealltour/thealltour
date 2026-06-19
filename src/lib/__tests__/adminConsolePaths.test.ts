import { describe, expect, it } from "vitest";
import { getAdminConsoleRelativePath } from "@/lib/adminConsolePaths";

describe("getAdminConsoleRelativePath", () => {
  it("normalizes theall_manager_only and admin prefixes", () => {
    expect(getAdminConsoleRelativePath("/theall_manager_only/bookings/new")).toBe("/bookings/new");
    expect(getAdminConsoleRelativePath("/admin/bookings")).toBe("/bookings");
    expect(getAdminConsoleRelativePath("/theall_manager_only")).toBe("/");
  });

  it("returns null for non-admin paths", () => {
    expect(getAdminConsoleRelativePath("/mypage/bookings")).toBeNull();
  });
});

describe("bookings nav paths", () => {
  it("maps list and create under /bookings", () => {
    expect(getAdminConsoleRelativePath("/theall_manager_only/bookings")?.startsWith("/bookings")).toBe(true);
    expect(getAdminConsoleRelativePath("/theall_manager_only/bookings/new")).toBe("/bookings/new");
  });
});
