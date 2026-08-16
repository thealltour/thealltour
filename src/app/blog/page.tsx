import type { Metadata } from "next";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { collectBlogRssPosts, resolveBlogRssUrls } from "@/lib/rss";
import { RssBlogCardList } from "@/components/blog/RssBlogCardList";
import { getSiteSettings } from "@/lib/siteSettings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "여행 스토리 & 블로그",
  description:
    "더올투어 네이버·티스토리 블로그의 여행 소식과 추천 코스를 한곳에서 확인하세요.",
};

/**
 * 네이버/티스토리 RSS 주소.
 * 비워 두면 `BLOG_RSS_URL` 환경변수, 이어서 사이트설정의 네이버 블로그 URL에서 RSS를 유도합니다.
 * 여러 피드는 쉼표로 구분합니다. 예: https://rss.blog.naver.com/thealltour.xml,https://thealltour.tistory.com/rss
 */
const BLOG_RSS_URL = "";

export default async function BlogPage() {
  const settings = await getSiteSettings();
  const rssUrls = resolveBlogRssUrls({
    explicitUrl: BLOG_RSS_URL,
    blogPageUrl: settings.naver_blog_url,
  });
  const posts = await collectBlogRssPosts(rssUrls);

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL BLOG"
          title="여행 스토리 & 블로그"
          subtitle="실시간으로 업데이트되는 블로그의 생생한 여행 소식과 추천 코스입니다. 카드를 클릭하시면 공식 블로그 원문으로 이동하여 상세한 내용을 확인하실 수 있습니다."
          size="sm"
        />

        <section className="space-y-4">
          <RssBlogCardList posts={posts} />
        </section>
      </SectionBody>
    </div>
  );
}
