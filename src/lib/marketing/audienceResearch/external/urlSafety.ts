/**
 * SSRF / open-proxy guards for RA-1C document inspection.
 * Standalone — does not depend on affiliate TravelpayoutsError.
 */

const PRIVATE_IPV4 =
  /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

export type UrlSafetyFailureReason =
  | "malformed_url"
  | "unsupported_scheme"
  | "credentials_in_url"
  | "localhost"
  | "private_ip"
  | "metadata_host"
  | "blocked_host";

export type UrlSafetyResult =
  | { ok: true; url: URL; hostname: string }
  | { ok: false; reason: UrlSafetyFailureReason; message: string };

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
  return PRIVATE_IPV4.test(hostname);
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("fe80")) return true;
  // IPv4-mapped IPv6 ::ffff:x.x.x.x
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped?.[1] && isPrivateIpv4(mapped[1])) return true;
  return false;
}

/** Allow http/https public URLs only. Reject localhost, private IP, cloud metadata. */
export function assertPublicHttpUrl(raw: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed_url", message: "Malformed URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "unsupported_scheme", message: "Only http/https allowed" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url", message: "Credentials not allowed in URL" };
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname) {
    return { ok: false, reason: "malformed_url", message: "Empty hostname" };
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return { ok: false, reason: "localhost", message: "Localhost not allowed" };
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".internal")) {
    return { ok: false, reason: "metadata_host", message: "Metadata/internal host not allowed" };
  }

  // AWS / GCP / Azure metadata IPs
  if (hostname === "169.254.169.254" || hostname === "169.254.170.2") {
    return { ok: false, reason: "metadata_host", message: "Cloud metadata IP not allowed" };
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return { ok: false, reason: "private_ip", message: "Private IP not allowed" };
  }

  return { ok: true, url, hostname };
}

export function isUrlSafetyOk(raw: string): boolean {
  return assertPublicHttpUrl(raw).ok;
}
