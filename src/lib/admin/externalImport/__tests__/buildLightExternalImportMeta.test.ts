import { describe, expect, it } from "vitest";

import { buildLightExternalImportMeta } from "@/lib/admin/externalImport/buildLightExternalImportMeta";

describe("buildLightExternalImportMeta", () => {
  it("uses sourceProductTitle, meta description, duration, and calendar price", () => {
    const meta = buildLightExternalImportMeta({
      sourceProductTitle: "[하나투어] 오사카 3박4일",
      rawHtmlText: [
        "[meta description]",
        "오사카 핵심 관광",
        "",
        "3박 4일 패키지",
        "",
        "[가격 정보]",
        "성인 1인 1,649,000원",
      ].join("\n"),
      calendarMinPrice: 1649000,
    });

    expect(meta.title).toBe("[하나투어] 오사카 3박4일");
    expect(meta.description).toBe("오사카 핵심 관광");
    expect(meta.duration).toBe("3박 4일");
    expect(meta.price).toBe(1649000);
    expect(meta.status).toBe("AVAILABLE");
  });

  it("extracts price from booking sidebar text when calendar price is absent", () => {
    const meta = buildLightExternalImportMeta({
      sourceProductTitle: "테스트 상품",
      rawHtmlText: "[가격 정보]\n성인 1인 2,649,000원\n할부 예상가 월 88,300원",
    });

    expect(meta.price).toBe(2649000);
  });
});
