import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "@/lib/auth/redirect";

describe("sanitizeNextPath", () => {
  it("allows internal paths", () => {
    expect(sanitizeNextPath("/mypage")).toBe("/mypage");
    expect(sanitizeNextPath("/products?q=golf")).toBe("/products?q=golf");
  });

  it("blocks external and login loops", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/");
    expect(sanitizeNextPath("//evil.com")).toBe("/");
    expect(sanitizeNextPath("/login")).toBe("/");
    expect(sanitizeNextPath("/signup")).toBe("/");
  });

  it("uses fallback for empty", () => {
    expect(sanitizeNextPath("", "/mypage")).toBe("/mypage");
  });
});
