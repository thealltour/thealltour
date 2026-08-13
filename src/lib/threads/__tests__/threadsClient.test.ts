import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { publishToThreads, ThreadsClientError } from "@/lib/threads/threadsClient";

const fetchMock = vi.fn();

describe("publishToThreads", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.THREADS_ACCESS_TOKEN = "token";
    process.env.THREADS_USER_ID = "user-1";
  });

  afterEach(() => {
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
