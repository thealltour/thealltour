import { TravelpayoutsError } from "@/lib/affiliate/travelpayouts/errors";

const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export type ValidateAffiliateUrlOptions = {
  /** When set, hostname must match exactly or be a subdomain of an entry. */
  allowedHosts?: string[];
  /** Default true — Partner Links source/generated URLs should be https. */
  httpsOnly?: boolean;
};

/**
 * Shared SSRF / open-proxy guard for affiliate source & generated URLs.
 */
export function validateAffiliateSourceUrl(
  raw: string,
  options?: ValidateAffiliateUrlOptions,
): { ok: true; url: URL; hostname: string } | { ok: false; error: TravelpayoutsError } {
  return validateAffiliateUrl(raw, { ...options, httpsOnly: options?.httpsOnly ?? true });
}

export function validateGeneratedAffiliateUrl(
  raw: string,
  options?: ValidateAffiliateUrlOptions,
): { ok: true; url: URL; hostname: string } | { ok: false; error: TravelpayoutsError } {
  return validateAffiliateUrl(raw, { ...options, httpsOnly: options?.httpsOnly ?? true });
}

function validateAffiliateUrl(
  raw: string,
  options: ValidateAffiliateUrlOptions,
): { ok: true; url: URL; hostname: string } | { ok: false; error: TravelpayoutsError } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "Malformed URL"),
    };
  }

  const httpsOnly = options.httpsOnly !== false;
  if (httpsOnly && url.protocol !== "https:") {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "HTTPS required"),
    };
  }
  if (!httpsOnly && url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "Unsupported protocol"),
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "Credentials not allowed"),
    };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "Localhost not allowed"),
    };
  }

  if (hostname === "::1" || hostname === "[::1]") {
    return {
      ok: false,
      error: new TravelpayoutsError("invalid_source_url", "Loopback not allowed"),
    };
  }

  // IPv4 literal checks
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (PRIVATE_IPV4.test(hostname) || hostname === "0.0.0.0") {
      return {
        ok: false,
        error: new TravelpayoutsError("invalid_source_url", "Private IP not allowed"),
      };
    }
  }

  // IPv6 literals (basic)
  if (hostname.includes(":")) {
    const normalized = hostname.replace(/^\[|\]$/g, "");
    if (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    ) {
      return {
        ok: false,
        error: new TravelpayoutsError("invalid_source_url", "Private IPv6 not allowed"),
      };
    }
  }

  if (options.allowedHosts && options.allowedHosts.length > 0) {
    if (!hostMatchesAllowlist(hostname, options.allowedHosts)) {
      return {
        ok: false,
        error: new TravelpayoutsError(
          "source_host_not_allowed",
          "Source host is not allowed",
        ),
      };
    }
  }

  return { ok: true, url, hostname };
}

export function hostMatchesAllowlist(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts.some((entry) => {
    const allowed = entry.trim().toLowerCase();
    if (!allowed) return false;
    if (host === allowed) return true;
    // subdomain: foo.example.com matches allowlist example.com
    return host.endsWith(`.${allowed}`);
  });
}

export function safeHostnameFromUrl(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}
