import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { collectBlogRssPosts, resolveBlogRssUrls } from "@/lib/rss";
import { getSiteSettingsLive } from "@/lib/siteSettings";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  try {
    const settings = await getSiteSettingsLive();
    const rssUrls = resolveBlogRssUrls({ blogPageUrl: settings.naver_blog_url });
    if (rssUrls.length === 0) {
      return NextResponse.json({
        ok: true,
        posts: [],
        message: "RSS URL이 없습니다.",
      });
    }
    const posts = await collectBlogRssPosts(rssUrls);
    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    console.error("[api/admin/blog/rss-posts]", error);
    return NextResponse.json(
      { ok: false, message: "RSS 글을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
