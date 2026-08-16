import AdminHeader from "@/components/admin/AdminHeader";
import AdminBlogManager from "@/components/admin/blog/AdminBlogManager";
import { prepareAdminNotificationsAndGetUnreadCount } from "@/lib/adminNotifications";
import { collectBlogRssPosts, resolveBlogRssUrls } from "@/lib/rss";
import { getSiteSettingsLive } from "@/lib/siteSettings";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const [unreadNotificationCount, settings] = await Promise.all([
    prepareAdminNotificationsAndGetUnreadCount(),
    getSiteSettingsLive(),
  ]);

  const rssUrls = resolveBlogRssUrls({ blogPageUrl: settings.naver_blog_url });
  const posts = rssUrls.length > 0 ? await collectBlogRssPosts(rssUrls) : [];

  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-6xl space-y-6">
        <AdminHeader
          title="블로그(RSS) · Threads"
          description="네이버 블로그 RSS 글로 Threads 카피를 만들고, 검수 후 발행·자동답글 유도 URL을 관리합니다."
          unreadNotificationCount={unreadNotificationCount}
        />
        <AdminBlogManager
          initialPosts={posts}
          initialDestinationsJson={settings.thread_reply_destinations}
          rssConfigured={rssUrls.length > 0}
        />
      </main>
    </div>
  );
}
