import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { findBlogRssPostForThreads, resolveBlogRssUrls } from "@/lib/rss";
import { getSiteSettingsLive } from "@/lib/siteSettings";
import { generateBlogThreadCopy } from "@/lib/threads/generateThreadCopy";
import {
  composeThreadDraft,
  isThreadsMarketingMode,
  type ThreadsMarketingMode,
} from "@/lib/threads/threadCopy.types";

type GenerateBody = {
  link?: string;
  marketingMode?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ ok: false, message: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const link = body.link?.trim() ?? "";
  if (!link || link === "#") {
    return NextResponse.json({ ok: false, message: "블로그 글 링크가 필요합니다." }, { status: 400 });
  }
  if (!isThreadsMarketingMode(body.marketingMode)) {
    return NextResponse.json(
      {
        ok: false,
        message: "marketingMode는 TIMEDEAL, CURATION, SEASONAL_EXPERIENCE 중 하나여야 합니다.",
      },
      { status: 400 },
    );
  }
  const marketingMode: ThreadsMarketingMode = body.marketingMode;

  try {
    const settings = await getSiteSettingsLive();
    const rssUrls = resolveBlogRssUrls({ blogPageUrl: settings.naver_blog_url });
    if (rssUrls.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "RSS URL이 없습니다. 환경설정의 네이버 블로그 URL 또는 BLOG_RSS_URL을 확인하세요.",
        },
        { status: 400 },
      );
    }

    const post = await findBlogRssPostForThreads(link, rssUrls);
    if (!post) {
      return NextResponse.json(
        { ok: false, message: "RSS에서 해당 블로그 글을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const copy = await generateBlogThreadCopy(
      {
        title: post.title,
        bodyText: post.bodyText,
        link: post.link,
        thumbnail: post.thumbnail,
      },
      marketingMode,
    );

    return NextResponse.json({
      ok: true,
      link: post.link,
      marketingMode,
      copy,
      draftContent: composeThreadDraft(copy),
      heroImageUrl: post.thumbnail,
    });
  } catch (error) {
    console.error("[api/admin/threads/generate-blog]", error);
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "스레드 카피 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
