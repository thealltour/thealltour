import { describe, expect, it } from "vitest";
import {
  affiliateCountryEnglishLabel,
  hasAffiliateCityAlias,
  resolveAffiliateCanonicalDestination,
} from "@/lib/affiliate/planner/destinationCanonical";
import { PLANNER_POPULAR_DESTINATIONS } from "@/lib/planner/constants";

describe("affiliateCountryEnglishLabel", () => {
  it("ISO → display-cased English country", () => {
    expect(affiliateCountryEnglishLabel("JP")).toBe("Japan");
    expect(affiliateCountryEnglishLabel("KR")).toBe("South Korea");
    expect(affiliateCountryEnglishLabel("VN")).toBe("Vietnam");
    expect(affiliateCountryEnglishLabel("TH")).toBe("Thailand");
    expect(affiliateCountryEnglishLabel("BA")).toBe("Bosnia and Herzegovina");
    expect(affiliateCountryEnglishLabel("jp")).toBe("Japan");
  });

  it("unknown / invalid → null", () => {
    expect(affiliateCountryEnglishLabel(null)).toBeNull();
    expect(affiliateCountryEnglishLabel("")).toBeNull();
    expect(affiliateCountryEnglishLabel("XX")).toBeNull();
    expect(affiliateCountryEnglishLabel("일본")).toBeNull();
  });
});

describe("resolveAffiliateCanonicalDestination", () => {
  it("오사카 + JP → Osaka, Japan (display text unchanged)", () => {
    expect(resolveAffiliateCanonicalDestination({ text: "오사카", countryCode: "JP" })).toEqual({
      displayText: "오사카",
      searchText: "Osaka, Japan",
      cityEnglish: "Osaka",
      countryCode: "JP",
      countryEnglish: "Japan",
    });
  });

  it("trims and ignores inner whitespace in the alias key", () => {
    const resolved = resolveAffiliateCanonicalDestination({ text: "  오 사카 ", countryCode: "JP" });
    expect(resolved.searchText).toBe("Osaka, Japan");
    expect(resolved.displayText).toBe("오 사카");
  });

  it("multi-word English city names", () => {
    expect(resolveAffiliateCanonicalDestination({ text: "다낭", countryCode: "VN" }).searchText).toBe(
      "Da Nang, Vietnam",
    );
  });

  it("alias without known country → city only (never infers the country)", () => {
    const resolved = resolveAffiliateCanonicalDestination({ text: "오사카", countryCode: null });
    expect(resolved.searchText).toBe("Osaka");
    expect(resolved.countryCode).toBeNull();
    expect(resolved.countryEnglish).toBeNull();
  });

  it("country mismatch → raw display text fallback", () => {
    const resolved = resolveAffiliateCanonicalDestination({ text: "오사카", countryCode: "US" });
    expect(resolved.searchText).toBe("오사카");
    expect(resolved.cityEnglish).toBeNull();
    expect(resolved.countryEnglish).toBe("United States");
  });

  it("unknown destination → raw display text fallback", () => {
    const resolved = resolveAffiliateCanonicalDestination({ text: "가와치나가노", countryCode: "JP" });
    expect(resolved).toEqual({
      displayText: "가와치나가노",
      searchText: "가와치나가노",
      cityEnglish: null,
      countryCode: "JP",
      countryEnglish: "Japan",
    });
  });

  it("covers every Planner popular destination preset", () => {
    for (const dest of PLANNER_POPULAR_DESTINATIONS) {
      expect(hasAffiliateCityAlias(dest.label), dest.label).toBe(true);
    }
  });
});
