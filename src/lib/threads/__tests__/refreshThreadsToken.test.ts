import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getStoredThreadsAccessToken = vi.fn();
const saveThreadsAccessToken = vi.fn();
const insertThreadMarketingLog = vi.fn();
const refreshThreadsLongLivedToken = vi.fn();
const resolveThreadsAccessToken = vi.fn();
const clearThreadsAccessTokenCache = vi.fn();

vi.mock("@/lib/threads/threadTokenStore", () => ({
  getStoredThreadsAccessToken: (...args: unknown[]) => getStoredThreadsAccessToken(...args),
  saveThreadsAccessToken: (...args: unknown[]) => saveThreadsAccessToken(...args),
  insertThreadMarketingLog: (...args: unknown[]) => insertThreadMarketingLog(...args),
}));

vi.mock("@/lib/threads/threadsClient", () => ({
  refreshThreadsLongLivedToken: (...args: unknown[]) => refreshThreadsLongLivedToken(...args),
  resolveThreadsAccessToken: (...args: unknown[]) => resolveThreadsAccessToken(...args),
  clearThreadsAccessTokenCache: (...args: unknown[]) => clearThreadsAccessTokenCache(...args),
}));

import { runThreadsTokenRefresh } from "@/lib/threads/refreshThreadsToken";

describe("runThreadsTokenRefresh", () => {
  beforeEach(() => {
    getStoredThreadsAccessToken.mockReset();
    saveThreadsAccessToken.mockReset().mockResolvedValue(undefined);
    insertThreadMarketingLog.mockReset().mockResolvedValue(undefined);
    refreshThreadsLongLivedToken.mockReset();
    resolveThreadsAccessToken.mockReset();
    clearThreadsAccessTokenCache.mockReset();
  });

  it("persists the refreshed token and writes an ok log", async () => {
    resolveThreadsAccessToken.mockResolvedValue("old-token");
    refreshThreadsLongLivedToken.mockResolvedValue({
      accessToken: "new-token",
      tokenType: "bearer",
      expiresIn: 5184000,
      expiresAt: "2026-10-13T00:00:00.000Z",
    });

    const result = await runThreadsTokenRefresh();
    expect(result).toEqual({ expiresAt: "2026-10-13T00:00:00.000Z", expiresIn: 5184000 });
    expect(saveThreadsAccessToken).toHaveBeenCalledWith({
      accessToken: "new-token",
      expiresAt: "2026-10-13T00:00:00.000Z",
    });
    expect(clearThreadsAccessTokenCache).toHaveBeenCalled();
    expect(insertThreadMarketingLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "token_refresh", status: "ok" }),
    );
  });

  it("logs an error when no token is available", async () => {
    resolveThreadsAccessToken.mockResolvedValue(null);
    await expect(runThreadsTokenRefresh()).rejects.toThrow("활성 Threads 토큰이 없습니다.");
    expect(insertThreadMarketingLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "token_refresh", status: "error" }),
    );
    expect(saveThreadsAccessToken).not.toHaveBeenCalled();
  });
});
