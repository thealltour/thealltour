import { describe, expect, it } from "vitest";
import {
  buildAviasalesSearchUrl,
  selectAviasalesPriceOffer,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesSelector";
import type { AviasalesPriceOffer } from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";

function offer(partial: Partial<AviasalesPriceOffer> & { price: number; link: string }): AviasalesPriceOffer {
  return {
    origin: "ICN",
    destination: "OSA",
    originAirport: "ICN",
    destinationAirport: "KIX",
    airline: "KE",
    flightNumber: "1",
    departureAt: "2026-10-01T00:00:00Z",
    returnAt: null,
    transfers: 0,
    ...partial,
  };
}

describe("aviasalesSelector", () => {
  it("builds aviasales.com search URL from relative link", () => {
    const url = buildAviasalesSearchUrl("/search/ICN0110OSA1?t=abc");
    expect(url).toBe("https://www.aviasales.com/search/ICN0110OSA1?t=abc");
    expect(buildAviasalesSearchUrl("https://evil.com/x")).toBeNull();
    expect(buildAviasalesSearchUrl("//evil.com/search/x")).toBeNull();
  });

  it("selects lowest price with usable link", () => {
    const selection = selectAviasalesPriceOffer({
      offers: [
        offer({ price: 300, link: "/search/expensive", transfers: 0 }),
        offer({ price: 200, link: "/search/cheap", transfers: 1 }),
        offer({ price: 150, link: "not-a-path", transfers: 0 }),
      ],
    });
    expect(selection?.offer.price).toBe(200);
    expect(selection?.sourceUrl).toContain("www.aviasales.com/search/cheap");
  });

  it("returns null when no usable commerce link", () => {
    expect(
      selectAviasalesPriceOffer({
        offers: [offer({ price: 100, link: "/book/ticket" })],
      }),
    ).toBeNull();
  });
});
