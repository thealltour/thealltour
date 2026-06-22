import { describe, expect, it } from "vitest";
import { getAdminConsoleRelativePath, sanitizeAdminReturnTo } from "@/lib/adminConsolePaths";
import { parseAdminDeviceLabel } from "@/lib/adminDeviceLabel";
import {
  ADMIN_SESSION_COOKIE_MAX_AGE_SEC,
  ADMIN_SESSION_INACTIVITY_DAYS,
  getAdminSessionInactivityMs,
} from "@/lib/adminSessionPolicy";

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

describe("sanitizeAdminReturnTo", () => {
  it("allows manager console paths with query", () => {
    expect(sanitizeAdminReturnTo("/theall_manager_only/inquiries?id=1")).toBe(
      "/theall_manager_only/inquiries?id=1",
    );
    expect(sanitizeAdminReturnTo("/theall_manager_only")).toBe("/theall_manager_only");
  });

  it("rejects login and external paths", () => {
    expect(sanitizeAdminReturnTo("/theall_manager_only/login")).toBeNull();
    expect(sanitizeAdminReturnTo("https://evil.example/phish")).toBeNull();
    expect(sanitizeAdminReturnTo("/products/1")).toBeNull();
    expect(sanitizeAdminReturnTo("//evil.example")).toBeNull();
  });
});

describe("parseAdminDeviceLabel", () => {
  it("maps common user agents", () => {
    expect(parseAdminDeviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iPhone");
    expect(parseAdminDeviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
  });
});

describe("adminSessionPolicy", () => {
  it("uses 7-day inactivity and 30-day cookie cap", () => {
    expect(ADMIN_SESSION_INACTIVITY_DAYS).toBe(7);
    expect(getAdminSessionInactivityMs()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(ADMIN_SESSION_COOKIE_MAX_AGE_SEC).toBe(30 * 24 * 60 * 60);
  });
});
