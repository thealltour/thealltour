import "server-only";
import Parser from "rss-parser";
import type { RssPost, RssPostSource } from "@/lib/rss.types";

export type { RssPost, RssPostSource };

const parser = new Parser({
  timeout: 12_000,
  headers: {
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "User-Agent": "TheallTourBot/1.0 (+https://thealltour.com)",
  },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
    ],
  },
});

type MappedRssPost = RssPost & { publishedAtMs: number };

type RssItem = {
  guid?: string;
  link?: string;
  title?: string;
  pubDate?: string;
  isoDate?: string;
  content?: string;
  contentSnippet?: string;
  snippet?: string;
  description?: string;
  contentEncoded?: string;
  enclosure?: { url?: string; type?: string };
  mediaThumbnail?: { $?: { url?: string } } | string;
  mediaContent?: { $?: { url?: string } } | string;
};

function detectSource(url: string): RssPostSource {
  const value = url.toLowerCase();
  if (value.includes("naver.com") || value.includes("pstatic.net")) return "naver";
  if (
    value.includes("tistory.com") ||
    value.includes("daumcdn.net") ||
    value.includes("kakaocdn.net")
  ) {
    return "tistory";
  }
  return "other";
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://")) return `https://${value.slice("http://".length)}`;
  if (value.startsWith("https://")) return value;
  return null;
}

function mediaUrl(value: RssItem["mediaThumbnail"] | RssItem["mediaContent"]): string | null {
  if (!value) return null;
  if (typeof value === "string") return normalizeImageUrl(value);
  return normalizeImageUrl(value.$?.url);
}

function extractThumbnail(rawContent: string, item: RssItem): string | null {
  const imgMatch = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) return normalizeImageUrl(imgMatch[1]);
  if (item.enclosure?.url && (!item.enclosure.type || item.enclosure.type.startsWith("image/"))) {
    return normalizeImageUrl(item.enclosure.url);
  }
  return mediaUrl(item.mediaThumbnail) ?? mediaUrl(item.mediaContent);
}

function cleanSummary(rawContent: string, snippet?: string): string {
  const fromSnippet = snippet?.replace(/\s+/g, " ").trim();
  if (fromSnippet) return fromSnippet.slice(0, 120);

  const cleaned = rawContent
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
}

function formatPubDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function publishedAtMs(item: RssItem): number {
  const raw = item.isoDate || item.pubDate || "";
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

/** 블로그 홈 URL을 RSS 피드 URL로 변환. 이미 RSS면 그대로 반환. */
export function blogPageUrlToRssUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");

  if (host === "rss.blog.naver.com") {
    return path.endsWith(".xml") ? url.toString() : `https://rss.blog.naver.com${path}.xml`;
  }

  if (host === "blog.naver.com" || host === "m.blog.naver.com") {
    const blogId = path.split("/").filter(Boolean)[0];
    if (!blogId) return null;
    return `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
  }

  if (host.endsWith(".tistory.com")) {
    if (path === "/rss" || path === "/feed") return `${url.origin}${path}`;
    return `${url.origin}/rss`;
  }

  if (path.endsWith(".xml") || path === "/rss" || path === "/feed") {
    return url.toString();
  }

  return null;
}

export function resolveBlogRssUrls(options?: {
  explicitUrl?: string;
  blogPageUrl?: string;
}): string[] {
  const fromEnv = [
    process.env.BLOG_RSS_URL,
    process.env.BLOG_TISTORY_RSS_URL,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const fromExplicit = (options?.explicitUrl ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const fromBlogPage = options?.blogPageUrl
    ? blogPageUrlToRssUrl(options.blogPageUrl)
    : null;

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const candidate of [...fromExplicit, ...fromEnv, fromBlogPage]) {
    if (!candidate) continue;
    const rssUrl = blogPageUrlToRssUrl(candidate) ?? candidate;
    if (seen.has(rssUrl)) continue;
    seen.add(rssUrl);
    urls.push(rssUrl);
  }
  return urls;
}

function mapFeedItems(rssUrl: string, items: RssItem[]): MappedRssPost[] {
  return items.map((item, idx) => {
    const rawContent = String(
      item.contentEncoded || item.content || item.description || "",
    );
    const link = item.link?.trim() || "#";
    const thumbnail = extractThumbnail(rawContent, item);
    const summary = cleanSummary(rawContent, item.contentSnippet || item.snippet);

    return {
      id: item.guid || link || `${rssUrl}-${idx}`,
      title: item.title?.trim() || "제목 없음",
      link,
      pubDate: formatPubDate(item.isoDate || item.pubDate),
      summary,
      thumbnail,
      source: detectSource(link !== "#" ? link : rssUrl),
      publishedAtMs: publishedAtMs(item),
    };
  });
}

function toPublicPosts(posts: MappedRssPost[]): RssPost[] {
  return posts
    .slice()
    .sort((a, b) => b.publishedAtMs - a.publishedAtMs)
    .map(({ publishedAtMs: _unused, ...post }) => post);
}

export async function getBlogRssPosts(rssUrl: string): Promise<RssPost[]> {
  const url = rssUrl.trim();
  if (!url) return [];

  try {
    const feed = await parser.parseURL(url);
    const items = (feed.items ?? []) as RssItem[];
    return toPublicPosts(mapFeedItems(url, items));
  } catch (error) {
    console.error("[RSS Error] 피드를 불러오는데 실패했습니다:", url, error);
    return [];
  }
}

export async function collectBlogRssPosts(rssUrls: string[]): Promise<RssPost[]> {
  const uniqueUrls = [...new Set(rssUrls.map((url) => url.trim()).filter(Boolean))];
  if (uniqueUrls.length === 0) return [];

  const results = await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const feed = await parser.parseURL(url);
        return mapFeedItems(url, (feed.items ?? []) as RssItem[]);
      } catch (error) {
        console.error("[RSS Error] 피드를 불러오는데 실패했습니다:", url, error);
        return [] as MappedRssPost[];
      }
    }),
  );

  const seen = new Set<string>();
  const posts: MappedRssPost[] = [];
  for (const feedPosts of results) {
    for (const post of feedPosts) {
      const key = post.link !== "#" ? post.link : post.id;
      if (seen.has(key)) continue;
      seen.add(key);
      posts.push(post);
    }
  }

  return toPublicPosts(posts);
}
