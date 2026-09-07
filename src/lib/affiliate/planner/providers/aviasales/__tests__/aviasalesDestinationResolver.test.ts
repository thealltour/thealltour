import { describe, expect, it, vi } from "vitest";
import { createMemoryAviasalesCache } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";
import {
  resolveAviasalesDestinationIata,
  toResolvedIata,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import { parseAutocompletePlace } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";

describe("aviasalesDestinationResolver", () => {
  it("maps airport city_code to city IATA", () => {
    const airport = parseAutocompletePlace({
      type: "airport",
      code: "KIX",
      name: "Kansai",
      country_code: "JP",
      city_code: "OSA",
      city_name: "Osaka",
      weight: 10,
    })!;
    const resolved = toResolvedIata(airport);
    expect(resolved.iata).toBe("OSA");
    expect(resolved.sourceCode).toBe("KIX");
  });

  it("resolves via ko then en without hardcoding Osaka→OSA", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.includes("locale=ko")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(
        JSON.stringify([
          { type: "city", code: "OSA", name: "Osaka", country_code: "JP", weight: 100 },
        ]),
        { status: 200 },
      );
    });

    const resolved = await resolveAviasalesDestinationIata({
      destinationText: "Osaka",
      countryCode: "JP",
      deps: {
        fetchImpl: fetchImpl as never,
        cache: createMemoryAviasalesCache(),
      },
    });
    expect(resolved?.iata).toBe("OSA");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("negative-caches empty results briefly", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    const cache = createMemoryAviasalesCache();
    const first = await resolveAviasalesDestinationIata({
      destinationText: "zzzznotacity",
      deps: { fetchImpl: fetchImpl as never, cache },
    });
    expect(first).toBeNull();
    const second = await resolveAviasalesDestinationIata({
      destinationText: "zzzznotacity",
      deps: { fetchImpl: fetchImpl as never, cache },
    });
    expect(second).toBeNull();
    // ko + en on first miss; negatives skip network on second pass for both locales.
    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
