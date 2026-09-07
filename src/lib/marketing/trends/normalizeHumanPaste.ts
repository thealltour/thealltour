/**
 * Human-paste URL normalizer for TrendSignal intake.
 * Only identical markdown-wrapped URLs [https://x](https://x) → raw URI.
 * Any other markdown link is rejected.
 * JSON array/object brackets are never treated as markdown (label must be http(s) URL,
 * or a non-structural text label for reject-other-markdown checks).
 */
export type NormalizeTrendPasteResult =
  | { ok: true; text: string; normalizedCount: number }
  | { ok: false; reason: string };

/** Only http(s) labels — never matches JSON `[{...}]` / `["a"]`. */
const MD_HTTP_LINK_RE = /\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)/gi;

/**
 * Other markdown links `[label](target)`.
 * Excludes JSON structural opens (`[{`, `["`, `[[`) via negative lookahead on label start.
 */
const MD_OTHER_LINK_RE = /\[(?!https?:\/\/)(?!\{)(?!")(?!\[)([^\]]*)\]\(([^)]+)\)/g;

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize paste text before JSON parse.
 * - Identical markdown URL links → raw URI
 * - Non-identical / non-URL markdown links → reject
 */
export function normalizeTrendHumanPaste(raw: string): NormalizeTrendPasteResult {
  if (typeof raw !== "string") {
    return { ok: false, reason: "paste_not_string" };
  }

  MD_OTHER_LINK_RE.lastIndex = 0;
  if (MD_OTHER_LINK_RE.test(raw)) {
    return { ok: false, reason: "markdown_label_target_mismatch" };
  }

  const httpMatches: Array<{ full: string; label: string; target: string; index: number }> = [];
  MD_HTTP_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_HTTP_LINK_RE.exec(raw)) != null) {
    httpMatches.push({
      full: m[0],
      label: m[1] ?? "",
      target: m[2] ?? "",
      index: m.index,
    });
  }

  for (const match of httpMatches) {
    const labelTrim = match.label.trim();
    const targetTrim = match.target.trim();
    if (labelTrim !== targetTrim || !isAbsoluteHttpUrl(labelTrim)) {
      return { ok: false, reason: "markdown_label_target_mismatch" };
    }
  }

  let normalizedCount = 0;
  let text = raw;
  for (const match of [...httpMatches].sort((a, b) => b.index - a.index)) {
    const url = match.label.trim();
    text = text.slice(0, match.index) + url + text.slice(match.index + match.full.length);
    normalizedCount += 1;
  }

  return { ok: true, text, normalizedCount };
}

export function assertRawUriCanonical(url: string): boolean {
  if (!isAbsoluteHttpUrl(url)) return false;
  if (url.includes("](")) return false;
  return true;
}
