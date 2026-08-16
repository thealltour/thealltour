export type ThreadReplyDestination = {
  id: string;
  label: string;
  url: string;
};

function newDestinationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** http(s) 절대 URL 또는 사이트 상대 path (/blog) */
export function isValidThreadReplyDestinationUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  if (value.startsWith("/")) {
    return value.length > 1 || value === "/";
  }
  return /^https?:\/\//i.test(value);
}

/** site_settings JSON → 정규화된 유도 URL 목록 */
export function parseThreadReplyDestinations(linksJson?: string | null): ThreadReplyDestination[] {
  if (typeof linksJson !== "string" || !linksJson.trim()) return [];
  try {
    const raw = JSON.parse(linksJson) as unknown;
    if (!Array.isArray(raw)) return [];
    const parsed: ThreadReplyDestination[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const label = String((item as { label?: unknown }).label ?? "").trim();
      const url = String((item as { url?: unknown }).url ?? "").trim();
      if (!label || !isValidThreadReplyDestinationUrl(url)) continue;
      const id = String((item as { id?: unknown }).id ?? "").trim() || newDestinationId();
      parsed.push({ id, label, url });
    }
    return parsed;
  } catch {
    return [];
  }
}

export function serializeThreadReplyDestinations(destinations: ThreadReplyDestination[]): string {
  const normalized = destinations
    .map((item) => ({
      id: item.id.trim() || newDestinationId(),
      label: item.label.trim(),
      url: item.url.trim(),
    }))
    .filter((item) => item.label && isValidThreadReplyDestinationUrl(item.url));
  return JSON.stringify(normalized);
}

export function createEmptyThreadReplyDestination(): ThreadReplyDestination {
  return { id: newDestinationId(), label: "", url: "" };
}

/** 목록에 등록된 URL인지 비교 (trailing slash·origin 정규화) */
export function normalizeDestinationUrlForCompare(url: string, siteOrigin?: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const origin = (siteOrigin ?? "").replace(/\/$/, "");
  let absolute = trimmed;
  if (trimmed.startsWith("/")) {
    absolute = origin ? `${origin}${trimmed}` : trimmed;
  }
  try {
    const parsed = new URL(absolute);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export function isDestinationInList(
  selectedUrl: string,
  destinations: ThreadReplyDestination[],
  siteOrigin?: string,
): boolean {
  const needle = normalizeDestinationUrlForCompare(selectedUrl, siteOrigin);
  if (!needle) return false;
  return destinations.some(
    (item) => normalizeDestinationUrlForCompare(item.url, siteOrigin) === needle,
  );
}
