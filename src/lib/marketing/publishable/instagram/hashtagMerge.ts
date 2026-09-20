import {
  INSTAGRAM_HASHTAG_MAX,
  INSTAGRAM_HASHTAG_MIN,
  extractInstagramHashtags,
} from "@/lib/marketing/publishable/validate";

/**
 * Models often put tags only in the `hashtags` JSON field while leaving `body` tag-free.
 * Publishability validates the caption body, so merge declared tags into body when missing.
 */
export function mergeInstagramHashtagsIntoBody(
  body: string,
  declaredHashtags: string[],
): { body: string; hashtags: string[] } {
  const normalize = (tag: string): string => {
    const trimmed = tag.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#+/, "")}`;
  };

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...extractInstagramHashtags(body), ...declaredHashtags]) {
    const tag = normalize(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length >= INSTAGRAM_HASHTAG_MAX) break;
  }

  const inBody = extractInstagramHashtags(body).map((tag) => tag.toLowerCase());
  const missing = merged.filter((tag) => !inBody.includes(tag.toLowerCase()));
  if (missing.length === 0) {
    return { body, hashtags: merged.length ? merged : extractInstagramHashtags(body) };
  }

  // Only append when the caption would otherwise fail the minimum hashtag gate.
  if (inBody.length >= INSTAGRAM_HASHTAG_MIN) {
    return { body, hashtags: merged.length ? merged : extractInstagramHashtags(body) };
  }

  const nextBody = `${body.trimEnd()}\n\n${missing.join(" ")}`;
  return {
    body: nextBody,
    hashtags: extractInstagramHashtags(nextBody).slice(0, INSTAGRAM_HASHTAG_MAX),
  };
}
