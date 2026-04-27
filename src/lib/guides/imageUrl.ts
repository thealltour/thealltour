import type { Guide } from "@/types/guide";

export const GUIDE_CARD_FALLBACK_IMAGE = "/thealltour-logo.png";
export const GUIDE_HERO_FALLBACK_IMAGE = "/images/hub/hub-hero-destinations.png";

function parseUrl(value?: string | null): URL | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isLikelySignedNotionImageUrl(value?: string | null): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  const isNotionHost =
    host === "file.notion.so" ||
    host === "prod-files-secure.s3.us-west-2.amazonaws.com" ||
    host.endsWith(".notion.site");
  if (!isNotionHost) return false;
  return (
    url.searchParams.has("X-Amz-Algorithm") ||
    url.searchParams.has("X-Amz-Signature") ||
    url.searchParams.has("x-amz-signature")
  );
}

export function pickGuidePreferredImageUrl(guide: Guide): string {
  const candidates = [guide.thumbnail_url, guide.guide_thumbnail_url, guide.cover_image_url];
  const signedCandidates: Array<string | null | undefined> = [];
  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url) continue;
    if (isLikelySignedNotionImageUrl(url)) {
      signedCandidates.push(url);
      continue;
    }
    return url;
  }
  return signedCandidates[0]?.trim() ?? "";
}

