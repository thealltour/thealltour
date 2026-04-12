import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";
import { mapProductToTimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { parseBulletLines } from "@/lib/smartstore/smartstoreHtml.helpers";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import type { BlogPostViewModel } from "@/lib/blog/blogPost.types";
import {
  cleanProductTitle,
  cleanScheduleText,
  sanitizeInlineNoise,
  stripBlogRetailNoise,
} from "@/lib/blog/blogPost.sanitize";

function formatPriceKR(price?: number): string {
  if (typeof price !== "number" || !Number.isFinite(price)) return "별도 문의";
  return `${new Intl.NumberFormat("ko-KR").format(price)}원`;
}

function trimOrUndefined(s: string | null | undefined): string | undefined {
  const t = s?.trim();
  return t ? t : undefined;
}

/** PR-BLOG-6: 상품명·카테고리·테마·지역 필드에서 검색용 지역 키워드 추출 */
function extractRegionKeyword(product: Product): string {
  const text = [product.title, product.category, product.theme, product.overview_region]
    .filter(Boolean)
    .join(" ");
  if (text.includes("괌")) return "괌";
  if (text.includes("다낭")) return "다낭";
  if (text.includes("방콕")) return "방콕";
  return "";
}

function defaultDuration(product: Product): string {
  const d = product.duration?.trim();
  if (d) return d;
  return "상세 페이지 기준";
}

function fuelText(product: Product): string | undefined {
  if (product.fuel_included === true) return "유류할증료 포함 안내가 있는 상품입니다.";
  if (product.fuel_included === false) return "유류할증료는 별도일 수 있어 상세에서 확인이 필요합니다.";
  return undefined;
}

function cleanBulletLine(line: string): string {
  return stripBlogRetailNoise(sanitizeInlineNoise(cleanScheduleText(line.trim()))).trim();
}

/** 최대 3개, 근거가 약하면 생략 */
function deriveRecommendedTargets(vm: {
  durationText: string;
  regionText?: string;
  categoryText?: string;
  price?: number;
  includedCount: number;
  optionalCount: number;
  timelineDayCount: number;
}): string[] {
  const out: string[] = [];
  const dur = vm.durationText;
  const longStay =
    /(3|세|삼)\s*개월|2\s*개월|두\s*달|1\s*개월|한\s*달|한달|장기|한달|두달|장기체류/i.test(dur);
  if (longStay) out.push("장기 체류 여행을 찾는 분");

  const regionBlob = `${vm.regionText ?? ""} ${vm.categoryText ?? ""}`;
  if (/휴양|리조트|괌|동남아|발리|푸켓|다낭|세부|보라카이|코타키나발루|호놀룰루|하와이/i.test(regionBlob)) {
    out.push("휴양 중심 여행을 선호하는 분");
  }

  const priceOk = typeof vm.price === "number" && Number.isFinite(vm.price);
  if (priceOk && vm.price! <= 2_500_000 && vm.includedCount >= 2) {
    out.push("가성비 여행을 찾는 분");
  }

  if (vm.optionalCount >= 3 && vm.timelineDayCount >= 2) {
    out.push("일정을 비교한 뒤 선택하고 싶은 분");
  }

  return out.slice(0, 3);
}

/**
 * DB Product + 상세 공지 해석 결과 → 블로그용 ViewModel
 */
export function mapProductToBlogPostViewModel(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): BlogPostViewModel {
  const { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours } =
    resolveProductDetailBodyFields(product);

  const includedLines = parseBulletLines(resolvedIncludedItems).map(cleanBulletLine).filter(Boolean);
  const excludedLines = parseBulletLines(resolvedExcludedItems).map(cleanBulletLine).filter(Boolean);
  const optionalLines = parseBulletLines(resolvedOptionalTours ?? "").map(cleanBulletLine).filter(Boolean);

  const bookingConditionLines = parseBulletLines(notices.bookingConditions).map(cleanBulletLine).filter(Boolean);
  const bookingNotesLines = parseBulletLines(notices.bookingNotes).map(cleanBulletLine).filter(Boolean);
  const travelNotesLines = parseBulletLines(notices.travelNotes).map(cleanBulletLine).filter(Boolean);
  const refundPolicyLines = parseBulletLines(notices.refundPolicy).map(cleanBulletLine).filter(Boolean);

  const timeline = mapProductToTimelineModel(product);

  /** PR-BLOG-7: 본문용 소개는 상품명(title) 폴백 없음 */
  const rawOne =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\r?\n/)[0]?.slice(0, 200)?.trim() ||
    "";
  const oneLiner = stripBlogRetailNoise(sanitizeInlineNoise(cleanScheduleText(rawOne)));

  const regionText = trimOrUndefined(product.theme) ?? trimOrUndefined(product.overview_region);
  const categoryText = trimOrUndefined(product.category);
  const minDeparturePeopleText = trimOrUndefined(product.min_departure_people);

  const heroRaw = getPrimaryImageUrl(product).trim();
  const heroImageUrl = heroRaw ? normalizeProductImageUrl(heroRaw) : undefined;

  const durationText = defaultDuration(product);
  const recommendedTargetLines = deriveRecommendedTargets({
    durationText,
    regionText,
    categoryText,
    price: product.price,
    includedCount: includedLines.length,
    optionalCount: optionalLines.length,
    timelineDayCount: timeline.days.length,
  });

  const seoRegionKeyword = extractRegionKeyword(product);

  return {
    productId: product.id,
    title: cleanProductTitle(product.title),
    oneLiner,
    priceText: formatPriceKR(product.price),
    durationText,
    regionText,
    ...(seoRegionKeyword ? { seoRegionKeyword } : {}),
    categoryText,
    minDeparturePeopleText,
    fuelIncludedText: fuelText(product),
    includedLines,
    excludedLines,
    optionalLines,
    bookingConditionLines,
    bookingNotesLines,
    travelNotesLines,
    refundPolicyLines,
    timeline,
    recommendedTargetLines,
    productUrlPath: `/products/${product.id}`,
    heroImageUrl,
  };
}
