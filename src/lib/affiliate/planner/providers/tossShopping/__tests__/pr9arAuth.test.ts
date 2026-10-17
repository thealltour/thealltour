import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __peekTossShoppingAuthForTests,
  __resetTossShoppingAuthForTests,
  getTossSharelinkAccessToken,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingAuth";

afterEach(() => {
  __resetTossShoppingAuthForTests();
  vi.restoreAllMocks();
});

function tokenResponse(expiresIn = 3599) {
  return new Response(JSON.stringify({ access_token: "tok_live_abc", expires_in: expiresIn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PR-9AR Toss OAuth auth cache", () => {
  it("fetches a token and caches expiresAt", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse(3599));
    const now = vi.fn(() => 1_000_000);
    const token = await getTossSharelinkAccessToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "ak",
        TOSS_SHARELINK_SECRET_KEY: "sk",
      } as unknown as NodeJS.ProcessEnv,
    });
    expect(token).toBe("tok_live_abc");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const peek = __peekTossShoppingAuthForTests();
    expect(peek?.expiresAt).toBe(1_000_000 + 3599 * 1000);
  });

  it("reuses a cached token before expiry-90s", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse(3599));
    let nowMs = 1_000_000;
    const deps = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => nowMs,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "ak",
        TOSS_SHARELINK_SECRET_KEY: "sk",
      } as unknown as NodeJS.ProcessEnv,
    };
    await getTossSharelinkAccessToken(deps);
    nowMs += 1000;
    await getTossSharelinkAccessToken(deps);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes when within 90s of expiry", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse(100))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok_refreshed", expires_in: 3599 }), {
          status: 200,
        }),
      );
    let nowMs = 1_000_000;
    const deps = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => nowMs,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "ak",
        TOSS_SHARELINK_SECRET_KEY: "sk",
      } as unknown as NodeJS.ProcessEnv,
    };
    await getTossSharelinkAccessToken(deps);
    // expiresAt = 1_000_000 + 100_000; refresh when now > expiresAt - 90_000
    nowMs = 1_000_000 + 100_000 - 89_000;
    const token = await getTossSharelinkAccessToken(deps);
    expect(token).toBe("tok_refreshed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("parallel callers trigger a single auth request", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const deps = {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "ak",
        TOSS_SHARELINK_SECRET_KEY: "sk",
      } as unknown as NodeJS.ProcessEnv,
    };
    const p1 = getTossSharelinkAccessToken(deps);
    const p2 = getTossSharelinkAccessToken(deps);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    resolveFetch!(tokenResponse());
    expect(await p1).toBe("tok_live_abc");
    expect(await p2).toBe("tok_live_abc");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("auth error → null and does not keep expired cache", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 401 }));
    const token = await getTossSharelinkAccessToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "ak",
        TOSS_SHARELINK_SECRET_KEY: "sk",
      } as unknown as NodeJS.ProcessEnv,
    });
    expect(token).toBeNull();
    expect(__peekTossShoppingAuthForTests()).toBeNull();
  });

  it("never logs secrets or token values", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    await getTossSharelinkAccessToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: {
        TOSS_SHARELINK_ACCESS_KEY: "super_secret_ak",
        TOSS_SHARELINK_SECRET_KEY: "super_secret_sk",
      } as unknown as NodeJS.ProcessEnv,
    });
    const dumped = JSON.stringify(info.mock.calls);
    expect(dumped).not.toContain("super_secret");
    expect(dumped).not.toContain("tok_");
  });
});
