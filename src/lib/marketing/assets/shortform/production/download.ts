import "server-only";

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import { SHORTFORM_DOWNLOAD_DEFAULTS } from "@/lib/marketing/assets/shortform/production/paths";

export type SafeDownloadInput = {
  url: string;
  destinationAbsolutePath: string;
  allowHosts: readonly string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  acceptedContentTypePrefixes?: readonly string[];
};

function assertHostAllowed(urlString: string, allowHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ShortformProductionError("invalid download url", "INVALID_DOWNLOAD_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ShortformProductionError("download url must be http(s)", "INVALID_DOWNLOAD_PROTOCOL");
  }
  const host = url.hostname.toLowerCase();
  if (!allowHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new ShortformProductionError(`download host not allowlisted: ${host}`, "DOWNLOAD_HOST_DENIED");
  }
  return url;
}

/**
 * Provider-scoped download. Not a generic URL fetch (SSRF-safe allowlist).
 */
export async function downloadToFileWithAllowlist(input: SafeDownloadInput): Promise<{
  bytesWritten: number;
  contentType: string | null;
  finalUrl: string;
}> {
  const timeoutMs = input.timeoutMs ?? SHORTFORM_DOWNLOAD_DEFAULTS.timeoutMs;
  const maxBytes = input.maxBytes ?? SHORTFORM_DOWNLOAD_DEFAULTS.maxBytes;
  const maxRedirects = input.maxRedirects ?? SHORTFORM_DOWNLOAD_DEFAULTS.maxRedirects;
  const fetchImpl = input.fetchImpl ?? fetch;
  const accepted = input.acceptedContentTypePrefixes ?? ["video/", "image/", "application/octet-stream"];

  let current = assertHostAllowed(input.url, input.allowHosts).toString();
  let redirects = 0;

  while (true) {
    if (input.signal?.aborted) {
      throw new ShortformProductionError("download aborted", "DOWNLOAD_ABORTED");
    }
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    input.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "video/*,image/*,*/*" },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects >= maxRedirects) {
          throw new ShortformProductionError("download redirect denied", "DOWNLOAD_REDIRECT_DENIED");
        }
        redirects += 1;
        const next = new URL(location, current).toString();
        assertHostAllowed(next, input.allowHosts);
        current = next;
        continue;
      }

      if (!response.ok || !response.body) {
        throw new ShortformProductionError(
          `download failed status=${response.status}`,
          "DOWNLOAD_HTTP_ERROR",
        );
      }

      const contentType = response.headers.get("content-type");
      if (
        contentType &&
        !accepted.some((prefix) => contentType.toLowerCase().startsWith(prefix))
      ) {
        throw new ShortformProductionError(
          `unexpected content-type ${contentType}`,
          "DOWNLOAD_CONTENT_TYPE",
        );
      }

      const lengthHeader = response.headers.get("content-length");
      if (lengthHeader) {
        const len = Number(lengthHeader);
        if (Number.isFinite(len) && len > maxBytes) {
          throw new ShortformProductionError("download exceeds maxBytes", "DOWNLOAD_TOO_LARGE");
        }
      }

      await mkdir(dirname(input.destinationAbsolutePath), { recursive: true });
      const nodeStream = Readable.fromWeb(response.body as never);
      let written = 0;
      nodeStream.on("data", (chunk: Buffer) => {
        written += chunk.length;
        if (written > maxBytes) {
          nodeStream.destroy(new Error("DOWNLOAD_TOO_LARGE"));
        }
      });
      await pipeline(nodeStream, createWriteStream(input.destinationAbsolutePath));
      return { bytesWritten: written, contentType, finalUrl: current };
    } catch (error) {
      if (error instanceof ShortformProductionError) throw error;
      const message = error instanceof Error ? error.message : "download_failed";
      if (message.includes("DOWNLOAD_TOO_LARGE") || /aborted/i.test(message)) {
        throw new ShortformProductionError(message, message.includes("TOO_LARGE") ? "DOWNLOAD_TOO_LARGE" : "DOWNLOAD_ABORTED");
      }
      throw new ShortformProductionError(message, "DOWNLOAD_FAILED");
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", onAbort);
    }
  }
}
