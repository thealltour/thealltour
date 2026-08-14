import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ThreadMarketingPostRow = {
  media_id: string;
  product_id: string;
  target_keyword: string;
};

export async function upsertThreadMarketingPost(input: {
  mediaId: string;
  productId: string;
  targetKeyword: string;
  permalink: string | null;
  publishedAt: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("thread_marketing_posts")
    .upsert(
      {
        media_id: input.mediaId,
        product_id: input.productId,
        target_keyword: input.targetKeyword,
        permalink: input.permalink,
        is_active: true,
        published_at: input.publishedAt,
      },
      { onConflict: "media_id" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`thread_marketing_posts 저장 실패: ${error.message}`);
  }
  const id = typeof data?.id === "string" ? data.id : "";
  if (!id) {
    throw new Error("thread_marketing_posts id를 받지 못했습니다.");
  }
  return id;
}

export async function listActiveThreadMarketingPostsSince(since: Date): Promise<ThreadMarketingPostRow[]> {
  const { data, error } = await supabaseAdmin
    .from("thread_marketing_posts")
    .select("media_id, product_id, target_keyword")
    .eq("is_active", true)
    .neq("target_keyword", "")
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`thread_marketing_posts 조회 실패: ${error.message}`);
  }

  const rows: ThreadMarketingPostRow[] = [];
  for (const row of data ?? []) {
    const mediaId = typeof row.media_id === "string" ? row.media_id.trim() : "";
    const productId = typeof row.product_id === "string" ? row.product_id.trim() : "";
    const targetKeyword = typeof row.target_keyword === "string" ? row.target_keyword.trim() : "";
    if (!mediaId || !productId || !targetKeyword) continue;
    rows.push({ media_id: mediaId, product_id: productId, target_keyword: targetKeyword });
  }
  return rows;
}

export async function listRepliedOnPost(postId: string): Promise<{
  commentIds: Set<string>;
  userHandles: Set<string>;
}> {
  const mediaId = postId.trim();
  const commentIds = new Set<string>();
  const userHandles = new Set<string>();
  if (!mediaId) return { commentIds, userHandles };

  const { data, error } = await supabaseAdmin
    .from("thread_marketing_replies")
    .select("comment_id, user_handle")
    .eq("post_id", mediaId);

  if (error) {
    throw new Error(`thread_marketing_replies 조회 실패: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (typeof row.comment_id === "string" && row.comment_id.trim()) {
      commentIds.add(row.comment_id.trim());
    }
    if (typeof row.user_handle === "string" && row.user_handle.trim()) {
      userHandles.add(row.user_handle.trim().replace(/^@+/u, "").toLowerCase());
    }
  }
  return { commentIds, userHandles };
}

export async function insertThreadMarketingReply(input: {
  postId: string;
  commentId: string;
  userHandle: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("thread_marketing_replies").insert({
    post_id: input.postId,
    comment_id: input.commentId,
    user_handle: input.userHandle,
    replied_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return;
    throw new Error(`thread_marketing_replies 저장 실패: ${error.message}`);
  }
}
