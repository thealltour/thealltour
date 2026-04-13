import type { OgPageSeoData } from "@/lib/seo/ogPageSeoTypes";
import { fetchOgImageAsDataUrl } from "@/lib/seo/fetchOgImageAsDataUrl";

const MAX_FETCH_ATTEMPTS = 5;

/**
 * OG 스냅샷의 이미지 후보를 순서대로 fetch해 data URL 1개만 반환.
 * 상품·가이드·taxonomy 등 공통 fallback 정책(후보 순서는 getter가 결정).
 */
export async function fetchOgHeroDataUrl(
  seo: Pick<OgPageSeoData, "primaryImageUrl" | "imageCandidates">,
): Promise<string | null> {
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (u: string | null | undefined) => {
    const t = u?.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    order.push(t);
  };
  add(seo.primaryImageUrl);
  for (const u of seo.imageCandidates) add(u);

  for (const url of order.slice(0, MAX_FETCH_ATTEMPTS)) {
    const dataUrl = await fetchOgImageAsDataUrl(url);
    if (dataUrl) return dataUrl;
  }
  return null;
}
