import { describe, expect, it } from "vitest";
import {
  preferTotalPriceOverInstallment,
  stripInstallmentMetaText,
} from "@/lib/admin/externalImport/preferTotalPriceOverInstallment";

describe("preferTotalPriceOverInstallment", () => {
  const hana = [
    "성인 1인",
    "2,649,000원",
    "5개월 무이자 할부 예상가",
    "월 529,800원",
    "카드사별 무이자 혜택",
  ].join("\n");

  it("replaces 5-month installment monthly amount with adult total", () => {
    expect(preferTotalPriceOverInstallment(529_800, hana)).toBe(2_649_000);
  });

  it("keeps the adult total when AI already picked it", () => {
    expect(preferTotalPriceOverInstallment(2_649_000, hana)).toBe(2_649_000);
  });

  it("keeps ModeTour 예상가 when there is no installment copy", () => {
    const mode = ["예상가", "₩224,320", "2026.08.22(토) · 4박 6일 · 1인 기준"].join("\n");
    expect(preferTotalPriceOverInstallment(224_320, mode)).toBe(224_320);
  });

  it("strips installment lines from meta text", () => {
    const stripped = stripInstallmentMetaText(hana);
    expect(stripped).toContain("2,649,000원");
    expect(stripped).not.toMatch(/할부 예상가/);
    expect(stripped).not.toMatch(/월 529,800원/);
  });
});
