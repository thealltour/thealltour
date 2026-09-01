export type ResearchHttpErrorCode =
  | "timeout"
  | "response_too_large"
  | "http_4xx"
  | "http_5xx"
  | "network"
  | "malformed";

export class ResearchHttpError extends Error {
  readonly code: ResearchHttpErrorCode;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(input: {
    code: ResearchHttpErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = "ResearchHttpError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
  }
}

export type ResearchHttpFetchOptions = {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 1_024 * 1_024;
const DEFAULT_USER_AGENT = "TheallTourBot/1.0 (+https://thealltour.com; research-readonly)";

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchResearchDocument(
  options: ResearchHttpFetchOptions,
): Promise<{ body: string; contentType: string | null; status: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRetries = options.maxRetries ?? 2;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  let attempt = 0;
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(options.url, {
        method: "GET",
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
          "User-Agent": userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && !isRetryableStatus(response.status)) {
          throw new ResearchHttpError({
            code: "http_4xx",
            message: `HTTP ${response.status} for ${options.url}`,
            status: response.status,
            retryable: false,
          });
        }
        if (response.status >= 500 || isRetryableStatus(response.status)) {
          throw new ResearchHttpError({
            code: "http_5xx",
            message: `HTTP ${response.status} for ${options.url}`,
            status: response.status,
            retryable: true,
          });
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ResearchHttpError({
          code: "malformed",
          message: "Empty response body",
          retryable: false,
        });
      }

      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          throw new ResearchHttpError({
            code: "response_too_large",
            message: `Response exceeded ${maxBytes} bytes`,
            retryable: false,
          });
        }
        chunks.push(value);
      }

      const body = new TextDecoder("utf-8").decode(
        chunks.reduce((acc, chunk) => {
          const merged = new Uint8Array(acc.length + chunk.length);
          merged.set(acc, 0);
          merged.set(chunk, acc.length);
          return merged;
        }, new Uint8Array()),
      );

      return {
        body,
        contentType: response.headers.get("content-type"),
        status: response.status,
      };
    } catch (error) {
      if (error instanceof ResearchHttpError) {
        if (error.retryable && attempt <= maxRetries) {
          await sleep(250 * attempt);
          continue;
        }
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        if (attempt <= maxRetries) {
          await sleep(250 * attempt);
          continue;
        }
        throw new ResearchHttpError({
          code: "timeout",
          message: `Timeout after ${timeoutMs}ms for ${options.url}`,
          retryable: false,
        });
      }
      if (attempt <= maxRetries) {
        await sleep(250 * attempt);
        continue;
      }
      throw new ResearchHttpError({
        code: "network",
        message: error instanceof Error ? error.message : "Network failure",
        retryable: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
