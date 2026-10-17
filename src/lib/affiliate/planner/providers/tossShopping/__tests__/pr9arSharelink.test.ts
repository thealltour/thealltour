import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetTossShoppingCacheForTests,
  createMemoryTossShoppingCache,
  tossSharelinkCacheKey,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCache";
import {
  createOrReuseTossSharelink,
  validateTossSharelinkUrl,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingClient";

afterEach(() => {
  __resetTossShoppingCacheForTests();
  vi.restoreAllMocks();
});

describe("PR-9AR Toss Sharelink URL validation", () => {
  it("allows toss.shopping https", () => {
    expect(validateTossSharelinkUrl("https://toss.shopping/t/123?k=abc")).toContain(
      "toss.shopping",
    );
  });

  it("rejects http", () => {
    expect(validateTossSharelinkUrl("http://toss.shopping/t/1")).toBeNull();
  });

  it("rejects unexpected hosts", () => {
    expect(validateTossSharelinkUrl("https://evil.example/x")).toBeNull();
    expect(validateTossSharelinkUrl("https://toss.im/_m/abc")).toBeNull();
  });

  it("rejects credentials in URL", () => {
    expect(validateTossSharelinkUrl("https://user:pass@toss.shopping/t/1")).toBeNull();
  });
});

describe("PR-9AR Toss Sharelink client", () => {
  it("posts /v1/sharelinks with tacaItemId only and caches reuse", async () => {
    const cache = createMemoryTossShoppingCache();
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          shortUrl: "https://toss.shopping/_m/abcDE",
          originUrl: "https://toss.shopping/t/1?k=x&referrer=affiliate",
          targetUrl: "https://toss.shopping/_m/abcDE",
        }),
        { status: 200 },
      ),
    );

    const deps = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache,
      proxySecret: "proxy_secret",
      proxyBaseUrl: "https://proxy.test",
    };

    const first = await createOrReuseTossSharelink(991122, deps);
    expect(first?.targetUrl).toBe("https://toss.shopping/_m/abcDE");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://proxy.test/v1/sharelinks");
    expect(call[1]?.method).toBe("POST");
    const body = JSON.parse(String(call[1]?.body));
    expect(body).toEqual({ tacaItemId: 991122 });
    expect(body).not.toHaveProperty("publisherId");
    expect(body).not.toHaveProperty("landingType");
    expect(call[1]?.headers).toMatchObject({
      Authorization: "Bearer proxy_secret",
    });

    const second = await createOrReuseTossSharelink(991122, deps);
    expect(second?.targetUrl).toBe("https://toss.shopping/_m/abcDE");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(tossSharelinkCacheKey(991122)).toBe("sharelink:v2:991122");
  });

  it("cache key is publisher-independent", () => {
    expect(tossSharelinkCacheKey(1)).toBe("sharelink:v2:1");
    expect(tossSharelinkCacheKey(1)).not.toContain("publisher");
  });

  it("failure → null", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await createOrReuseTossSharelink(1, {
      proxySecret: "proxy_secret",
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      proxyBaseUrl: "https://proxy.test",
    });
    expect(result).toBeNull();
  });

  it("missing proxy secret → null without network", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const result = await createOrReuseTossSharelink(1, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: {} as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unexpected sharelink host from proxy", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await createOrReuseTossSharelink(1, {
      proxySecret: "proxy_secret",
      proxyBaseUrl: "https://proxy.test",
      cache: createMemoryTossShoppingCache(),
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            shortUrl: "https://evil.example/x",
            originUrl: "https://evil.example/y",
            targetUrl: "https://evil.example/z",
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch,
    });
    expect(result).toBeNull();
  });
});
