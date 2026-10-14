import { describe, expect, it } from "vitest";
import {
  buildStay22RoamUrl,
  isStay22RoamUrl,
  STAY22_PLANNER_HOTEL_CAMPAIGN,
  type Stay22RoamParams,
} from "@/lib/affiliate/planner/providers/stay22/stay22Url";

const TEST_AID = "test-aid";

function osaka(overrides?: Partial<Stay22RoamParams>): Stay22RoamParams {
  return {
    aid: TEST_AID,
    address: "오사카",
    checkin: "2027-01-28",
    checkout: "2027-02-01",
    adults: 3,
    children: 0,
    campaign: STAY22_PLANNER_HOTEL_CAMPAIGN,
    ...overrides,
  };
}

function built(overrides?: Partial<Stay22RoamParams>): URL {
  const result = buildStay22RoamUrl(osaka(overrides));
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return new URL(result.url);
}

describe("buildStay22RoamUrl", () => {
  it("Osaka fixed trip → exact roam URL with trip params", () => {
    const url = built();
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.stay22.com");
    expect(url.pathname).toBe("/allez/roam");
    expect(url.username).toBe("");
    expect(url.password).toBe("");
    expect(url.searchParams.get("aid")).toBe(TEST_AID);
    expect(url.searchParams.get("address")).toBe("오사카");
    expect(url.searchParams.get("checkin")).toBe("2027-01-28");
    expect(url.searchParams.get("checkout")).toBe("2027-02-01");
    expect(url.searchParams.get("adults")).toBe("3");
    expect(url.searchParams.get("campaign")).toBe("planner_hotel");
    expect([...url.searchParams.keys()]).toEqual([
      "aid",
      "address",
      "checkin",
      "checkout",
      "adults",
      "campaign",
    ]);
  });

  it("omits children when 0 and includes it when > 0", () => {
    expect(built().searchParams.has("children")).toBe(false);
    expect(built({ children: 2 }).searchParams.get("children")).toBe("2");
  });

  it("percent-encodes the Korean destination and never sends SDK push params", () => {
    const result = buildStay22RoamUrl(osaka());
    expect(result.ok).toBe(true);
    const raw = result.ok ? result.url : "";
    expect(raw).toContain(`address=${encodeURIComponent("오사카")}`);
    expect(raw).not.toContain("오사카");
    for (const key of ["source", "medium", "sid22", "infants"]) {
      expect(new URL(raw).searchParams.has(key)).toBe(false);
    }
  });

  it("keeps query-like destination text inside the address value", () => {
    const url = built({ address: "Osaka&aid=evil#x" });
    expect(url.searchParams.get("address")).toBe("Osaka&aid=evil#x");
    expect(url.searchParams.getAll("aid")).toEqual([TEST_AID]);
    expect(url.hash).toBe("");
    expect(url.hostname).toBe("www.stay22.com");
  });

  it("trims AID and address", () => {
    const url = built({ aid: `  ${TEST_AID}  `, address: "  오사카  " });
    expect(url.searchParams.get("aid")).toBe(TEST_AID);
    expect(url.searchParams.get("address")).toBe("오사카");
  });

  it.each([[""], ["   "], [null], [undefined]])("empty AID %s → config_missing", (aid) => {
    expect(buildStay22RoamUrl(osaka({ aid }))).toEqual({ ok: false, reason: "config_missing" });
  });

  it.each([[""], ["   "], [null]])("empty address %s → invalid_address", (address) => {
    expect(buildStay22RoamUrl(osaka({ address }))).toEqual({
      ok: false,
      reason: "invalid_address",
    });
  });

  it.each([
    [{ checkin: null }],
    [{ checkout: null }],
    [{ checkin: "2027/01/28" }],
    [{ checkout: "2027-02-30" }],
    [{ checkin: "2027-02-01", checkout: "2027-02-01" }],
    [{ checkin: "2027-02-02", checkout: "2027-02-01" }],
  ])("invalid or missing dates %j → invalid_dates", (dates) => {
    expect(buildStay22RoamUrl(osaka(dates))).toEqual({ ok: false, reason: "invalid_dates" });
  });

  it.each([[{ adults: 0 }], [{ adults: 1.5 }], [{ children: -1 }], [{ adults: 21 }]])(
    "invalid travelers %j → invalid_travelers",
    (travelers) => {
      expect(buildStay22RoamUrl(osaka(travelers))).toEqual({
        ok: false,
        reason: "invalid_travelers",
      });
    },
  );

  it("rejects high-cardinality / free-form campaign values", () => {
    expect(
      buildStay22RoamUrl(osaka({ campaign: "550e8400-e29b-41d4-a716-446655440000" })),
    ).toEqual({ ok: false, reason: "invalid_campaign" });
  });
});

describe("isStay22RoamUrl", () => {
  it("accepts only https://www.stay22.com/allez/roam without credentials", () => {
    expect(isStay22RoamUrl("https://www.stay22.com/allez/roam?aid=x")).toBe(true);
    expect(isStay22RoamUrl("http://www.stay22.com/allez/roam?aid=x")).toBe(false);
    expect(isStay22RoamUrl("https://stay22.com/allez/roam")).toBe(false);
    expect(isStay22RoamUrl("https://www.stay22.com.evil.example/allez/roam")).toBe(false);
    expect(isStay22RoamUrl("https://www.stay22.com/allez/booking")).toBe(false);
    expect(isStay22RoamUrl("https://www.stay22.com/allez/roam/extra")).toBe(false);
    expect(isStay22RoamUrl("https://user:pw@www.stay22.com/allez/roam")).toBe(false);
    expect(isStay22RoamUrl("https://www.stay22.com:8443/allez/roam")).toBe(false);
    expect(isStay22RoamUrl("not a url")).toBe(false);
  });
});
