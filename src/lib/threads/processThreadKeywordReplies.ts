import "server-only";

import { captureServerException } from "@/lib/observability";
import {
  getThreadReplies,
  postThreadReply,
  type ThreadReply,
} from "@/lib/threads/threadsClient";
import {
  insertThreadMarketingReply,
  listActiveThreadMarketingPostsSince,
  listRepliedOnPost,
  type ThreadMarketingPostRow,
} from "@/lib/threads/threadMarketingStore";
import {
  buildThreadReplyProductUrl,
  getRandomReplyMessage,
  THREAD_REPLY_GAP_MS,
} from "@/lib/threads/replyTemplates";

export const MAX_THREAD_REPLIES_PER_RUN = 25;
export const THREAD_REPLY_LOOKBACK_DAYS = 7;

export type ProcessThreadKeywordRepliesResult = {
  posts: number;
  matched: number;
  replied: number;
  skipped: number;
  failed: number;
};

export type ProcessThreadKeywordRepliesDeps = {
  listActivePostsSince: (since: Date) => Promise<ThreadMarketingPostRow[]>;
  listRepliedOnPost: (postId: string) => Promise<{ commentIds: Set<string>; userHandles: Set<string> }>;
  insertReply: (row: { postId: string; commentId: string; userHandle: string }) => Promise<void>;
  getReplies: (mediaId: string) => Promise<ThreadReply[]>;
  postReply: (mediaId: string, text: string) => Promise<{ id: string }>;
  siteOrigin: () => string;
  ownUsername: () => string | null;
  now: () => Date;
  captureException: typeof captureServerException;
  /** 연속 답글 사이 대기. 기본 1.5초. 테스트에서는 no-op로 주입 */
  sleepBetweenReplies: () => Promise<void>;
};

function defaultSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

function defaultOwnUsername(): string | null {
  const value = process.env.THREADS_USERNAME?.trim() ?? "";
  return value || null;
}

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@+/u, "").toLowerCase();
}

export function commentContainsKeyword(text: string, keyword: string): boolean {
  const hay = text.trim().toLowerCase();
  const needle = keyword.trim().toLowerCase();
  if (!hay || !needle) return false;
  return hay.includes(needle);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultDeps(): ProcessThreadKeywordRepliesDeps {
  return {
    listActivePostsSince: listActiveThreadMarketingPostsSince,
    listRepliedOnPost,
    insertReply: insertThreadMarketingReply,
    getReplies: getThreadReplies,
    postReply: postThreadReply,
    siteOrigin: defaultSiteOrigin,
    ownUsername: defaultOwnUsername,
    now: () => new Date(),
    captureException: captureServerException,
    sleepBetweenReplies: () => sleep(THREAD_REPLY_GAP_MS),
  };
}

export async function processThreadKeywordReplies(
  overrides: Partial<ProcessThreadKeywordRepliesDeps> = {},
): Promise<ProcessThreadKeywordRepliesResult> {
  const deps = { ...defaultDeps(), ...overrides };
  const result: ProcessThreadKeywordRepliesResult = {
    posts: 0,
    matched: 0,
    replied: 0,
    skipped: 0,
    failed: 0,
  };

  const since = new Date(deps.now().getTime() - THREAD_REPLY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const posts = await deps.listActivePostsSince(since);
  result.posts = posts.length;

  const own = deps.ownUsername();
  const ownHandle = own ? normalizeHandle(own) : "";
  const siteOrigin = deps.siteOrigin();

  for (const post of posts) {
    if (result.replied >= MAX_THREAD_REPLIES_PER_RUN) break;

    let comments: ThreadReply[];
    try {
      comments = await deps.getReplies(post.media_id);
    } catch (error) {
      result.failed += 1;
      deps.captureException(error, { cron: "threads-replies", mediaId: post.media_id });
      continue;
    }

    const keywordHits = comments.filter((comment) =>
      commentContainsKeyword(comment.text, post.target_keyword),
    );
    const already = await deps.listRepliedOnPost(post.media_id);

    for (const comment of keywordHits) {
      if (result.replied >= MAX_THREAD_REPLIES_PER_RUN) break;
      result.matched += 1;

      const handle = comment.username.trim().replace(/^@+/u, "");
      const handleKey = normalizeHandle(handle);
      if (
        !handle ||
        (ownHandle && handleKey === ownHandle) ||
        already.commentIds.has(comment.id) ||
        already.userHandles.has(handleKey)
      ) {
        result.skipped += 1;
        continue;
      }

      try {
        if (result.replied > 0) {
          await deps.sleepBetweenReplies();
        }
        const productUrl = buildThreadReplyProductUrl(post.product_id, post.target_keyword, siteOrigin);
        await deps.postReply(
          comment.id,
          getRandomReplyMessage({
            username: handle,
            productUrl,
            keyword: post.target_keyword,
          }),
        );
        await deps.insertReply({
          postId: post.media_id,
          commentId: comment.id,
          userHandle: handle,
        });
        already.commentIds.add(comment.id);
        already.userHandles.add(handleKey);
        result.replied += 1;
      } catch (error) {
        result.failed += 1;
        deps.captureException(error, {
          cron: "threads-replies",
          mediaId: post.media_id,
          commentId: comment.id,
        });
      }
    }
  }

  return result;
}
