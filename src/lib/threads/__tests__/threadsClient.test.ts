import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/threads/threadTokenStore", () => ({
  getStoredThreadsAccessToken: vi.fn(async () => null),
  saveThreadsAccessToken: vi.fn(async () => undefined),
  insertThreadMarketingLog: vi.fn(async () => undefined),
}));

import {
  clearThreadsAccessTokenCache,
  flattenThreadRepliesPayload,
  getThreadReplies,
  postThreadReply,
  publishToThreads,
  refreshThreadsLongLivedToken,
  ThreadsClientError,
} from "@/lib/threads/threadsClient";

const fetchMock = vi.fn();

describe("publishToThreads", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.THREADS_USER_ID = "user-1";
  });

  afterEach(() => {
    clearThreadsAccessTokenCache();
    vi.unstubAllGlobals();
  });

  it("creates a container, publishes with creation_id, then reads permalink", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "container-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "media-9" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "media-9", permalink: "https://www.threads.net/@x/post/abc" }),
      });

    const result = await publishToThreads({
      text: "본문",
      imageUrl: "https://cdn.example.com/a.jpg",
    });

    expect(result).toEqual({
      id: "media-9",
      permalink: "https://www.threads.net/@x/post/abc",
      creationId: "container-1",
    });

    const createUrl = String(fetchMock.mock.calls[0][0]);
    expect(createUrl).toContain("/user-1/threads");
    expect(createUrl).toContain("media_type=IMAGE");
    expect(createUrl).toContain("image_url=");

    const publishUrl = String(fetchMock.mock.calls[1][0]);
    expect(publishUrl).toContain("/threads_publish");
    expect(publishUrl).toContain("creation_id=container-1");

    const permalinkUrl = String(fetchMock.mock.calls[2][0]);
    expect(permalinkUrl).toContain("/media-9");
    expect(permalinkUrl).toContain("fields=id%2Cpermalink");
  });

  it("throws when credentials are missing", async () => {
    delete process.env.THREADS_ACCESS_TOKEN;
    await expect(publishToThreads({ text: "본문" })).rejects.toBeInstanceOf(ThreadsClientError);
  });
});

describe("flattenThreadRepliesPayload", () => {
  it("flattens top-level replies and one nested replies.data level", () => {
    const replies = flattenThreadRepliesPayload({
      data: [
        {
          id: "c1",
          text: "하이난골프",
          username: "user_a",
          timestamp: "2026-08-14T00:00:00+0000",
          replies: {
            data: [{ id: "c1-1", text: "대댓글", username: "user_b", timestamp: "2026-08-14T00:01:00+0000" }],
          },
        },
      ],
    });
    expect(replies.map((r) => r.id)).toEqual(["c1", "c1-1"]);
  });
});

describe("getThreadReplies", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.THREADS_USER_ID = "user-1";
  });

  afterEach(() => {
    clearThreadsAccessTokenCache();
    vi.unstubAllGlobals();
  });

  it("GETs /{mediaId}/replies with fields and follows paging.next once", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: [{ id: "c1", text: "안녕", username: "a", timestamp: "t1" }],
            paging: { next: "https://graph.threads.net/v1.0/media-1/replies?after=cursor" },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: [{ id: "c2", text: "키워드", username: "b", timestamp: "t2" }] }),
      });

    const replies = await getThreadReplies("media-1");
    expect(replies.map((r) => r.id)).toEqual(["c1", "c2"]);

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("/media-1/replies");
    expect(firstUrl).toContain("fields=id%2Ctext%2Cusername%2Ctimestamp%2Creplies");
    expect(String(fetchMock.mock.calls[1][0])).toContain("after=cursor");
  });
});

describe("postThreadReply", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.THREADS_USER_ID = "user-1";
  });

  afterEach(() => {
    clearThreadsAccessTokenCache();
    vi.unstubAllGlobals();
  });

  it("creates a TEXT container with reply_to_id then publishes", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "reply-container" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: "reply-media" }),
      });

    const result = await postThreadReply("comment-9", "답글입니다");
    expect(result).toEqual({ id: "reply-media", creationId: "reply-container" });

    const createUrl = String(fetchMock.mock.calls[0][0]);
    expect(createUrl).toContain("/user-1/threads");
    expect(createUrl).toContain("media_type=TEXT");
    expect(createUrl).toContain("reply_to_id=comment-9");
    expect(createUrl).toContain("text=");

    const publishUrl = String(fetchMock.mock.calls[1][0]);
    expect(publishUrl).toContain("/threads_publish");
    expect(publishUrl).toContain("creation_id=reply-container");
  });
});

describe("refreshThreadsLongLivedToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs refresh_access_token with th_refresh_token and returns expiry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          access_token: "new-long-lived",
          token_type: "bearer",
          expires_in: 5184000,
        }),
    });

    const result = await refreshThreadsLongLivedToken("old-token");
    expect(result.accessToken).toBe("new-long-lived");
    expect(result.tokenType).toBe("bearer");
    expect(result.expiresIn).toBe(5184000);
    expect(Date.parse(result.expiresAt)).toBeGreaterThan(Date.now());

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("https://graph.threads.net/refresh_access_token");
    expect(url).toContain("grant_type=th_refresh_token");
    expect(url).toContain("access_token=old-token");
  });
});
