import { describe, expect, it } from "vitest";
import { isSidebarMainKeyActive } from "@/components/admin/sidebarUtils";

describe("isSidebarMainKeyActive", () => {
  it("highlights only the matching main key", () => {
    expect(isSidebarMainKeyActive("home", "home")).toBe(true);
    expect(isSidebarMainKeyActive("product", "home")).toBe(false);
  });

  it("separates product and home when they share /products pathname", () => {
    expect(isSidebarMainKeyActive("product", "product")).toBe(true);
    expect(isSidebarMainKeyActive("home", "product")).toBe(false);
    expect(isSidebarMainKeyActive("home", "home")).toBe(true);
    expect(isSidebarMainKeyActive("product", "home")).toBe(false);
  });

  it("returns false when activeMenu is null", () => {
    expect(isSidebarMainKeyActive("product", null)).toBe(false);
    expect(isSidebarMainKeyActive("home", null)).toBe(false);
  });
});
