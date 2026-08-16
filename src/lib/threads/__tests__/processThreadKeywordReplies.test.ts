import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

import {
  commentContainsKeyword,
  MAX_THREAD_REPLIES_PER_RUN,
  processThreadKeywordReplies,
  type ProcessThreadKeywordRepliesDeps,
} from "@/lib/threads/processThreadKeywordReplies";
import {
  buildThreadReplyProductUrl,
  getRandomReplyMessage,
} from "@/lib/threads/replyTemplates";
import type { ThreadReply } from "@/lib/threads/threadsClient";

function makeDeps(overrides: Partial<ProcessThreadKeywordRepliesDeps> = {}): Partial<ProcessThreadKeywordRepliesDeps> {
  return {
    listActivePostsSince: async () => [
      {
        media_id: "media-1",
        product_id: "prod-1",
        target_keyword: "하이난골프",
        reply_destination_url: null,
      },
    ],
    listRepliedOnPost: async () => ({ commentIds: new Set<string>(), userHandles: new Set<string>() }),
    insertReply: async () => undefined,
    getReplies: async () => [],
    postReply: async () => ({ id: "reply-1" }),
    siteOrigin: () => "https://thealltour.com/",
    ownUsername: () => "thealltour",
    now: () => new Date("2026-08-14T10:00:00.000Z"),
    captureException: vi.fn(),
    sleepBetweenReplies: async () => undefined,
    ...overrides,
  };
}

function comment(partial: Partial<ThreadReply> & Pick<ThreadReply, "id" | "text">): ThreadReply {
  return {
    username: "golfer",
    timestamp: "2026-08-14T09:00:00+0000",
    ...partial,
  };
}

describe("commentContainsKeyword", () => {
  it("matches case-insensitively", () => {
    expect(commentContainsKeyword("지금 하이난골프 궁금해요", "하이난골프")).toBe(true);
    expect(commentContainsKeyword("HainanGolf please", "hainangolf")).toBe(true);
    expect(commentContainsKeyword("그냥 좋아요", "하이난골프")).toBe(false);
  });
});

describe("getRandomReplyMessage", () => {
  it("picks a template that includes handle and product URL", () => {
    const url = buildThreadReplyProductUrl("prod-1", "하이난골프", "https://thealltour.com/");
    const text = getRandomReplyMessage(
      { username: "@golfer", productUrl: url, keyword: "하이난골프" },
      () => 0,
    );
    expect(text).toContain("@golfer 님");
    expect(text).toContain(url);
    expect(url).toContain("utm_medium=auto_reply");
  });

  it("covers all templates via random rolls", () => {
    const url = "https://thealltour.com/products/p1";
    const seen = new Set<string>();
    for (let i = 0; i < 7; i += 1) {
      seen.add(getRandomReplyMessage({ username: "u", productUrl: url, keyword: "키워드" }, () => i / 7));
    }
    expect(seen.size).toBe(7);
  });
});

