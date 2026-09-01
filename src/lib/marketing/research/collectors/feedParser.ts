import Parser from "rss-parser";

export type ParsedFeedItem = {
  externalId: string;
  title: string;
  link: string | null;
  summary: string;
  publishedAt: string | null;
};

const parser = new Parser({
  timeout: 15_000,
  headers: {
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    "User-Agent": "TheallTourBot/1.0 (+https://thealltour.com; research-readonly)",
  },
});

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(raw?: string | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

type FeedItem = {
  id?: string;
  guid?: string;
  link?: string;
  title?: string;
  content?: string;
  contentSnippet?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
};

export async function parseFeedFromXml(xml: string, feedUrl: string): Promise<ParsedFeedItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).map((item, index) => {
    const typed = item as FeedItem;
    const rawSummary =
      typed.contentSnippet ||
      typed.summary ||
      typed.content ||
      "";
    const summary = stripHtml(String(rawSummary)).slice(0, 500);
    const title = typed.title?.trim() || "Untitled";
    const link = typed.link?.trim() || null;
    const externalId =
      typed.id?.trim() ||
      typed.guid?.trim() ||
      link ||
      `${feedUrl}#${index}`;

    return {
      externalId,
      title,
      link,
      summary: summary || title,
      publishedAt: toIsoDate(typed.isoDate || typed.pubDate),
    };
  });
}
