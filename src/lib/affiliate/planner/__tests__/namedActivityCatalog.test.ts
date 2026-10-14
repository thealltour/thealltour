import { describe, expect, it } from "vitest";
import {
  normalizeNamedActivityKey,
  resolveNamedActivity,
} from "@/lib/affiliate/planner/namedActivityCatalog";

const OSAKA = { text: "오사카", countryCode: "JP" };

describe("namedActivityCatalog (PR-9AJ)", () => {
  it.each([
    ["유니버설 스튜디오 재팬"],
    ["유니버설스튜디오재팬"],
    ["유니버셜 스튜디오 재팬"],
    ["Universal Studios Japan"],
    ["universal  studios   japan"],
    ["USJ"],
    ["usj"],
    ["  유니버설 스튜디오 재팬  "],
    ["Universal-Studios Japan"],
  ])("%s → universal_studios_japan", (placeName) => {
    expect(resolveNamedActivity({ placeName, destination: OSAKA })).toEqual({
      id: "universal_studios_japan",
      titleKo: "유니버설 스튜디오 재팬 입장권",
      countryCode: "JP",
      cityEnglish: "Osaka",
    });
  });

  it.each([
    ["Universal Studios Singapore"],
    ["Universal Studios Hollywood"],
    ["유니버설 스튜디오"],
    ["Universal Studios"],
    ["유니버설 스튜디오 재팬 근처 카페"],
    ["우메다 스카이 빌딩"],
    [""],
  ])("%s → no match (no fuzzy matching)", (placeName) => {
    expect(resolveNamedActivity({ placeName, destination: OSAKA })).toBeNull();
  });

  it("null/undefined place name → no match", () => {
    expect(resolveNamedActivity({ placeName: null, destination: OSAKA })).toBeNull();
    expect(resolveNamedActivity({ placeName: undefined, destination: OSAKA })).toBeNull();
  });

  it("country guard: USJ alias outside Japan never matches", () => {
    expect(
      resolveNamedActivity({ placeName: "USJ", destination: { text: "싱가포르", countryCode: "SG" } }),
    ).toBeNull();
    expect(
      resolveNamedActivity({
        placeName: "Universal Studios Japan",
        destination: { text: "Los Angeles", countryCode: "US" },
      }),
    ).toBeNull();
  });

  it("country guard: unknown country is never inferred → no match", () => {
    expect(
      resolveNamedActivity({ placeName: "유니버설 스튜디오 재팬", destination: { text: "오사카", countryCode: null } }),
    ).toBeNull();
  });

  it("JP trip based outside Osaka (Kansai day trip from Kyoto) still matches", () => {
    expect(
      resolveNamedActivity({ placeName: "유니버설 스튜디오 재팬", destination: { text: "교토", countryCode: "JP" } })
        ?.id,
    ).toBe("universal_studios_japan");
  });

  it("lowercase country code is accepted", () => {
    expect(
      resolveNamedActivity({ placeName: "USJ", destination: { text: "오사카", countryCode: "jp" } })?.id,
    ).toBe("universal_studios_japan");
  });

  it("normalization collapses spacing/punctuation only", () => {
    expect(normalizeNamedActivityKey(" Universal · Studios・Japan ")).toBe("universalstudiosjapan");
    expect(normalizeNamedActivityKey("ＵＳＪ")).toBe("usj");
    expect(normalizeNamedActivityKey("유니버설 스튜디오 재팬 (USJ)")).toBe("유니버설스튜디오재팬usj");
    expect(normalizeNamedActivityKey("유니버설 스튜디오 재팬（USJ）")).toBe("유니버설스튜디오재팬usj");
  });
});

describe("namedActivityCatalog name + code combinations (PR-9AK)", () => {
  it.each([
    ["유니버설 스튜디오 재팬 (USJ)"],
    ["유니버설 스튜디오 재팬 USJ"],
    ["USJ 유니버설 스튜디오 재팬"],
    ["유니버셜 스튜디오 재팬 (USJ)"],
    ["유니버설스튜디오재팬(USJ)"],
    ["Universal Studios Japan (USJ)"],
    ["USJ Universal Studios Japan"],
    ["Universal Studios Japan [USJ]"],
    ["유니버설 스튜디오 재팬（USJ）"],
  ])("%s → universal_studios_japan", (placeName) => {
    expect(resolveNamedActivity({ placeName, destination: OSAKA })?.id).toBe("universal_studios_japan");
  });

  it.each([
    ["Universal Studios Singapore"],
    ["USS"],
    ["Universal Studios Hollywood"],
    ["Universal Studios Beijing"],
    ["Universal Studios Beijing USJ"],
    ["USJ Singapore"],
    ["USJ Hollywood"],
    ["universal studios"],
    ["universal studios USJ"],
    ["USJ USJ"],
    ["유니버설 스튜디오 재팬 USJ 입장"],
    ["Universal Studios Japan Universal Studios Japan"],
    ["유니버설 스튜디오 재팬 (USJ) 근처 맛집"],
  ])("%s → no match (only name, code, name+code, code+name)", (placeName) => {
    expect(resolveNamedActivity({ placeName, destination: OSAKA })).toBeNull();
  });

  it.each([
    [null],
    ["SG"],
    ["US"],
    ["CN"],
  ])("country %s → combined variant never matches", (countryCode) => {
    for (const placeName of ["유니버설 스튜디오 재팬 (USJ)", "USJ Universal Studios Japan"]) {
      expect(resolveNamedActivity({ placeName, destination: { text: "여행지", countryCode } })).toBeNull();
    }
  });
});
