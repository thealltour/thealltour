import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetTossShoppingCacheForTests,
  createMemoryTossShoppingCache,
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
  it("posts PRODUCT landing with publisherId + tacaItemId and caches reuse", async () => {
    const cache = createMemoryTossShoppingCache();
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          resultType: "SUCCESS",
          success: {
            shortUrl: "https://toss.shopping/_m/abcDE",
            originUrl: "https://toss.shopping/t/1?k=x&referrer=affiliate",
          },
        }),
        { status: 200 },
      ),
    );

    const deps = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      getAccessToken: async () => "bearer",
      cache,
      env: { TOSS_SHARELINK_PUBLISHER_ID: "pub-uuid" } as unknown as NodeJS.ProcessEnv,
    };

    const first = await createOrReuseTossSharelink(991122, deps);
    expect(first?.targetUrl).toBe("https://toss.shopping/_m/abcDE");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1]?.body));
    expect(body).toEqual({
      landingType: "PRODUCT",
      tacaItemId: 991122,
      publisherId: "pub-uuid",
    });

    const second = await createOrReuseTossSharelink(991122, deps);
    expect(second?.targetUrl).toBe("https://toss.shopping/_m/abcDE");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("failure → null", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await createOrReuseTossSharelink(1, {
      getAccessToken: async () => "bearer",
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: { TOSS_SHARELINK_PUBLISHER_ID: "pub" } as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toBeNull();
  });

  it("missing publisherId → null without network", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn();
    const result = await createOrReuseTossSharelink(1, {
      getAccessToken: async () => "bearer",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      cache: createMemoryTossShoppingCache(),
      env: {} as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
