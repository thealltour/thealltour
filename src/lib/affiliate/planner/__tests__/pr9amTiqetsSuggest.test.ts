import { afterEach, describe, expect, it, vi } from "vitest";
import { matchTiqetsCandidate } from "@/lib/affiliate/planner/providers/tiqets/tiqetsCandidateMatcher";
import {
  createTiqetsSuggestCache,
  parseTiqetsSuggestResponse,
  searchTiqetsSuggest,
  TIQETS_SUGGEST_NEGATIVE_TTL_MS,
  TIQETS_SUGGEST_POSITIVE_TTL_MS,
  type TiqetsSuggestClientDeps,
} from "@/lib/affiliate/planner/providers/tiqets/tiqetsSuggestClient";

const ON = { ENABLE_PLANNER_AFFILIATE_TIQETS_SUGGEST: "true" };
const SCOPE = "JP|Osaka";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deps(fetchImpl: typeof fetch, extra: Partial<TiqetsSuggestClientDeps> = {}) {
  return {
    fetchImpl,
    cache: createTiqetsSuggestCache(),
    env: ON,
    now: () => 1_000_000,
    ...extra,
  } satisfies TiqetsSuggestClientDeps;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PR-9AM Tiqets suggest client", () => {
  it("valid response → parsed candidates; request uses service=tiqets&locale=en&term", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([{ title: "Universal Studios Japan: 1, 1.5, or 2-Day Pass", value: "1102887" }]),
    );
    const result = await searchTiqetsSuggest({
      term: "Universal Studios Japan",
      destinationScope: SCOPE,
      deps: deps(fetchImpl as unknown as typeof fetch),
    });
    expect(result).toEqual({
      outcome: "fetched",
      candidates: [{ productId: "1102887", title: "Universal Studios Japan: 1, 1.5, or 2-Day Pass" }],
    });
    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(`${url.origin}${url.pathname}`).toBe("https://suggest.travelpayouts.com/search");
    expect(url.searchParams.get("service")).toBe("tiqets");
    expect(url.searchParams.get("locale")).toBe("en");
    expect(url.searchParams.get("term")).toBe("Universal Studios Japan");
  });

  it("number and string values → normalized string product IDs; invalid ids skipped", () => {
    expect(
      parseTiqetsSuggestResponse([
        { title: "A", value: 1102887 },
        { title: "B", value: " 1108257 " },
        { title: "C", value: "abc" },
        { title: "D", value: -5 },
        { title: "E", value: 1.5 },
        { title: "F", value: "0123" },
      ]),
    ).toEqual([
      { productId: "1102887", title: "A" },
      { productId: "1108257", title: "B" },
    ]);
  });

  it("invalid schema → []", async () => {
    expect(parseTiqetsSuggestResponse({ title: "x", value: "1" })).toEqual([]);
    expect(parseTiqetsSuggestResponse([{ name: "x", id: 1 }, null, "x"])).toEqual([]);
    const result = await searchTiqetsSuggest({
      term: "Osaka Castle",
      destinationScope: SCOPE,
      deps: deps(vi.fn(async () => jsonResponse({ data: [] })) as unknown as typeof fetch),
    });
    expect(result.candidates).toEqual([]);
  });

  it("HTML response → [] and the raw body is never logged", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(
      async () =>
        new Response("<html>secret-ish page Osaka Castle</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
    );
    const result = await searchTiqetsSuggest({
      term: "Osaka Castle",
      destinationScope: SCOPE,
      deps: deps(fetchImpl as unknown as typeof fetch),
    });
    expect(result).toEqual({ candidates: [], outcome: "error" });
    const logged = JSON.stringify(info.mock.calls);
    expect(logged).toContain("invalid_response");
    expect(logged).not.toContain("<html>");
    expect(logged).not.toContain("Osaka Castle");
  });

  it.each([429, 403, 500])("HTTP %s → []", async (status) => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await searchTiqetsSuggest({
      term: "Osaka Castle",
      destinationScope: SCOPE,
      deps: deps(vi.fn(async () => jsonResponse({ error: "x" }, status)) as unknown as typeof fetch),
    });
    expect(result).toEqual({ candidates: [], outcome: "error" });
  });

  it("timeout → [] (request aborted)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    const result = await searchTiqetsSuggest({
      term: "Osaka Castle",
      destinationScope: SCOPE,
      deps: deps(fetchImpl as unknown as typeof fetch, { timeoutMs: 5 }),
    });
    expect(result).toEqual({ candidates: [], outcome: "error" });
    expect(JSON.stringify(info.mock.calls)).toContain("timeout");
  });

  it("network error → []", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const result = await searchTiqetsSuggest({
      term: "Osaka Castle",
      destinationScope: SCOPE,
      deps: deps(fetchImpl as unknown as typeof fetch),
    });
    expect(result).toEqual({ candidates: [], outcome: "error" });
  });

  it("feature flag OFF (default or explicit) → no fetch", async () => {
    const fetchImpl = vi.fn();
    for (const env of [{}, { ENABLE_PLANNER_AFFILIATE_TIQETS_SUGGEST: "false" }]) {
      const result = await searchTiqetsSuggest({
        term: "Osaka Castle",
        destinationScope: SCOPE,
        deps: deps(fetchImpl as unknown as typeof fetch, { env }),
      });
      expect(result).toEqual({ candidates: [], outcome: "disabled" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("cache hit → no second fetch; cache is destination-scoped; positive TTL expires", async () => {
    let now = 1_000_000;
    const fetchImpl = vi.fn(async () => jsonResponse([{ title: "Osaka Castle Museum", value: 1108257 }]));
    const shared = deps(fetchImpl as unknown as typeof fetch, { now: () => now });

    const first = await searchTiqetsSuggest({ term: "Osaka Castle", destinationScope: SCOPE, deps: shared });
    const second = await searchTiqetsSuggest({ term: " osaka  castle ", destinationScope: SCOPE, deps: shared });
    expect(first.outcome).toBe("fetched");
    expect(second).toEqual({ candidates: first.candidates, outcome: "cache_hit" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await searchTiqetsSuggest({ term: "Osaka Castle", destinationScope: "SG|Singapore", deps: shared });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    now += TIQETS_SUGGEST_POSITIVE_TTL_MS + 1;
    await searchTiqetsSuggest({ term: "Osaka Castle", destinationScope: SCOPE, deps: shared });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("negative cache → repeated misses do not refetch until the negative TTL", async () => {
    let now = 1_000_000;
    const fetchImpl = vi.fn(async () => jsonResponse([]));
    const shared = deps(fetchImpl as unknown as typeof fetch, { now: () => now });

    await searchTiqetsSuggest({ term: "Nowhere", destinationScope: SCOPE, deps: shared });
    const again = await searchTiqetsSuggest({ term: "Nowhere", destinationScope: SCOPE, deps: shared });
    expect(again).toEqual({ candidates: [], outcome: "cache_hit" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    now += TIQETS_SUGGEST_NEGATIVE_TTL_MS + 1;
    await searchTiqetsSuggest({ term: "Nowhere", destinationScope: SCOPE, deps: shared });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("errors are cached briefly so a failing endpoint is not hammered", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503));
    const shared = deps(fetchImpl as unknown as typeof fetch);
    await searchTiqetsSuggest({ term: "Osaka Castle", destinationScope: SCOPE, deps: shared });
    await searchTiqetsSuggest({ term: "Osaka Castle", destinationScope: SCOPE, deps: shared });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("bounded cache evicts the oldest entry", () => {
    const cache = createTiqetsSuggestCache(2);
    cache.set("a", [], 1_000, 0);
    cache.set("b", [], 1_000, 0);
    cache.set("c", [], 1_000, 0);
    expect(cache.size()).toBe(2);
    expect(cache.get("a", 1)).toBeNull();
    expect(cache.get("c", 1)).toEqual([]);
  });
});

describe("PR-9AM Tiqets candidate matcher", () => {
  it("Universal Studios Japan → product pass, never the bus/transfer products", () => {
    const match = matchTiqetsCandidate({
      query: "Universal Studios Japan",
      candidates: [
        { productId: "2", title: "Osaka Dotonbori - Universal Studio Japan Bus" },
        { productId: "3", title: "Osaka: Bus Transfer from Universal Studios Japan to Dotonbori" },
        { productId: "1102887", title: "Universal Studios Japan: 1, 1.5, or 2-Day Pass" },
      ],
    });
    expect(match).toEqual({
      productId: "1102887",
      title: "Universal Studios Japan: 1, 1.5, or 2-Day Pass",
      matchConfidence: "exact",
    });
  });

  it("Osaka Castle → 'Osaka Castle Museum: Entry Ticket' (high)", () => {
    expect(
      matchTiqetsCandidate({
        query: "Osaka Castle",
        candidates: [{ productId: "1108257", title: "Osaka Castle Museum: Entry Ticket" }],
      }),
    ).toEqual({ productId: "1108257", title: "Osaka Castle Museum: Entry Ticket", matchConfidence: "high" });
  });

  it("transport-only candidates → null", () => {
    expect(
      matchTiqetsCandidate({
        query: "Osaka Castle",
        candidates: [
          { productId: "9", title: "Osaka Castle Bus Transfer" },
          { productId: "8", title: "Osaka Castle: Hotel Pickup Shuttle" },
        ],
      }),
    ).toBeNull();
  });

  it("weak or unrelated candidates → null", () => {
    expect(
      matchTiqetsCandidate({
        query: "Osaka Castle",
        candidates: [
          { productId: "1", title: "Osaka Castle Museum" },
          { productId: "2", title: "Osaka Castle Park and Nishinomaru Garden Walking Tour: Ticket" },
          { productId: "3", title: "Kyoto: Fushimi Inari Entry Ticket" },
          { productId: "4", title: "Osaka Amazing Pass" },
        ],
      }),
    ).toBeNull();
    expect(matchTiqetsCandidate({ query: "오사카성", candidates: [{ productId: "1", title: "Osaka Castle" }] }))
      .toBeNull();
    expect(matchTiqetsCandidate({ query: "AB", candidates: [{ productId: "1", title: "AB" }] })).toBeNull();
  });
});
