import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrReuseTossSharelink,
  fetchTossCategoryBest,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingClient";
import { createMemoryTossShoppingCache } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCache";
import { TOSS_SHOPPING_PROXY_BASE_URL } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PR-9AR Toss proxy authentication", () => {
  it("sends Authorization Bearer with THEALLTOUR_PROXY_SECRET (no OAuth)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchTossCategoryBest(20037, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: { THEALLTOUR_PROXY_SECRET: "proxy_secret_value" } as unknown as NodeJS.ProcessEnv,
      proxyBaseUrl: "https://proxy.test",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proxy.test/v1/category-best/20037?size=10");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer proxy_secret_value",
    });
    expect(url).not.toContain("oauth2.cert.toss.im");
    expect(url).not.toContain("sharelink.toss.im");
  });

  it("missing proxy secret → fail-soft without network", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const products = await fetchTossCategoryBest(20037, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: {} as unknown as NodeJS.ProcessEnv,
    });
    expect(products).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not read Toss ACCESS/SECRET/PUBLISHER env keys", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    await fetchTossCategoryBest(20037, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: {
        THEALLTOUR_PROXY_SECRET: "proxy_only",
        TOSS_SHARELINK_ACCESS_KEY: "should_not_be_used",
        TOSS_SHARELINK_SECRET_KEY: "should_not_be_used",
        TOSS_SHARELINK_PUBLISHER_ID: "should_not_be_used",
      } as unknown as NodeJS.ProcessEnv,
      proxyBaseUrl: "https://proxy.test",
    });
    const dumped = JSON.stringify(fetchImpl.mock.calls);
    expect(dumped).not.toContain("should_not_be_used");
    expect(dumped).not.toContain("oauth2");
    expect(dumped).toContain("Bearer proxy_only");
  });

  it("never logs proxy secret values", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await fetchTossCategoryBest(20037, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: {
        THEALLTOUR_PROXY_SECRET: "super_secret_proxy",
      } as unknown as NodeJS.ProcessEnv,
      proxyBaseUrl: "https://proxy.test",
    });
    const dumped = JSON.stringify(info.mock.calls);
    expect(dumped).not.toContain("super_secret_proxy");
    expect(dumped).not.toContain("Bearer ");
  });

  it("production default base is toss-api.thealltour.com", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    await fetchTossCategoryBest(20037, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      proxySecret: "x",
    });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url.startsWith(`${TOSS_SHOPPING_PROXY_BASE_URL}/v1/category-best/`)).toBe(true);
  });

  it("sharelink posts only tacaItemId with proxy secret", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          shortUrl: "https://toss.shopping/_m/abc",
          originUrl: "https://toss.shopping/t/1",
          targetUrl: "https://toss.shopping/_m/abc",
        }),
        { status: 200 },
      ),
    );
    await createOrReuseTossSharelink(42, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      proxySecret: "proxy_secret",
      proxyBaseUrl: "https://proxy.test",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proxy.test/v1/sharelinks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ tacaItemId: 42 });
    expect(init.headers).toMatchObject({ Authorization: "Bearer proxy_secret" });
  });
});
