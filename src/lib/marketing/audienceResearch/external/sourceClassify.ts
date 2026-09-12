export const EXTERNAL_SOURCE_CLASSES = [
  "official",
  "first_party_business",
  "editorial_media",
  "public_social",
  "community",
  "commercial_blog",
  "unknown",
] as const;

export type ExternalSourceClass = (typeof EXTERNAL_SOURCE_CLASSES)[number];

const OFFICIAL_HOST_HINTS = [
  "msc",
  "royalcaribbean",
  "carnival",
  "ncl.com",
  "costacruises",
  "busanpa",
  "portbusan",
  "visitkorea",
  "knto",
  "mcst.go.kr",
  "mois.go.kr",
  "korea.kr",
  "go.kr",
  "gov.",
  ".gov",
];

const SOCIAL_HOST_HINTS = [
  "instagram.com",
  "facebook.com",
  "threads.net",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "x.com",
  "twitter.com",
];

const COMMUNITY_HOST_HINTS = [
  "reddit.com",
  "quora.com",
  "cafe.naver.com",
  "kin.naver.com",
  "blog.naver.com",
  "tistory.com",
  "dcinside.com",
  "theqoo.net",
];

const EDITORIAL_HOST_HINTS = [
  "nytimes.com",
  "bbc.",
  "cnn.",
  "reuters.",
  "yonhap",
  "chosun",
  "joongang",
  "hankyung",
  "mk.co.kr",
  "traveltimes",
  "travie",
  "lonelyplanet",
  "tripadvisor",
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function classifyExternalSource(input: {
  url: string;
  title?: string;
  snippet?: string;
}): ExternalSourceClass {
  const host = hostnameOf(input.url);
  // title/snippet intentionally ignored for official promotion (model prose is not authoritative).
  void input.title;
  void input.snippet;

  if (!host) return "unknown";
  if (SOCIAL_HOST_HINTS.some((h) => host.includes(h))) return "public_social";
  if (COMMUNITY_HOST_HINTS.some((h) => host.includes(h))) return "community";

  // Official operator / authority: hostname identity only.
  const hostLooksOfficial = OFFICIAL_HOST_HINTS.some((h) => host.includes(h));
  if (hostLooksOfficial) {
    if (host.includes("blog") || host.includes("news")) {
      if (host.includes("go.kr") || host.includes("gov") || host.includes("port")) return "official";
    } else {
      return "official";
    }
  }
  if (host.includes("go.kr") || host.endsWith(".gov") || host.includes(".gov.")) return "official";
  if (EDITORIAL_HOST_HINTS.some((h) => host.includes(h))) return "editorial_media";
  if (host.includes("blog") || host.includes("tistory") || host.includes("medium.com")) {
    return "commercial_blog";
  }
  if (host.includes("booking") || host.includes("agoda") || host.includes("expedia")) {
    return "first_party_business";
  }
  return "unknown";
}

export function sourceClassAllowsVerifiedFact(sourceClass: ExternalSourceClass): boolean {
  return sourceClass === "official";
}
