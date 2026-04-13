import { getProductByIdFresh } from "@/lib/products";
import { getTaxonomyById, parseThemeTokens } from "@/lib/productTaxonomies";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductSeoCopyFromProduct } from "@/lib/seo/resolveProductSeoCopy";
import type { ItineraryEventImage } from "@/types/product";

const PLACEHOLDER_SUBSTR = "picsum.photos";

/** 일정에서 수집하는 이미지 URL 상한(과도한 배열·페이로드 방지). */
const MAX_ITINERARY_IMAGE_URLS = 14;

/**
 * 상품 상세 SEO/OG 단일 소스.
 * - `generateMetadata`는 메타 문구·이미지 라우트 정합성에 활용
 * - `opengraph-image` / `twitter-image` → `productOgImageResponse`가 `imageCandidates`로 실제 PNG 합성
 *
 * 이미지 후보 우선순위(버킷):
 * 1) `images_json` 갤러리 — URL 휴리스틱으로 스코어 정렬(로고·썸네일 감점 등). 갤러리 항목은 정규화 후 문자열 배열이라 DB 객체의 isCover는 반영 불가.
 * 2) `image_url` 히어로
 * 3) `overview_json.coverImageUrl`, 일정(v2·구조화)·`itinerary_media_json` 이미지(메타·상한 적용)
 * 4) destination taxonomy `card_image_url` → `hero_image_url`
 */
export type ProductSeoData = {
  id: string;
  name: string;
  /** `<title>` / OG title용 (메타 필드 또는 합성) */
  browserTitle: string;
  metaDescription: string;
  regionName: string | null;
  themeNames: string[];
  summaryLine: string | null;
  priceLabel: string | null;
  /** OG 페인트용 절대 URL, 우선순위·품질 스코어 순 */
  imageCandidates: string[];
  /** 정렬·스코어링 후 1순위 후보. opengraph-image fetch 시 최우선 */
  primaryImageUrl: string | null;
  /** ProductOgCard 요약 한 줄 (패턴 매칭 ogSubtitle → summaryLine → 고정 fallback) */
  ogCardSubtitle: string;
};

type OgImageEntry = { abs: string; bucket: number; sortKey: number };

function isRealProductImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.length > 0 && !u.includes(PLACEHOLDER_SUBSTR);
}

function truncateSeo(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** 파일 경로·쿼리 기반 품질·대표성 추정(실제 픽셀 검사 없음). */
function scoreImageUrl(url: string): number {
  let score = 0;
  const u = url.trim().toLowerCase();
  if (!u) return score;

  try {
    const parsed = new URL(u);
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    const hay = `${path} ${search}`;

    if (/logo|favicon|apple-touch|sprite|watermark|badge/.test(hay)) score -= 55;
    if (/\bicon\b|symbol\b/.test(path)) score -= 40;

    if (/thumb|small|lowres|low-res|\bmini\b|_tn\.|_xs\.|tiny/.test(hay)) score -= 22;
    if (/large|original|\bxl\b|fullsize|full[_-]size|master/.test(hay)) score += 18;

    const rw =
      parsed.searchParams.get("resize_w") ||
      parsed.searchParams.get("w") ||
      parsed.searchParams.get("width");
    if (rw) {
      const n = parseInt(rw, 10);
      if (n > 0 && n < 360) score -= 35;
      if (n >= 800) score += 12;
    }
  } catch {
    if (/logo|icon|thumb|small/i.test(u)) score -= 30;
  }

  if (u.includes("img.modetour.com")) score += 10;

  return score;
}

/** 명백한 장식/로고 URL은 후보에서 제외(일반 풍경 파일명 오탐 최소화). */
function shouldSkipLikelyDecorativeUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    /\/favicon\.(ico|png)(\?|$)/i.test(u) ||
    /\/apple-touch-icon/i.test(u) ||
    /\/logo[^/]*\.(svg|png|jpe?g|webp)(\?|$)/i.test(u) ||
    /\/brand[_-]?mark/i.test(u)
  );
}

