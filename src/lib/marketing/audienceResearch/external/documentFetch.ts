import { assertPublicHttpUrl } from "@/lib/marketing/audienceResearch/external/urlSafety";

export type SafeDocumentFetchResult =
  | {
      ok: true;
      url: string;
      finalUrl: string;
      contentType: string | null;
      text: string;
      byteLength: number;
    }
  | {
      ok: false;
      url: string;
      reason: string;
      message: string;
    };

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_REDIRECT_LIMIT = 3;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
];

function contentTypeAllowed(contentType: string | null): boolean {
  if (!contentType) return true; // allow missing CT; text extraction may still fail soft
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_CONTENT_TYPES.some((allowed) => base === allowed || base.endsWith("+xml"));
}

async function readBodyLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; byteLength: number } | { error: "oversized" }> {
  if (!response.body) {
    const text = await response.text();
    const bytes = Buffer.byteLength(text, "utf8");
    if (bytes > maxBytes) return { error: "oversized" };
    return { text, byteLength: bytes };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return { error: "oversized" };
      }
      chunks.push(value);
    }
  }
  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: merged.toString("utf8"), byteLength: merged.byteLength };
}

/**
 * Bounded document fetch with SSRF revalidation on every redirect hop.
 * No JS execution / no browser automation.
 */
export async function fetchPublicDocument(input: {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
  redirectLimit?: number;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}): Promise<SafeDocumentFetchResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;
  const redirectLimit = input.redirectLimit ?? DEFAULT_REDIRECT_LIMIT;
  const userAgent =
    input.userAgent ?? "TheallTourBot/1.0 (+https://thealltour.com; audience-research-readonly)";

  let current = input.url;
  for (let hop = 0; hop <= redirectLimit; hop += 1) {
    const safety = assertPublicHttpUrl(current);
    if (!safety.ok) {
      return { ok: false, url: input.url, reason: safety.reason, message: safety.message };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(safety.url.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.1",
          "User-Agent": userAgent,
        },
        signal: controller.signal,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            url: input.url,
            reason: "redirect_missing_location",
            message: "Redirect without Location",
          };
        }
        let next: string;
        try {
          next = new URL(location, safety.url).toString();
        } catch {
          return {
            ok: false,
            url: input.url,
            reason: "redirect_malformed",
            message: "Malformed redirect Location",
          };
        }
        // Revalidate next hop (blocks redirect-to-private).
        const nextSafety = assertPublicHttpUrl(next);
        if (!nextSafety.ok) {
          return {
            ok: false,
            url: input.url,
            reason: `redirect_${nextSafety.reason}`,
            message: nextSafety.message,
          };
        }
        current = next;
        continue;
      }

      if (!response.ok) {
        return {
          ok: false,
          url: input.url,
          reason: `http_${response.status}`,
          message: `HTTP ${response.status}`,
        };
      }

      const contentType = response.headers.get("content-type");
      if (!contentTypeAllowed(contentType)) {
        return {
          ok: false,
          url: input.url,
          reason: "content_type_blocked",
          message: `Blocked content-type: ${contentType ?? "unknown"}`,
        };
      }

      const body = await readBodyLimited(response, maxBytes);
      if ("error" in body) {
        return {
          ok: false,
          url: input.url,
          reason: "oversized_response",
          message: `Response exceeded ${maxBytes} bytes`,
        };
      }

      return {
        ok: true,
        url: input.url,
        finalUrl: safety.url.toString(),
        contentType,
        text: body.text,
        byteLength: body.byteLength,
      };
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        url: input.url,
        reason: aborted ? "timeout" : "network",
        message: aborted ? "Fetch timeout" : error instanceof Error ? error.message : "network_error",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    url: input.url,
    reason: "redirect_limit",
    message: `Exceeded redirect limit ${redirectLimit}`,
  };
}

/** Strip tags lightly for research excerpts — not a full HTML parser. */
export function extractPlainTextExcerpt(htmlOrText: string, maxChars = 900): string {
  const withoutScripts = htmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return withoutScripts.slice(0, maxChars);
}
