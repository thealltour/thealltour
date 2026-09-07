import { describe, expect, it, vi } from "vitest";
import {
  fetchWeGoTripPopularProducts,
  searchWeGoTrip,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripClient";
import { createMemoryWeGoTripCache } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripCache";

describe("weGoTripClient", () => {
  it("parses search cities", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              results: [
                {
                  id: 1853909,
                  name: "Osaka",
                  slug: "osaka",
                  available: true,
                  type: "city",
                  country: { id: 1, name: "Japan", slug: "japan" },
                },
                { id: 99, name: "X", slug: "x", type: "attraction" },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    const result = await searchWeGoTrip({
      query: "Osak",
      deps: { fetchImpl: fetchImpl as never, cache: createMemoryWeGoTripCache() },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.cities).toHaveLength(1);
      expect(result.data.cities[0]?.id).toBe(1853909);
    }
  });

  it("rejects short query", async () => {
    const result = await searchWeGoTrip({ query: "Os" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("query_too_short");
  });

  it("handles non-2xx and timeout", async () => {
    const http = await searchWeGoTrip({
      query: "Paris",
      deps: {
        fetchImpl: (async () => new Response("no", { status: 500 })) as never,
      },
    });
    expect(http.ok).toBe(false);

    const timeout = await searchWeGoTrip({
      query: "Paris",
      deps: {
        timeoutMs: 20,
        fetchImpl: ((_, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) return;
            if (signal.aborted) {
              reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
              return;
            }
            signal.addEventListener("abort", () => {
              reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
            });
          })) as never,
      },
    });
    expect(timeout.ok).toBe(false);
    if (!timeout.ok) expect(timeout.errorCode).toBe("timeout");
  });

  it("parses popular products and caches", async () => {
    const cache = createMemoryWeGoTripCache();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              results: [
                {
                  id: 10677,
                  title: "Osaka tour",
                  slug: "osaka-tour",
                  available: true,
                  rating: 4,
                  reviewsCount: 1,
                  category: "History",
                  city: { id: 1853909, name: "Osaka", slug: "osaka" },
                },
              ],
            },
          }),
          { status: 200 },
        ),
    );
    const first = await fetchWeGoTripPopularProducts({
      cityId: 1853909,
      lang: "en",
      currency: "USD",
      deps: { fetchImpl: fetchImpl as never, cache },
    });
    const second = await fetchWeGoTripPopularProducts({
      cityId: 1853909,
      lang: "en",
      currency: "USD",
      deps: { fetchImpl: fetchImpl as never, cache },
    });
    expect(first.ok && second.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed product response rows", async () => {
    const result = await fetchWeGoTripPopularProducts({
      cityId: 1,
      lang: "en",
      currency: "USD",
      deps: {
        cache: createMemoryWeGoTripCache(),
        fetchImpl: (async () =>
          new Response(JSON.stringify({ data: { results: [{ id: 1 }] } }), {
            status: 200,
          })) as never,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });
});