describe("processThreadKeywordReplies", () => {
  it("replies to new keyword comments and skips duplicates and own account", async () => {
    const postReply = vi.fn(async () => ({ id: "reply-1" }));
    const insertReply = vi.fn(async () => undefined);

    const result = await processThreadKeywordReplies(
      makeDeps({
        listRepliedOnPost: async () => ({
          commentIds: new Set(["already-1"]),
          userHandles: new Set(["user_b"]),
        }),
        getReplies: async () => [
          comment({ id: "hit-1", text: "하이난골프 일정표 부탁드려요", username: "user_a" }),
          comment({ id: "already-1", text: "하이난골프", username: "user_b" }),
          comment({ id: "own-1", text: "하이난골프", username: "thealltour" }),
          comment({ id: "miss-1", text: "좋아요", username: "user_c" }),
        ],
        postReply,
        insertReply,
      }),
    );

    expect(result).toEqual({ posts: 1, matched: 3, replied: 1, skipped: 2, failed: 0 });
    expect(postReply).toHaveBeenCalledTimes(1);
    expect(postReply.mock.calls[0][0]).toBe("hit-1");
    expect(String(postReply.mock.calls[0][1])).toContain("@user_a");
    expect(String(postReply.mock.calls[0][1])).toContain("utm_medium=auto_reply");
    expect(insertReply).toHaveBeenCalledWith({
      postId: "media-1",
      commentId: "hit-1",
      userHandle: "user_a",
    });
  });

  it("waits between consecutive replies", async () => {
    const sleepBetweenReplies = vi.fn(async () => undefined);
    const result = await processThreadKeywordReplies(
      makeDeps({
        getReplies: async () => [
          comment({ id: "a", text: "하이난골프", username: "u1" }),
          comment({ id: "b", text: "하이난골프", username: "u2" }),
        ],
        sleepBetweenReplies,
      }),
    );
    expect(result.replied).toBe(2);
    expect(sleepBetweenReplies).toHaveBeenCalledTimes(1);
  });

  it("replies only once when the same user posts the keyword multiple times", async () => {
    const postReply = vi.fn(async () => ({ id: "reply-1" }));
    const result = await processThreadKeywordReplies(
      makeDeps({
        listRepliedOnPost: async () => ({
          commentIds: new Set(["old-comment"]),
          userHandles: new Set(["repeat_user"]),
        }),
        getReplies: async () => [
          comment({ id: "c-new-1", text: "하이난골프", username: "repeat_user" }),
          comment({ id: "c-new-2", text: "하이난골프 일정", username: "Repeat_User" }),
          comment({ id: "c-ok", text: "하이난골프", username: "other_user" }),
        ],
        postReply,
      }),
    );
    expect(result.replied).toBe(1);
    expect(result.skipped).toBe(2);
    expect(postReply).toHaveBeenCalledTimes(1);
    expect(postReply.mock.calls[0][0]).toBe("c-ok");
  });

  it("skips extra keyword comments from the same user in one run", async () => {
    const postReply = vi.fn(async () => ({ id: "reply-1" }));
    const result = await processThreadKeywordReplies(
      makeDeps({
        getReplies: async () => [
          comment({ id: "first", text: "하이난골프", username: "user_a" }),
          comment({ id: "second", text: "하이난골프 또요", username: "user_a" }),
        ],
        postReply,
      }),
    );
    expect(result.replied).toBe(1);
    expect(result.skipped).toBe(1);
    expect(postReply).toHaveBeenCalledTimes(1);
    expect(postReply.mock.calls[0][0]).toBe("first");
  });

  it("continues when a post's reply fetch fails", async () => {
    const captureException = vi.fn();
    const result = await processThreadKeywordReplies(
      makeDeps({
        getReplies: async () => {
          throw new Error("graph down");
        },
        captureException,
      }),
    );
    expect(result.failed).toBe(1);
    expect(result.replied).toBe(0);
    expect(captureException).toHaveBeenCalled();
  });

  it("caps replies per run", async () => {
    const comments = Array.from({ length: MAX_THREAD_REPLIES_PER_RUN + 5 }, (_, i) =>
      comment({ id: `c-${i}`, text: "하이난골프", username: `u${i}` }),
    );
    const postReply = vi.fn(async () => ({ id: "reply-1" }));
    const result = await processThreadKeywordReplies(
      makeDeps({
        getReplies: async () => comments,
        postReply,
      }),
    );
    expect(result.replied).toBe(MAX_THREAD_REPLIES_PER_RUN);
    expect(postReply).toHaveBeenCalledTimes(MAX_THREAD_REPLIES_PER_RUN);
  });

  it("prefers reply_destination_url over product_id", async () => {
    const postReply = vi.fn(async () => ({ id: "reply-1" }));
    await processThreadKeywordReplies(
      makeDeps({
        listActivePostsSince: async () => [
          {
            media_id: "media-blog",
            product_id: "prod-should-not-use",
            target_keyword: "발리",
            reply_destination_url: "/blog",
          },
        ],
        getReplies: async () => [comment({ id: "c1", text: "발리 일정", username: "u1" })],
        postReply,
      }),
    );
    expect(postReply).toHaveBeenCalledTimes(1);
    const replyText = String((postReply.mock.calls as unknown as Array<[string, string]>)[0]?.[1] ?? "");
    expect(replyText).toContain("https://thealltour.com/blog?");
    expect(replyText).not.toContain("/products/");
  });
});
