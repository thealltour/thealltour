/**
 * Reading what a provider says about a video: Pixabay tags, or the page URL slug (Pexels returns no title or tags, so its
 * slug is the only descriptive field). Creator names and the query we sent are never part of it.
 */
export const words = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
export function pageSlug(pageUrl: string) {
  try { const segments = new URL(pageUrl).pathname.split("/").filter(Boolean); const slug = segments.at(-1) ?? ""; return slug.replace(/[-_]+/g, " ").replace(/\b(id )?\d+\b/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || null; }
  catch { return null; }
}
type Described = { tags: string[]; pageUrl: string };
/** No match means "장소 미확인", not a mismatch. */
export function placeEvidence(video: Described, placeName: string) {
  const needed = words(placeName); if (!needed.length) return null;
  const tagText = video.tags.join(" "); const slug = pageSlug(video.pageUrl);
  if (needed.every(w => words(tagText).includes(w))) return { field: "tags" as const, matchedText: tagText.slice(0, 300) };
  if (slug && needed.every(w => words(slug).includes(w))) return { field: "page_url" as const, matchedText: slug };
  return null;
}
const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "at", "in", "on", "with", "to", "for", "by", "from", "into", "near", "while", "around", "over",
  "is", "are", "be", "some", "their", "its", "setting", "scene", "shot", "view", "visible", "background", "close", "up", "wide"]);
/** Crude English stemming so "stools"/"stool" and "eating"/"eats" meet; good enough for title slugs and tags. */
function stem(word: string) {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) { w = w.slice(0, -3); if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1); }
  else if (w.length > 4 && w.endsWith("es") && /(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}
export const terms = (value: string) => words(value).filter(w => !STOPWORDS.has(w) && !/^\d+$/.test(w)).map(stem);
export const uniqueTerms = (values: string[]) => [...new Set(terms(values.join(" ")))];
export function sceneTerms(scene: { subject: string; visibleAction: string; mustMatch: string[] }) {
  return uniqueTerms([scene.subject, scene.visibleAction, ...scene.mustMatch]);
}
export const describedTerms = (video: Described) => new Set(terms(`${pageSlug(video.pageUrl) ?? ""} ${video.tags.join(" ")}`));
/** Which scene words the provider's own description contains. */
export function metadataMatch(video: Described, sceneWords: string[]) {
  const described = describedTerms(video);
  return sceneWords.filter(w => described.has(w));
}
/** Same content words in any order or inflection count as the same query. */
export const queryIdentity = (text: string) => [...new Set(terms(text))].sort().join(" ") || text.trim().toLowerCase();
