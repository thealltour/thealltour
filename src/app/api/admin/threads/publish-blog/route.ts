import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { captureServerException } from "@/lib/observability";
import { getSiteSettingsLive } from "@/lib/siteSettings";
import {
  isDestinationInList,
  isValidThreadReplyDestinationUrl,
  parseThreadReplyDestinations,
} from "@/lib/threads/threadReplyDestinations";
import { upsertThreadMarketingPost } from "@/lib/threads/threadMarketingStore";
import { publishToThreads, ThreadsClientError } from "@/lib/threads/threadsClient";

type PublishBody = {
  draftContent?: string;
  imageUrl?: string;
  targetKeyword?: string;
  sourceUrl?: string;
  replyDestinationUrl?: string;
};

function defaultSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: PublishBody;
  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ ok: false, message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const draftContent = body.draftContent?.trim() ?? "";
  const sourceUrl = body.sourceUrl?.trim() ?? "";
  const targetKeyword = body.targetKeyword?.trim() ?? "";
  const replyDestinationUrl = body.replyDestinationUrl?.trim() ?? "";
  const imageUrl = body.imageUrl?.trim() || undefined;

  if (!draftContent) {
    return NextResponse.json({ ok: false, message: "게시할 원고가 비어 있습니다." }, { status: 400 });
  }
  if (!sourceUrl || sourceUrl === "#") {
    return NextResponse.json({ ok: false, message: "블로그 원문 URL이 필요합니다." }, { status: 400 });
  }
  if (!targetKeyword) {
    return NextResponse.json({ ok: false, message: "targetKeyword가 필요합니다." }, { status: 400 });
  }
  if (!isValidThreadReplyDestinationUrl(replyDestinationUrl)) {
    return NextResponse.json(
      { ok: false, message: "자동답글 유도 URL을 선택해 주세요. (https://... 또는 /path)" },
      { status: 400 },
    );
  }

  try {
    const settings = await getSiteSettingsLive();
    const destinations = parseThreadReplyDestinations(settings.thread_reply_destinations);
    if (
      !isDestinationInList(replyDestinationUrl, destinations, defaultSiteOrigin())
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "선택한 유도 URL이 목록에 없습니다. 블로그 관리에서 URL을 추가·저장한 뒤 다시 선택하세요.",
        },
        { status: 400 },
      );
    }

    const threads = await publishToThreads({ text: draftContent, imageUrl });
    const publishedAt = new Date().toISOString();
    let logId: string | null = null;
    try {
      logId = await upsertThreadMarketingPost({
        mediaId: threads.id,
        productId: null,
        targetKeyword,
        permalink: threads.permalink,
        publishedAt,
        replyDestinationUrl,
        sourceType: "blog",
        sourceUrl,
      });
    } catch (persistError) {
      captureServerException(persistError, { mediaId: threads.id, sourceUrl });
      return NextResponse.json(
        {
          ok: false,
          message: "스레드는 게시됐지만 자동 답글용 이력을 저장하지 못했습니다.",
          sourceUrl,
          targetKeyword,
          replyDestinationUrl,
          publishedAt,
          threads,
          logId: null,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      sourceUrl,
      targetKeyword,
      replyDestinationUrl,
      publishedAt,
      threads,
      logId,
    });
  } catch (error) {
    console.error("[api/admin/threads/publish-blog]", error);
    if (error instanceof ThreadsClientError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.httpStatus });
    }
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "스레드 게시에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
