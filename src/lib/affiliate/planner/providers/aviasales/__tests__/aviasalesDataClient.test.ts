import { describe, expect, it, vi } from "vitest";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  fetchAviasalesPricesForDates,
  parsePriceOffer,
  parsePricesForDatesResponse,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesDataClient";

const SAMPLE = {
  success: true,
  data: [
    {
      origin: "ICN",
      destination: "OSA",
      origin_airport: "ICN",
      destination_airport: "KIX",
      price: 220,
      airline: "KE",
      flight_number: "721",
      departure_at: "2026-10-01T09:00:00+09:00",
      return_at: "2026-10-05T18:00:00+09:00",
      transfers: 0,
      link: "/search/ICN0110OSA05101?t=demo&expected_price_currency=usd",
    },
  ],
  currency: "usd",
};

describe("aviasalesDataClient", () => {
  it("parses documented prices_for_dates schema", () => {
    const parsed = parsePricesForDatesResponse(SAMPLE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data[0]).toMatchObject({
      origin: "ICN",
      destination: "OSA",
      price: 220,
      link: expect.stringMatching(/^\/search\//),
    });
  });

  it("skips malformed price rows", () => {
    expect(parsePriceOffer({ origin: "ICN", destination: "OSA", price: 1 })).toBeNull();
    expect(
      parsePriceOffer({
        origin: "IC",
        destination: "OSA",
        price: 1,
        link: "/search/x",
      }),
    ).toBeNull();
  });

  it("refuses price API without origin IATA", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchAviasalesPricesForDates({
      origin: "",
      destination: "OSA",
      departureAt: "2026-10-01",
      deps: {
        fetchImpl: fetchImpl as never,
        cache: createMemoryAviasalesCache(),
        getApiToken: () => "tok",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("missing_origin");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("calls prices_for_dates with token and caches", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo) => {
      seen.push(String(input));
      return new Response(JSON.stringify(SAMPLE), { status: 200 });
    });
    const cache = createMemoryAviasalesCache();
    const first = await fetchAviasalesPricesForDates({
      origin: "ICN",
      destination: "OSA",
      departureAt: "2026-10-01",
      returnAt: "2026-10-05",
      oneWay: false,
      deps: {
        fetchImpl: fetchImpl as never,
        cache,
        getApiToken: () => "test-token",
      },
    });
    expect(first.ok).toBe(true);
    expect(seen[0]).toContain("/aviasales/v3/prices_for_dates");
    expect(seen[0]).toContain("origin=ICN");
    expect(seen[0]).toContain("destination=OSA");
    expect(seen[0]).toContain("currency=usd");
    expect(seen[0]).toContain("token=test-token");
    const second = await fetchAviasalesPricesForDates({
      origin: "ICN",
      destination: "OSA",
      departureAt: "2026-10-01",
      returnAt: "2026-10-05",
      oneWay: false,
      deps: {
        fetchImpl: fetchImpl as never,
        cache,
        getApiToken: () => "test-token",
      },
    });
    expect(second.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns config_missing when token absent", async () => {
    const result = await fetchAviasalesPricesForDates({
      origin: "ICN",
      destination: "OSA",
      departureAt: "2026-10-01",
      deps: {
        fetchImpl: vi.fn() as never,
        cache: createMemoryAviasalesCache(),
        getApiToken: () => null,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("config_missing");
  });
});
