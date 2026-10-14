import "server-only";
import { PEXELS_DOWNLOAD_HOST_ALLOWLIST, PIXABAY_DOWNLOAD_HOST_ALLOWLIST } from "@/lib/marketing/assets/shortform/production/paths";
import { NarrationError } from "../narration/persistence";
import { requireFreshScenePlan } from "../narrationScenes/service";
import type { StockProvider } from "./contracts";
import { readReviews, readSceneSearch } from "./store";

const ALLOW_HOSTS = { pexels: PEXELS_DOWNLOAD_HOST_ALLOWLIST, pixabay: PIXABAY_DOWNLOAD_HOST_ALLOWLIST } as const;
const allowed = (url: URL, provider: StockProvider) => url.protocol === "https:" && ALLOW_HOSTS[provider].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
/** Only a preview rendition already stored for a shown or reviewed candidate of the current plan can be proxied; the browser never supplies a URL. */
export function storedPreviewUrl(root: string, candidateId: string, input: { planFingerprint: string; visualId: string; provider: StockProvider; videoId: string }) {
  const plan = requireFreshScenePlan(root, candidateId, input.planFingerprint);
  const search = readSceneSearch(root, plan.fingerprint, input.visualId);
  const reviewed = readReviews(root, plan.fingerprint, input.visualId).reviews.some(r => r.provider === input.provider && r.videoId === input.videoId);
  const candidate = search?.candidates.find((c, i) => c.provider === input.provider && c.videoId === input.videoId && (i < search.shownCount || reviewed));
  if (!candidate?.previewRendition) throw new NarrationError("미리보기 영상을 찾을 수 없습니다.", 404);
  return candidate.previewRendition.url;
}
/** Streams a provider video file for review. Admin CSP has no remote media-src, so playback goes through this allowlisted proxy. */
export async function proxyStockPreview(urlString: string, provider: StockProvider, range: string | null) {
  let url = new URL(urlString);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!allowed(url, provider)) throw new NarrationError("허용되지 않은 미리보기 주소입니다.", 409);
    const response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000),
      headers: { Accept: "video/*", ...(range && /^bytes=\d*-\d*$/.test(range) ? { Range: range } : {}) } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location"); if (!location) break;
      url = new URL(location, url); continue;
    }
    const type = response.headers.get("content-type") ?? "";
    if (![200, 206].includes(response.status) || !response.body || !/^(video\/|application\/octet-stream)/i.test(type)) throw new NarrationError("미리보기 영상을 불러오지 못했습니다.", 502);
    const headers = new Headers({ "Content-Type": type.startsWith("video/") ? type : "video/mp4", "Cache-Control": "no-store", "Accept-Ranges": "bytes" });
    for (const name of ["content-length", "content-range"]) { const value = response.headers.get(name); if (value) headers.set(name, value); }
    return new Response(response.body, { status: response.status, headers });
  }
  throw new NarrationError("미리보기 주소 이동이 너무 많습니다.", 502);
}