function sortEventImagesForOg(images: ItineraryEventImage[]): ItineraryEventImage[] {
  return [...images].sort((a, b) => {
    if (a.isCover && !b.isCover) return -1;
    if (!a.isCover && b.isCover) return 1;
    const oa = typeof a.sortOrder === "number" ? a.sortOrder : 9999;
    const ob = typeof b.sortOrder === "number" ? b.sortOrder : 9999;
    return oa - ob;
  });
}

function eventImageSortBoost(img: ItineraryEventImage): number {
  let boost = 0;
  if (img.isCover === true) boost += 5000;
  if (img.isLowResolution === true) boost -= 3000;
  if (img.isThumbnailCandidate === true) boost -= 1000;
  boost += Math.round(scoreImageUrl(img.url));
  return boost;
}

/**
 * 상품 상세 `generateMetadata`·동적 OG(`opengraph-image`/`twitter-image`)가 동일 상품 데이터·이미지 후보를 쓰도록 하는 getter.
 */
export async function getProductSeoData(id: string): Promise<ProductSeoData | null> {
  const rawId = id?.trim();
  if (!rawId) return null;

  const product = await getProductByIdFresh(rawId);
  if (!product || product.is_active === false) return null;

  const siteUrl = getSiteBaseUrl();
  const seenAbs = new Set<string>();
  const entries: OgImageEntry[] = [];
  let itineraryUrlCount = 0;

  function tryAddEntry(raw: string | null | undefined, bucket: number, sortKey: number): boolean {
    if (!raw?.trim()) return false;
    const normalized = normalizeProductImageUrl(raw.trim());
    if (!isRealProductImageUrl(normalized)) return false;
    if (shouldSkipLikelyDecorativeUrl(normalized)) return false;
    const abs = toAbsoluteUrl(siteUrl, normalized);
    if (seenAbs.has(abs)) return false;
    seenAbs.add(abs);
    entries.push({ abs, bucket, sortKey });
    return true;
  }

  function addItineraryEntry(raw: string | null | undefined, sortKey: number): void {
    if (itineraryUrlCount >= MAX_ITINERARY_IMAGE_URLS) return;
    if (tryAddEntry(raw, 2, sortKey)) itineraryUrlCount += 1;
  }

  function absForScore(raw: string): string {
    const normalized = normalizeProductImageUrl(raw.trim());
    return toAbsoluteUrl(siteUrl, normalized);
  }

  // 버킷 0: 갤러리 — 품질 스코어 우선, 동점 시 원래 순서 유지
  if (Array.isArray(product.images_json)) {
    product.images_json.forEach((u, index) => {
      if (!u?.trim()) return;
      const normalized = normalizeProductImageUrl(String(u).trim());
      if (!isRealProductImageUrl(normalized) || shouldSkipLikelyDecorativeUrl(normalized)) return;
      const abs = absForScore(String(u));
      const sc = scoreImageUrl(abs);
      const sortKey = 800_000 + (sc + 200) * 1000 + (500 - Math.min(index, 499));
      tryAddEntry(u, 0, sortKey);
    });
  }

  // 버킷 1: 히어로
  if (product.image_url?.trim()) {
    const sc = Math.round(scoreImageUrl(absForScore(product.image_url)));
    tryAddEntry(product.image_url, 1, 750_000 + (sc + 200) * 1000);
  }

  // 버킷 2: 오버뷰 커버(일정 버킷이지만 일정 URL 카운트에는 포함하지 않음)
  const overviewCover = product.overview_json?.coverImageUrl;
  if (overviewCover?.trim()) {
    const sc = Math.round(scoreImageUrl(absForScore(overviewCover)));
    tryAddEntry(overviewCover, 2, 5_200_000 + sc);
  }

  // 일정 v2
  const v2 = product.itinerary_v2_json;
  if (v2?.days && Array.isArray(v2.days)) {
    v2.days.forEach((day, dayIdx) => {
      if (day.coverImageUrl?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(day.coverImageUrl)));
        addItineraryEntry(day.coverImageUrl, 4_900_000 - dayIdx * 50_000 + sc);
      }
      const events = day.events || [];
      events.forEach((evt, evtIdx) => {
        const imgs = evt.images;
        if (!imgs?.length) return;
        sortEventImagesForOg(imgs).forEach((img, imgIdx) => {
          if (img.isLogoCandidate === true) return;
          const boost = eventImageSortBoost(img);
          addItineraryEntry(
            img.url,
            4_800_000 - dayIdx * 50_000 - evtIdx * 500 - imgIdx + boost,
          );
        });
      });
    });
  }

  // 구조화 일정 (itinerary_days_json)
  const structured = product.itinerary_days_json;
  if (structured && Array.isArray(structured)) {
    structured.forEach((day, dayIdx) => {
      if (day.coverImageUrl?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(String(day.coverImageUrl))));
        addItineraryEntry(String(day.coverImageUrl), 4_850_000 - dayIdx * 50_000 + sc);
      }
      const events = day.events || [];
      events.forEach((evt, evtIdx) => {
        const imgs = evt.images;
        if (!imgs?.length) return;
        sortEventImagesForOg(imgs).forEach((img, imgIdx) => {
          if (img.isLogoCandidate === true) return;
          const boost = eventImageSortBoost(img);
          addItineraryEntry(
            img.url,
            4_750_000 - dayIdx * 50_000 - evtIdx * 500 - imgIdx + boost,
          );
        });
      });
    });
  }

  // 일차별 대표 이미지 맵
  const media = product.itinerary_media_json;
  if (media && typeof media === "object") {
    const keys = Object.keys(media).sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
    for (const key of keys) {
      const raw = media[key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const dayNum = parseInt(key, 10) || 0;
      const sc = Math.round(scoreImageUrl(absForScore(raw)));
      addItineraryEntry(raw, 4_600_000 - dayNum * 10_000 + sc);
    }
  }

  // 버킷 3: taxonomy (항상 목록 끝쪽 폴백으로 추가)
  if (product.destination_id?.trim()) {
    const tax = await getTaxonomyById(product.destination_id.trim());
    if (tax) {
      const card = tax.card_image_url;
      const hero = tax.hero_image_url;
      if (card?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(card)));
        tryAddEntry(card, 3, 1_050_000 + sc);
      }
      if (hero?.trim()) {
        const sc = Math.round(scoreImageUrl(absForScore(hero)));
        tryAddEntry(hero, 3, 1_040_000 + sc);
      }
    }
  }

  entries.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    return b.sortKey - a.sortKey;
  });

  const imageCandidates = entries.map((e) => e.abs);
  const primaryImageUrl = imageCandidates[0] ?? null;

  const themeNames = parseThemeTokens(product.theme);
  const regionName =
    product.overview_region?.trim() || product.category?.trim() || null;

  const seoCopy = resolveProductSeoCopyFromProduct(product);

  let summaryLine = product.one_liner?.trim() || truncateSeo(product.description || "", 100) || null;
  if (!summaryLine && (regionName || themeNames.length > 0)) {
    const themePart = themeNames.slice(0, 2).join(" · ");
    const parts = [regionName, themePart || null].filter(Boolean) as string[];
    if (parts.length > 0) summaryLine = parts.join(" · ");
  }

  const priceLabel =
    typeof product.price === "number" && Number.isFinite(product.price) && product.price > 0
      ? `₩${new Intl.NumberFormat("ko-KR").format(product.price)}~`
      : null;

  const browserTitle =
    product.meta_title?.trim() ||
    `${product.title} | ${product.category} 패키지 | 더올투어`;

  const metaDescriptionFallbackRegion = regionName
    ? `${regionName}에서 즐기는 맞춤형 여행 상품입니다.`
    : "더올투어 맞춤형 여행 상품입니다.";

  const metaDescriptionRaw =
    product.meta_description?.trim() ||
    seoCopy?.description?.trim() ||
    product.one_liner?.trim() ||
    truncateSeo(product.description || "", 155) ||
    metaDescriptionFallbackRegion;

  const metaDescription = truncateSeo(metaDescriptionRaw.replace(/\s+/g, " ").trim(), 155);

  const ogCardSubtitle =
    seoCopy?.ogSubtitle?.trim() || summaryLine?.trim() || "맞춤형 여행";

  return {
    id: product.id,
    name: product.title,
    browserTitle,
    metaDescription,
    regionName,
    themeNames,
    summaryLine,
    priceLabel,
    imageCandidates,
    primaryImageUrl,
    ogCardSubtitle,
  };
}
