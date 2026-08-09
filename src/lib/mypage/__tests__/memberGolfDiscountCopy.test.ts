import { describe, expect, it } from "vitest";
import { getMemberGolfDiscountCopy } from "@/lib/mypage/memberGolfDiscountCopy";

describe("getMemberGolfDiscountCopy", () => {
  it("returns welcome 5만 copy when no previous booking", () => {
    const copy = getMemberGolfDiscountCopy(false);
    expect(copy.tier).toBe("WELCOME");
    expect(copy.unitAmount).toBe(50_000);
    expect(copy.headline).toBe("1인당 5만원 할인");
    expect(copy.subline).toContain("인원만큼");
    expect(copy.badgeLabel).toBe("골프투어 혜택");
  });

  it("returns returning 3만 copy when has previous booking", () => {
    const copy = getMemberGolfDiscountCopy(true);
    expect(copy.tier).toBe("RETURNING");
    expect(copy.unitAmount).toBe(30_000);
    expect(copy.headline).toBe("1인당 3만원 할인");
  });
});
