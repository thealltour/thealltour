import { NextRequest, NextResponse } from "next/server";
import { assertFlyerImageProxyUrlAllowed, isFlyerImageProxyHostAllowed } from "@/lib/flyers/flyerImageProxyHosts";

export const runtime = "nodejs";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 25_000;

function parseTargetUrl(raw: string | null): URL | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    return new URL(String(raw).trim());
  } catch {
    return null;
  }
}

function mergeCacheControl(upstream: string | null): string {
  if (upstream && upstream.length > 0 && upstream.length < 512) return upstream;
  return "public, max-age=3600";
}

function isProbablyImageContentType(ct: string): boolean {
  const c = ct.toLowerCase().split(";")[0]?.trim() ?? "";
  return c.startsWith("image/") || c === "application/octet-stream" || c === "";
}

async function fetchImageFollowingRedirects(initial: URL): Promise<Response> {
  let current = initial.href;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    assertFlyerImageProxyUrlAllowed(u);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(u.href, {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: {
          Accept: "image/*,application/octet-stream;q=0.8,*/*;q=0.1",
          "User-Agent": "TheAllTour-FlyerImageProxy/1.0",
        },
      });
    } finally {
      clearTimeout(t);
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new Error("redirect without location");
      }
      const nextUrl = new URL(loc, u.href);
      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        throw new Error("invalid redirect protocol");
      }
      if (!isFlyerImageProxyHostAllowed(nextUrl.hostname)) {
        throw new Error("redirect host not allowed");
      }
      current = nextUrl.href;
      continue;
    }

    if (!res.ok) {
      throw new Error(`upstream ${res.status}`);
    }
    return res;
  }
  throw new Error("too many redirects");
}

export async function GET(req: NextRequest) {
  const target = parseTargetUrl(req.nextUrl.searchParams.get("url"));
  if (!target) {
    return NextResponse.json({ error: "missing or invalid url" }, { status: 400 });
  }

  try {
    assertFlyerImageProxyUrlAllowed(target);
  } catch {
    return NextResponse.json({ error: "url not allowed" }, { status: 403 });
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[flyer image-proxy] fetch", target.hostname);
  }

  let upstream: Response;
  try {
    upstream = await fetchImageFollowingRedirects(target);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    if (process.env.NODE_ENV === "development") {
      console.warn("[flyer image-proxy] failed", target.href.slice(0, 120), msg);
    }
    const status = msg.includes("not allowed") || msg.includes("forbidden") ? 403 : 502;
    return NextResponse.json({ error: "upstream fetch failed" }, { status });
  }

  const contentType = upstream.headers.get("content-type") || "application/octet-stream";
  if (!isProbablyImageContentType(contentType)) {
    upstream.body?.cancel?.();
    return NextResponse.json({ error: "response is not an image" }, { status: 502 });
  }

  const body = upstream.body;
  if (!body) {
    return NextResponse.json({ error: "empty body" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", mergeCacheControl(upstream.headers.get("cache-control")));

  return new NextResponse(body, { status: 200, headers });
}
