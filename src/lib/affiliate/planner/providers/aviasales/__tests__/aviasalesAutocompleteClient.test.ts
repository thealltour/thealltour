import { describe, expect, it, vi } from "vitest";
import {
  fetchAviasalesAutocomplete,
  isValidIataCode,
  parseAutocompletePlace,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";
import { pickBestPlace } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";

describe("aviasalesAutocompleteClient", () => {
  it("validates IATA as exactly 3 letters", () => {
    expect(isValidIataCode("OSA")).toBe(true);
    expect(isValidIataCode("osa")).toBe(true);
    expect(isValidIataCode("OS")).toBe(false);
    expect(isValidIataCode("OSAA")).toBe(false);
    expect(isValidIataCode("123")).toBe(false);
  });

  it("parses places2 rows and skips malformed", () => {
    expect(
      parseAutocompletePlace({
        type: "city",
        code: "OSA",
        name: "오사카",
        country_code: "JP",
        weight: 20491,
      }),
    ).toEqual({
      type: "city",
      code: "OSA",
      name: "오사카",
      countryCode: "JP",
      cityCode: null,
      cityName: null,
      weight: 20491,
    });

    expect(
      parseAutocompletePlace({
        type: "airport",
        code: "KIX",
        name: "Kansai",
        country_code: "JP",
        city_code: "OSA",
        city_name: "오사카",
        weight: 100,
      })?.cityCode,
    ).toBe("OSA");

    expect(parseAutocompletePlace({ type: "city", code: "XX", name: "Bad" })).toBeNull();
    expect(parseAutocompletePlace({ type: "region", code: "OSA", name: "x" })).toBeNull();
  });

  it("fetches autocomplete and prefers city ranking", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            type: "airport",
            code: "KIX",
            name: "Kansai",
            country_code: "JP",
            city_code: "OSA",
            city_name: "오사카",
            weight: 99999,
          },
          {
            type: "city",
            code: "OSA",
            name: "오사카",
            country_code: "JP",
            weight: 100,
          },
        ]),
        { status: 200 },
      ),
    );

    const result = await fetchAviasalesAutocomplete({
      term: "오사카",
      locale: "ko",
      deps: { fetchImpl: fetchImpl as never, cache: createMemoryAviasalesCache() },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    const best = pickBestPlace(result.data, { query: "오사카", countryCode: "JP" });
    expect(best?.type).toBe("city");
    expect(best?.code).toBe("OSA");
  });

  it("falls back on http error", async () => {
    const result = await fetchAviasalesAutocomplete({
      term: "Osaka",
      locale: "en",
      deps: {
        fetchImpl: (async () => new Response("nope", { status: 500 })) as never,
        cache: createMemoryAviasalesCache(),
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("http_error");
  });

  it("country boost and stable code tie-break", () => {
    const a = parseAutocompletePlace({
      type: "city",
      code: "ABC",
      name: "Alpha",
      country_code: "US",
      weight: 10,
    })!;
    const b = parseAutocompletePlace({
      type: "city",
      code: "XYZ",
      name: "Alpha",
      country_code: "JP",
      weight: 10,
    })!;
    expect(pickBestPlace([a, b], { query: "Alpha", countryCode: "JP" })?.code).toBe("XYZ");

    const c = parseAutocompletePlace({
      type: "city",
      code: "AAA",
      name: "Same",
      country_code: "JP",
      weight: 10,
    })!;
    const d = parseAutocompletePlace({
      type: "city",
      code: "BBB",
      name: "Same",
      country_code: "JP",
      weight: 10,
    })!;
    expect(pickBestPlace([d, c], { query: "Same", countryCode: "JP" })?.code).toBe("AAA");
  });
});
