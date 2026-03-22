import { getProductByIdFresh } from "@/lib/products";
import { getTaxonomyById, parseThemeTokens } from "@/lib/productTaxonomies";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getSiteBaseUrl, toAbsoluteUrl } from "@/lib/seo/getSiteSeoDefaults";
import { resolveProductSeoCopyFromProduct } from "@/lib/seo/resolveProductSeoCopy";

const PLACEHOLDER_SUBSTR = "picsum.photos";

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
  /** OG 페인트용 절대 URL, 우선순위 순 (대표 → 갤러리 → 지역 카드 등) */
  imageCandidates: string[];
  /** ProductOgCard 요약 한 줄 (패턴 매칭 ogSubtitle → summaryLine → 고정 fallback) */
  ogCardSubtitle: string;
};

function isRealProductImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.length > 0 && !u.includes(PLACEHOLDER_SUBSTR);
}

function truncateSeo(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function addImageCandidate(
  list: string[],
  seen: Set<string>,
  siteUrl: string,
  raw: string | null | undefined,
) {
  if (!raw?.trim()) return;
  const normalized = normalizeProductImageUrl(raw.trim());
  if (!isRealProductImageUrl(normalized)) return;
  const abs = toAbsoluteUrl(siteUrl, normalized);
  if (seen.has(abs)) return;
  seen.add(abs);
  list.push(abs);
}

/**
 * 상품 상세 `page.tsx`의 generateMetadata와 `opengraph-image`가 동일 데이터를 쓰도록 하는 getter.
 */
export async function getProductSeoData(id: string): Promise<ProductSeoData | null> {
  const rawId = id?.trim();
  if (!rawId) return null;

  const product = await getProductByIdFresh(rawId);
  if (!product || product.is_active === false) return null;

  const siteUrl = getSiteBaseUrl();
  const seen = new Set<string>();
  const imageCandidates: string[] = [];

  if (Array.isArray(product.images_json)) {
    for (const u of product.images_json) {
      addImageCandidate(imageCandidates, seen, siteUrl, u);
    }
  }
  addImageCandidate(imageCandidates, seen, siteUrl, product.image_url);

  if (imageCandidates.length === 0 && product.destination_id?.trim()) {
    const tax = await getTaxonomyById(product.destination_id.trim());
    if (tax) {
      addImageCandidate(imageCandidates, seen, siteUrl, tax.card_image_url);
      addImageCandidate(imageCandidates, seen, siteUrl, tax.hero_image_url);
    }
  }

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
    ogCardSubtitle,
  };
}
