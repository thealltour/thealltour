export type RssPostSource = "naver" | "tistory" | "other";

export interface RssPost {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  thumbnail: string | null;
  source: RssPostSource;
}
