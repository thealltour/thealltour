/**
 * Prefer Korean Airalo product pages (`www.airalo.com/ko/...`) for Partner Links.
 * Feed rows often use Impact/pxf wrappers whose `u=` points at the English path.
 */

const AIRALO_PRODUCT_HOSTS = new Set(["www.airalo.com", "airalo.com"]);

function withKoPath(productUrl: URL): string {
  const url = new URL(productUrl.toString());
  url.protocol = "https:";
  url.hostname = "www.airalo.com";
  const path = url.pathname || "/";
  if (path === "/ko" || path.startsWith("/ko/")) {
    return url.toString();
  }
  url.pathname = path === "/" ? "/ko/" : `/ko${path.startsWith("/") ? path : `/${path}`}`;
  return url.toString();
}

/**
 * Returns an https www.airalo.com/ko/... URL when the feed source is Airalo (direct or pxf `u=`).
 * Unrecognized hosts are returned unchanged so commerce validation can still reject them.
 */
export function resolveAiraloCommerceSourceUrl(sourceUrl: string): string {
  const raw = sourceUrl?.trim();
  if (!raw) return sourceUrl;

  let product: URL | null = null;
  try {
    const outer = new URL(raw);
    const host = outer.hostname.toLowerCase();
    if (AIRALO_PRODUCT_HOSTS.has(host)) {
      product = outer;
    } else if (host === "airalo.pxf.io" || host.endsWith(".pxf.io")) {
      const inner = outer.searchParams.get("u")?.trim();
      if (inner) {
        const innerUrl = new URL(inner);
        if (AIRALO_PRODUCT_HOSTS.has(innerUrl.hostname.toLowerCase())) {
          product = innerUrl;
        }
      }
    }
  } catch {
    return sourceUrl;
  }

  if (!product) return sourceUrl;
  return withKoPath(product);
}
