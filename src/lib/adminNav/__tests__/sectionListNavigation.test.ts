import { describe, expect, it } from "vitest";
import {
  buildAdminGuidesHref,
  buildAdminNoticesHref,
  buildAdminProductEditHref,
  buildAdminProductsHref,
  buildAdminProductsListHref,
  buildAdminSectionHomeHref,
} from "@/lib/adminNav/sectionListNavigation";

describe("sectionListNavigation", () => {
  it("상품 목록 href는 view=list만 담는다", () => {
    expect(buildAdminProductsListHref()).toBe("/theall_manager_only/products?view=list");
    expect(buildAdminProductsHref(null)).toBe("/theall_manager_only/products");
    expect(buildAdminProductsHref("featured")).toBe("/theall_manager_only/products?view=featured");
  });

  it("상품 수정 href는 목록 URL에 editingId만 더한다", () => {
    expect(buildAdminProductEditHref("abc 1")).toBe(
      "/theall_manager_only/products?view=list&editingId=abc%201",
    );
  });

  it("공지·가이드 목록 href는 view만 담는다", () => {
    expect(buildAdminNoticesHref()).toBe("/theall_manager_only/notices?view=list");
    expect(buildAdminNoticesHref("create")).toBe("/theall_manager_only/notices?view=create");
    expect(buildAdminGuidesHref()).toBe("/theall_manager_only/guides?view=list");
    expect(buildAdminGuidesHref("notion")).toBe("/theall_manager_only/guides?view=notion");
  });

  it("사이드바 섹션 홈은 인페이지 에디터 섹션만 목록 URL로 바꾼다", () => {
    expect(buildAdminSectionHomeHref("product", "/theall_manager_only/products")).toBe(
      "/theall_manager_only/products?view=list",
    );
    expect(buildAdminSectionHomeHref("notices", "/theall_manager_only/notices")).toBe(
      "/theall_manager_only/notices?view=list",
    );
    expect(buildAdminSectionHomeHref("guides", "/theall_manager_only/guides")).toBe(
      "/theall_manager_only/guides?view=list",
    );
    expect(
      buildAdminSectionHomeHref("home", "/theall_manager_only/products?view=home-golf-tour-cards"),
    ).toBe("/theall_manager_only/products?view=home-golf-tour-cards");
    expect(buildAdminSectionHomeHref("inquiry", "/theall_manager_only/inquiries")).toBe(
      "/theall_manager_only/inquiries",
    );
  });
});
