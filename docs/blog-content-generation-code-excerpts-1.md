# 블로그/콘텐츠 자동생성 코드 발췌 1차

==================================================
파일 경로:
`src/lib/blog/blogPost.types.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";

/** PR-BLOG-9: 동일 상품 기준 3종 톤(정보형 / 특가형 / 비교형) */
export type BlogPostType = "info" | "deal" | "compare";

export type BlogPostsThreePack = Record<BlogPostType, string>;

/**
 * 블로그 plain text 조립 전용 ViewModel.
 * 스마트스토어 HTML ViewModel·safety/meta 구조와 분리.
 */
export type BlogPostViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  priceText: string;
  durationText: string;
  regionText?: string;
  /** PR-BLOG-6: 제목·도입·CTA용 지역 키워드(상품 메타에서 추출, 없으면 미설정) */
  seoRegionKeyword?: string;
  categoryText?: string;
  minDeparturePeopleText?: string;
  fuelIncludedText?: string;
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  bookingConditionLines: string[];
  bookingNotesLines: string[];
  travelNotesLines: string[];
  refundPolicyLines: string[];
  timeline: TimelineModel;
  recommendedTargetLines: string[];
  /** 내부 참조용 (상대 경로) */
  productUrlPath: string;
  /** 텍스트 본문에는 넣지 않아도 되는 메타 */
  heroImageUrl?: string;
  /**
   * PR-BLOG-4: 제목·CTA 후보는 `buildBlogPostWithMeta` 결과에 포함됩니다.
   * `mapProductToBlogPostViewModel` 입력 경로에서는 설정하지 않습니다.
   */
  titleCandidates?: string[];
  ctaCandidates?: string[];
};

export type BlogPostBuildMeta = {
  title: string;
  characterCount: number;
  sectionCount: number;
  hasTimelineSummary: boolean;
  hasIncludedSection: boolean;
  hasNoticeSection: boolean;
};

export type BlogPostBuildResult = {
  text: string;
  meta: BlogPostBuildMeta;
  titleCandidates: string[];
  ctaCandidates: string[];
};

export type BlogPostApiResponse =
  | {
      ok: true;
      posts: BlogPostsThreePack;
      metaByType: Record<BlogPostType, BlogPostBuildMeta>;
      titleCandidatesByType: Record<BlogPostType, string[]>;
      ctaCandidates: string[];
    }
  | { ok: false; message: string };
```

[2] 관련 함수 전체

없음

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/blog/buildBlogPostText.ts`, `src/app/api/admin/products/[id]/blog-post/route.ts`, `src/components/admin/products/modals/BlogPostGenerateModal.tsx`에서 사용됩니다.

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/blog/blogPost.constants.ts`
==================================================

[1] 관련 타입 정의 전체

없음

[2] 관련 함수 전체

없음

[3] 호출부 전체

`src/lib/blog/buildBlogPostText.ts`

[4] 관련 상수/템플릿 전체

```ts
/** 섹션 제목 앞에만 사용. 본문 중간·제목 첫 줄에는 사용하지 않음. 전체 5개 이하 유지. */
export const BLOG_SECTION_EMOJI = {
  intro: "📍",
  summary: "✈️",
  notice: "⚠️",
  target: "💬",
  cta: "👉",
} as const;

/** 과장·판매 압박형 표현 — 제목·본문 생성 시 피함 */
export const BLOG_BANNED_AD_PHRASES =
  /지금\s*당장|무조건|역대급|미친\s*특가|지금\s*바로\s*구매|오늘\s*안에|마감\s*임박|결제하세요|지금\s*바로\s*예약|놓치면\s*후회/i;
```

==================================================
파일 경로:
`src/lib/blog/blogPost.sanitize.ts`
==================================================

[1] 관련 타입 정의 전체

없음

[2] 관련 함수 전체

```ts
/**
 * 블로그 plain text 정제 전용 (HTML·스마트스토어 로직과 분리)
 */

/** 상품명·태그 노이즈 제거 */
export function cleanProductTitle(title: string | null | undefined): string {
  const t = (title ?? "")
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t || "상품";
}

/** 목록/카테고리에 쓰기 부적절한 일반 라벨 제거 */
export function cleanCategory(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const t = text.trim();
  if (/액티비티|체험/i.test(t)) return "";
  if (t.includes("/")) return "";
  return t;
}

/** 일정·이벤트 원문에서 안내문·이모지·잡문 제거 */
export function cleanScheduleText(text: string): string {
  if (!text) return "";
  return text
    .replace(/💁.*?(\)|$)/g, "")
    .replace(/📍.*?(\)|$)/g, "")
    .replace(/※.*$/gm, "")
    .replace(/\(.*?입국.*?\)/g, "")
    .replace(/\(.*?수속.*?\)/g, "")
    .replace(/괌 국제공항.*?신고/g, "")
    .replace(/갤럭시.*?항공기에 실을/g, "")
    .replace(/\*.*?\*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 본문·불릿에 섞인 잡 이모지·특수기호 (섹션 헤더용 이모지는 빌더에서 별도 관리) */
export function sanitizeInlineNoise(text: string): string {
  if (!text) return "";
  return text
    .replace(/💁|★|✨|🔥|😍|💥/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function trimText(text: string, max = 30): string {
  const t = text.trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** PR-BLOG-7: 대괄호·괄호·태그형 잡문 제거 (스마트스토어/상품명 노이즈) */
export function stripBlogRetailNoise(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/<.*?>/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 유의사항 원문 → 앞 2줄만 이어 붙여 짧은 요약 */
export function summarizeNotice(text: string): string {
  if (!text?.trim()) return "";
  const merged = text
    .split(/\n/)
    .slice(0, 2)
    .map((line) => sanitizeInlineNoise(line.trim()))
    .filter(Boolean)
    .join(" ");
  return cleanScheduleText(merged);
}
```

[3] 호출부 전체

`src/lib/blog/mapProductToBlogPostViewModel.ts`, `src/lib/blog/buildBlogPostText.ts`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/blog/blogPost.draftEdit.ts`
==================================================

[1] 관련 타입 정의 전체

없음

[2] 관련 함수 전체

```ts
/**
 * 관리자 모달에서 제목·CTA 후보 적용 시 전체 초안 문자열 조작
 */

/** 첫 번째 \n\n 앞을 새 제목으로 교체 */
export function applyBlogTitleCandidate(fullText: string, newTitle: string): string {
  const t = newTitle.trim();
  if (!t) return fullText;
  const idx = fullText.indexOf("\n\n");
  if (idx < 0) return t;
  return t + fullText.slice(idx);
}

const CTA_HEADER_FALLBACK = "👉 최종 조건 확인";

function lastLineIndexStartingWith(lines: string[], prefix: string): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trimStart().startsWith(prefix)) return i;
  }
  return -1;
}

/** 하단(마지막) 👉 CTA 블록 본문을 후보로 교체 — PR-BLOG-8 중간 CTA는 건드리지 않음 */
export function applyBlogCtaCandidate(fullText: string, candidateBody: string): string {
  const body = candidateBody.trim();
  if (!body) return fullText;

  const lines = fullText.split("\n");
  const start = lastLineIndexStartingWith(lines, "👉");

  if (start < 0) {
    const tail = fullText.trimEnd();
    return `${tail}\n\n${CTA_HEADER_FALLBACK}\n\n${body}`;
  }

  const header = lines[start]?.trim() || CTA_HEADER_FALLBACK;
  const before = lines.slice(0, start).join("\n").trimEnd();
  const mid = `${header}\n\n${body}`;
  return [before, mid].filter((p) => p.length > 0).join("\n\n");
}
```

[3] 호출부 전체

```ts
import { applyBlogCtaCandidate, applyBlogTitleCandidate } from "@/lib/blog/blogPost.draftEdit";
```

`src/components/admin/products/modals/BlogPostGenerateModal.tsx` 내부:

```ts
onClick={() =>
  setDraftByType((prev) =>
    prev
      ? { ...prev, [activeType]: applyBlogTitleCandidate(prev[activeType], t) }
      : prev,
  )
}
```

```ts
onClick={() =>
  setDraftByType((prev) =>
    prev
      ? { ...prev, [activeType]: applyBlogCtaCandidate(prev[activeType], c) }
      : prev,
  )
}
```

[4] 관련 상수/템플릿 전체

```ts
const CTA_HEADER_FALLBACK = "👉 최종 조건 확인";
```

==================================================
파일 경로:
`src/lib/blog/postProcessText.ts`
==================================================

[1] 관련 타입 정의 전체

없음

[2] 관련 함수 전체

```ts
/**
 * PR-BLOG-10·11: 블로그 plain text 최종 출력 직전 교정 (생성 로직과 분리)
 */

import type { BlogPostType } from "@/lib/blog/blogPost.types";

/** 긴 패턴 우선 적용 권장 */
const BASE_REPLACEMENTS: [RegExp, string][] = [
  [/한 번 확인해보시는 것을 추천드립니다\./g, "확인해보시는 것을 추천드립니다."],
  [/한 번 확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/체크해볼 필요가 있습니다/g, "확인해볼 만합니다"],
  [/원면/g, "원 수준이면"],
  /** '정리보면' → '정리보면' (해 탈락형 오타) */
  [/\uC815\uB9AC\uBCF4\uBA74/g, "\uC815\uB9AC\uD574\uBCF4\uBA74"],
  [/기준으로 보면 되고,/g, "기준으로 보면,"],
];

function applyBaseReplacements(s: string): string {
  let out = s;
  for (const [re, to] of BASE_REPLACEMENTS) {
    out = out.replace(re, to);
  }
  return out;
}

/**
 * PR-BLOG-11: `991,000원` 형태 → `99만원대` (1만원 미만·비숫자 원문은 유지)
 */
function formatWonPricesToManWon(text: string): string {
  return text.replace(/(\d{1,3}(?:,\d{3})*)원/g, (full, grp: string) => {
    const num = Number(String(grp).replace(/,/g, ""));
    if (!Number.isFinite(num) || num < 10_000) return full;
    const man = Math.floor(num / 10_000);
    return `${man}만원대`;
  });
}

/** `99만원대 수준이면` → 읽기 자연스러운 `99만원대라면` */
function softenManWonFollowup(s: string): string {
  return s.replace(/만원대 수준이면/g, "만원대라면");
}

/** 줄 단위 공백만 정리 (개행은 유지) */
function collapseHorizontalSpaceByLine(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " "))
    .join("\n");
}

const URL_LINE = /^https?:\/\//i;

function dedupeNonUrlLines(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (URL_LINE.test(trimmed)) {
      out.push(line);
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(line);
  }

  return out.join("\n");
}

/** `👉 …조건 확인` / `👉 비교 기준 확인` 직전 보조 문장 */
function insertBeforeCtaHeadLines(s: string): string {
  const helper = "조건을 기준으로 한 번 비교해보시는 것이 좋습니다.";
  return s.replace(/^👉 .*(?:조건 확인|비교 기준 확인)\s*$/gm, (line) => `${helper}\n\n${line}`);
}

function applyTypeSpecific(s: string, type: BlogPostType): string {
  let result = s;

  if (type === "deal") {
    result = result.replace(/조건을 한 번 확인해볼 만합니다/g, "조건을 한 번 확인해볼 만한 가격대입니다");
  }

  if (type === "info") {
    result = result.replace(
      /조건을 확인해보는 분들을 위해 정리했습니다\./g,
      "조건을 확인해보는 분들을 위해 핵심 기준만 정리했습니다.",
    );
  }

  if (type === "compare") {
    if (!result.includes("체감 가격 차이")) {
      result = result.replace(
        /^👉 비교 기준 확인\s*$/gm,
        "같은 기간 기준으로 보면 포함 조건에 따라 체감 가격 차이가 생길 수 있습니다.\n\n👉 비교 기준 확인",
      );
    }
  }

  return result;
}

/**
 * PR-BLOG-11 (선택): `priceText` 등에서 숫자만 추출해 만원대 문자열
 */
export function toManPriceBandFromPriceText(priceText: string): string | null {
  const num = Number(String(priceText).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(num) || num < 10_000) return null;
  const man = Math.floor(num / 10_000);
  return `${man}만원대`;
}

export function postProcessText(text: string, type: BlogPostType): string {
  if (!text) return "";

  let result = applyBaseReplacements(text);
  result = formatWonPricesToManWon(result);
  result = softenManWonFollowup(result);
  result = applyTypeSpecific(result, type);
  result = insertBeforeCtaHeadLines(result);
  result = collapseHorizontalSpaceByLine(result);
  result = dedupeNonUrlLines(result);

  return result.trim();
}
```

[3] 호출부 전체

`src/lib/blog/buildBlogPostText.ts`

[4] 관련 상수/템플릿 전체

```ts
const BASE_REPLACEMENTS: [RegExp, string][] = [
  [/한 번 확인해보시는 것을 추천드립니다\./g, "확인해보시는 것을 추천드립니다."],
  [/한 번 확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/체크해볼 필요가 있습니다/g, "확인해볼 만합니다"],
  [/원면/g, "원 수준이면"],
  [/\uC815\uB9AC\uBCF4\uBA74/g, "\uC815\uB9AC\uD574\uBCF4\uBA74"],
  [/기준으로 보면 되고,/g, "기준으로 보면,"],
];

const URL_LINE = /^https?:\/\//i;
```

==================================================
파일 경로:
`src/lib/blog/mapProductToBlogPostViewModel.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import type { BlogPostViewModel } from "@/lib/blog/blogPost.types";
```

[2] 관련 함수 전체

```ts
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
```

[3] 호출부 전체

```ts
const notices = await resolveProductNoticesForDetailPage(product);
const vm = mapProductToBlogPostViewModel(product, notices);
const bundle = buildBlogPostBundle(vm);
```

위 호출은 `src/app/api/admin/products/[id]/blog-post/route.ts`에서 사용됩니다.

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/lib/blog/buildBlogPostText.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type {
  BlogPostViewModel,
  BlogPostBuildMeta,
  BlogPostBuildResult,
  BlogPostType,
  BlogPostsThreePack,
} from "@/lib/blog/blogPost.types";
```

[2] 관련 함수 전체

```ts
import type {
  BlogPostViewModel,
  BlogPostBuildMeta,
  BlogPostBuildResult,
  BlogPostType,
  BlogPostsThreePack,
} from "@/lib/blog/blogPost.types";
import { postProcessText } from "@/lib/blog/postProcessText";
import { BLOG_SECTION_EMOJI, BLOG_BANNED_AD_PHRASES } from "@/lib/blog/blogPost.constants";
import {
  cleanCategory,
  cleanScheduleText,
  sanitizeInlineNoise,
  stripBlogRetailNoise,
} from "@/lib/blog/blogPost.sanitize";

const MAX_INCLUDED = 4;
const MAX_EXCLUDED = 3;
const MAX_SCHEDULE_DAYS = 3;
const MAX_SCHEDULE_HUMAN_LINES = 3;

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
}

/** 블로그·SNS 복붙용 절대 URL (단독 줄로 노출) */
export function buildProductUrl(vm: BlogPostViewModel): string {
  return `${siteOrigin()}/products/${vm.productId}`;
}

function scrubAdTone(s: string): string {
  if (BLOG_BANNED_AD_PHRASES.test(s)) {
    return s.replace(BLOG_BANNED_AD_PHRASES, "조건");
  }
  return s;
}

/** PR-BLOG-7: 일정 원문 → 자연어 한 줄(매칭 없으면 생략) */
function humanizeSchedule(text: string): string {
  if (!text) return "";
  if (text.includes("공항")) {
    return "첫 일정에서는 현지 도착 후 이동 및 체크인 흐름이 포함될 수 있습니다.";
  }
  if (text.includes("리조트") || /자유\s*시간|자유시간/i.test(text)) {
    return "현지에서는 리조트 이용 및 자유시간 중심 일정으로 구성될 수 있습니다.";
  }
  return "";
}

function uniqueLines(lines: string[]): string[] {
  return [...new Set(lines.filter(Boolean))];
}

/** 지역·SEO 우선 (카테고리는 액티비티/체험 등 노이즈 제거) */
export function resolveRegion(vm: BlogPostViewModel): string {
  const r = vm.regionText?.trim();
  if (r) return r;
  const cat = cleanCategory(vm.categoryText);
  if (cat) return cat;
  return "여행";
}

/** PR-BLOG-6: 추출된 지역 키워드 우선, 없으면 resolveRegion */
export function seoDisplayRegion(vm: BlogPostViewModel): string {
  const kw = vm.seoRegionKeyword?.trim();
  if (kw) return kw;
  return resolveRegion(vm);
}

function durationForTitle(vm: BlogPostViewModel): string {
  const d = vm.durationText?.trim() || "";
  if (!d || d === "상세 페이지 기준") return "";
  return d;
}

/** PR-BLOG-6: 검색형 제목 후보 3개 (지역·기간·포함 조건 중심) */
export function buildTitleCandidates(vm: BlogPostViewModel): string[] {
  const region = seoDisplayRegion(vm);
  const dur = durationForTitle(vm);

  const raw = dur
    ? [
        `${region} 여행 ${dur}, 포함 조건 기준으로 정리`,
        `${region} ${dur} 패키지, 실제 조건 확인`,
        `${region} 여행 상품 ${dur}, 가격과 일정 흐름 정리`,
      ]
    : [
        `${region} 여행, 포함 조건 기준으로 정리`,
        `${region} 패키지, 실제 조건 확인`,
        `${region} 여행 상품, 가격과 일정 흐름 정리`,
      ];

  const t1 = scrubAdTone(raw[0]!.replace(/\s{2,}/g, " ").trim());
  let t2 = scrubAdTone(raw[1]!.replace(/\s{2,}/g, " ").trim());
  let t3 = scrubAdTone(raw[2]!.replace(/\s{2,}/g, " ").trim());

  if (t2 === t1) {
    t2 = scrubAdTone(`${region} 출발 상품, 포함 조건 기준으로 정리`.replace(/\s{2,}/g, " ").trim());
  }
  if (t3 === t1 || t3 === t2) {
    t3 = scrubAdTone(`${region} 여행 상품, 조건 위주로 정리`.replace(/\s{2,}/g, " ").trim());
  }
  if (t3 === t1 || t3 === t2) {
    t3 = scrubAdTone(`${region} 여행, 상세 전에 보기 좋은 요약`.replace(/\s{2,}/g, " ").trim());
  }

  return [t1, t2, t3];
}

/** PR-BLOG-9: 타입별 제목 후보 (정보형은 기존 SEO 3종) */
export function buildTitleCandidatesForType(vm: BlogPostViewModel, type: BlogPostType): string[] {
  if (type === "info") return buildTitleCandidates(vm);
  const region = seoDisplayRegion(vm);
  const dur = durationForTitle(vm);
  const p = vm.priceText;
  if (type === "deal") {
    const raw = dur
      ? [
          `${region} 여행 ${dur}, ${p} 기준 특가형으로 살펴본 조건 정리`,
          `${region} ${dur} 패키지 ${p}, 가격 부담이 어떤지 확인할 만한 요약`,
          `${region} 여행 상품 ${dur}, 특가 느낌으로 본 포함 조건 체크`,
        ]
      : [
          `${region} 여행 ${p} 기준 특가형으로 살펴본 조건 정리`,
          `${region} 패키지 ${p}, 가격 부담이 어떤지 확인할 만한 요약`,
          `${region} 여행 상품, 특가 느낌으로 본 포함 조건 체크`,
        ];
    const t1 = scrubAdTone(raw[0]!.replace(/\s{2,}/g, " ").trim());
    let t2 = scrubAdTone(raw[1]!.replace(/\s{2,}/g, " ").trim());
    let t3 = scrubAdTone(raw[2]!.replace(/\s{2,}/g, " ").trim());
    if (t2 === t1) {
      t2 = scrubAdTone(`${region} ${dur || "여행"} 조건을 가격 위주로 한 번만 더 정리`.trim());
    }
    if (t3 === t1 || t3 === t2) {
      t3 = scrubAdTone(`${region} 출발 상품, 특가형 시선으로 포함만 짚기`.trim());
    }
    if (t3 === t1 || t3 === t2) {
      t3 = scrubAdTone(`${region} 여행 ${p}, 링크 전에 보는 짧은 체크`.trim());
    }
    return [t1, t2, t3];
  }
  const raw = dur
    ? [
        `${region} 여행 ${dur} 패키지, 비교할 때 보면 좋은 포함 조건`,
        `${region} ${dur} 상품, 타 상품 대비 조건을 가볍게 정리`,
        `${region} 여행 ${dur}, 비교 관점에서 본 일정·포함 체크`,
      ]
    : [
        `${region} 여행 패키지, 비교할 때 보면 좋은 포함 조건`,
        `${region} 상품, 타 상품 대비 조건을 가볍게 정리`,
        `${region} 여행, 비교 관점에서 본 일정·포함 체크`,
      ];
  const t1 = scrubAdTone(raw[0]!.replace(/\s{2,}/g, " ").trim());
  let t2 = scrubAdTone(raw[1]!.replace(/\s{2,}/g, " ").trim());
  let t3 = scrubAdTone(raw[2]!.replace(/\s{2,}/g, " ").trim());
  if (t2 === t1) {
    t2 = scrubAdTone(`${region} ${dur || "일정"} 기준으로, 비교 포인트만 한 번 더`.trim());
  }
  if (t3 === t1 || t3 === t2) {
    t3 = scrubAdTone(`${region} 출발 상품, 비교 시 포함 위주로 짧게 정리`.trim());
  }
  if (t3 === t1 || t3 === t2) {
    t3 = scrubAdTone(`${region} 여행 상품, 판단 전에 보기 좋은 요약`.trim());
  }
  return [t1, t2, t3];
}

export function buildTitleForType(vm: BlogPostViewModel, type: BlogPostType): string {
  const [first] = buildTitleCandidatesForType(vm, type);
  return first ?? "";
}

/** CTA 본문 후보 3개 (👉 블록 안에 들어갈 문단, URL 단독 줄 포함) */
export function buildCtaCandidates(vm: BlogPostViewModel): string[] {
  const url = buildProductUrl(vm);
  return [
    scrubAdTone(`아래 링크에서 실제 조건을 확인해보시는 것을 추천드립니다.\n\n${url}`),
    scrubAdTone(`포함 사항과 일정은 아래 링크에서 확인 가능합니다.\n\n${url}`),
    scrubAdTone(`상품 상세와 문의는 아래 링크에서 확인 가능합니다.\n\n${url}`),
  ];
}

/** 첫 줄: 정보형 제목 후보 1번 (SEO 패턴) */
export function buildBlogTitleLine(vm: BlogPostViewModel): string {
  return buildTitleForType(vm, "info");
}

/** PR-BLOG-8: 도입 후킹 (상단 훅과 이어지는 톤) */
export function buildIntroParagraph(vm: BlogPostViewModel): string {
  const region = seoDisplayRegion(vm);
  const lead =
    region === "여행"
      ? "여행 상품을 기준으로 보면, 이 가격대에서 이 구성은 한 번 조건을 확인해볼 만한 수준입니다."
      : `${region} 여행 기준으로 보면, 이 가격대에서 이 구성은 한 번 조건을 확인해볼 만한 수준입니다.`;
  const s2 = "간단하게 핵심만 정리보면 아래와 같습니다.";
  return scrubAdTone([lead, s2].join("\n\n"));
}

/** PR-BLOG-9.1: 정보형 상단 — 검색·요약용 카피 + 2줄 훅 (다른 타입과 문구 분리) */
function buildInfoSearchLeadBlock(vm: BlogPostViewModel): string {
  const r = seoDisplayRegion(vm);
  const dur = vm.durationText;
  const p = vm.priceText;
  const open =
    r === "여행"
      ? `여행 상품을 ${dur} 기준으로 비용과 조건을 확인해보는 분들을 위해 정리했습니다.`
      : `${r} 여행 ${dur} 기준 비용과 조건을 확인해보는 분들을 위해 정리했습니다.`;
  const bullets = `✔ ${dur}\n✔ 약 ${p}`;
  const bridge =
    r === "여행"
      ? "여행 비용은 구성에 따라 차이가 있기 때문에, 아래 조건을 기준으로 보면 이해가 쉽습니다."
      : `${r} 여행 비용은 구성에 따라 차이가 있기 때문에, 아래 조건을 기준으로 보면 이해가 쉽습니다.`;
  return scrubAdTone(`${open}\n\n${bullets}\n\n${bridge}`.trim());
}

/** PR-BLOG-9.1: 특가형 상단 — 짧은 후킹 + 훅 3줄 */
function buildDealLeadBlock(vm: BlogPostViewModel): string {
  const r = seoDisplayRegion(vm);
  const open = scrubAdTone(
    `${r} ${vm.durationText} 기준인데 ${vm.priceText}면 조건을 한 번 체크해볼 필요가 있습니다.`
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
  const bullets = `✔ ${vm.durationText}\n✔ ${vm.priceText}\n✔ 항공 + 숙박 포함`;
  const bridge = scrubAdTone("이 가격대라면 실제 포함 조건이 중요한 구간입니다.");
  return `${open}\n\n${bullets}\n\n${bridge}`;
}

/** PR-BLOG-9.1: 특가형 중간 CTA (문구·헤더 정보형과 분리) */
function buildDealMidCtaCompact(vm: BlogPostViewModel): string {
  const url = buildProductUrl(vm);
  return scrubAdTone(
    `👉 중간 확인

${url}

조건이 괜찮은 편인지 아래에서 확인해보는 것이 좋습니다.`,
  ).trim();
}

/** PR-BLOG-9.1: 비교형 상단 — 비교 프레임 + 훅 2줄 + 해석 */
function buildCompareLeadBlock(vm: BlogPostViewModel): string {
  const r = seoDisplayRegion(vm);
  const open =
    r === "여행"
      ? "여행 상품을 비교 기준으로 보면 이 상품이 어느 정도인지 판단이 필요한 구성입니다."
      : `${r} 여행 상품을 비교 기준으로 보면 이 상품이 어느 정도인지 판단이 필요한 구성입니다.`;
  const bullets = `✔ ${vm.durationText}\n✔ 약 ${vm.priceText}`;
  const mid = scrubAdTone("같은 기간 기준으로 보면 포함 조건에 따라 가격 차이가 나는 구조입니다.");
  return scrubAdTone(`${open}\n\n${bullets}\n\n${mid}`);
}

function buildCompareJudgmentLine(): string {
  return scrubAdTone("이 조건 기준이면 나쁘지 않은 편으로 볼 수도 있습니다.");
}

/** PR-BLOG-9.1: 비교형 하단 링크 (최종 CTA 블록과 문구 분리) */
function buildCompareFooterCta(vm: BlogPostViewModel): string {
  const url = buildProductUrl(vm);
  return scrubAdTone(
    `👉 비교 기준 확인

${url}

실제 조건을 기준으로 판단하는 것이 중요합니다.`,
  ).trim();
}

export function buildIncludedExcludedSection(
  vm: BlogPostViewModel,
  tone: "info" | "compare" = "info",
): string {
  const head = "포함·불포함 안내";
  const chunks: string[] = [];

  if (vm.includedLines.length > 0) {
    const incIntro =
      tone === "compare"
        ? "비교 판단에는 포함 범위가 핵심이라, 아래는 실제 안내에서 발췌한 일부입니다."
        : "포함 항목은 항공과 숙박 등 기본 구성이 포함되는 형태인 경우가 많지만, 상품마다 다를 수 있어 아래는 일부만 적었습니다.";
    const take = vm.includedLines.slice(0, MAX_INCLUDED);
    const lines = take.map((l) => `• ${stripBlogRetailNoise(sanitizeInlineNoise(l))}`).join("\n");
    const more =
      vm.includedLines.length > MAX_INCLUDED
        ? "\n(나머지 포함 내용은 상품 상세페이지에서 확인해 주세요.)"
        : "";
    chunks.push(`${incIntro}\n${lines}${more}`);
  }

  if (vm.excludedLines.length > 0) {
    const excIntro =
      tone === "compare"
        ? "빠지는 항목도 함께 보면 비교가 명확해집니다. 일부만 옮겼습니다."
        : "불포함으로 안내되는 항목 중 일부는 다음과 같습니다.";
    const take = vm.excludedLines.slice(0, MAX_EXCLUDED);
    const lines = take.map((l) => `• ${stripBlogRetailNoise(sanitizeInlineNoise(l))}`).join("\n");
    const more =
      vm.excludedLines.length > MAX_EXCLUDED
        ? "\n(추가 불포함 항목은 상세페이지에서 함께 확인하는 것이 좋습니다.)"
        : "";
    chunks.push(`${excIntro}\n${lines}${more}`);
  }

  if (vm.optionalLines.length > 0) {
    chunks.push(
      tone === "compare"
        ? "옵션·선택 관광은 상품마다 다르니, 비교 시에는 상세 안내를 함께 보는 편이 좋습니다."
        : "선택 관광·옵션은 별도 안내될 수 있으니, 관심 있으면 상세페이지에서 함께 확인해 주세요.",
    );
  }

  if (chunks.length === 0) return "";
  return `${head}\n\n${chunks.join("\n\n")}`;
}

const SCHEDULE_SCROLL_HINT =
  "이 부분은 실제 일정에 따라 달라질 수 있으니 아래에서 확인해보시는 것이 좋습니다.";

export function buildScheduleSection(vm: BlogPostViewModel): string {
  const head = "일정 요약";
  const days = vm.timeline?.days ?? [];
  if (days.length === 0) {
    return `${head}\n\n구조화된 일정 요약을 자동으로 만들기 어려워, 상세 일정은 상품 상세페이지에서 확인하는 것이 좋습니다.\n\n${SCHEDULE_SCROLL_HINT}`;
  }

  const humanized: string[] = [];
  const slice = days.slice(0, MAX_SCHEDULE_DAYS);
  for (const d of slice) {
    const ev = d.events?.[0];
    if (!ev) continue;
    const combined = [ev.heading, ev.description].filter(Boolean).join(" ");
    const cleaned = stripBlogRetailNoise(cleanScheduleText(combined));
    const line = humanizeSchedule(cleaned);
    if (line) humanized.push(line);
  }

  const unique = uniqueLines(humanized).slice(0, MAX_SCHEDULE_HUMAN_LINES);

  const footer =
    "현지 사정에 따라 순서나 내용은 달라질 수 있으니, 확정 일정은 상담·상세 안내를 기준으로 보시면 됩니다.";

  if (unique.length === 0) {
    return `${head}\n\n일정 구성은 상품마다 달라질 수 있어, 구체적인 일정은 상품 상세페이지에서 확인하는 것이 좋습니다.\n\n${SCHEDULE_SCROLL_HINT}`;
  }

  return `${head}\n\n${unique.join("\n\n")}\n\n${footer}\n\n${SCHEDULE_SCROLL_HINT}`;
}

export function buildRecommendedTargetSection(vm: BlogPostViewModel): string {
  if (vm.recommendedTargetLines.length === 0) return "";
  const head = `${BLOG_SECTION_EMOJI.target} 이런 분께 참고`;
  const lines = vm.recommendedTargetLines
    .map((l) => `• ${stripBlogRetailNoise(sanitizeInlineNoise(l))}`)
    .join("\n");
  return `${head}\n\n${lines}`;
}

export function buildCtaSection(vm: BlogPostViewModel): string {
  const region = seoDisplayRegion(vm);
  const ctaLabel = region === "여행" ? "최종 조건 확인" : `${region} 여행 최종 조건 확인`;
  const head = `${BLOG_SECTION_EMOJI.cta} ${ctaLabel}`;
  const url = buildProductUrl(vm);
  return scrubAdTone(
    `${head}

아래 링크에서 실제 상품 조건을 확인해보시는 것을 추천드립니다.

${url}


포함 범위, 일정, 가격 조건은 상세페이지에서 한 번 더 확인하시는 것이 좋습니다.
궁금한 점은 홈페이지 문의를 통해 안내받으실 수 있습니다.`,
  );
}

export function buildIntroSection(vm: BlogPostViewModel): string {
  const body = buildIntroParagraph(vm);
  return `${BLOG_SECTION_EMOJI.intro} 들어가며\n\n${body}`;
}

function buildRawBlocksForType(vm: BlogPostViewModel, type: BlogPostType): string[] {
  switch (type) {
    case "info":
      return [
        buildTitleForType(vm, "info"),
        buildInfoSearchLeadBlock(vm),
        buildScheduleSection(vm),
        buildIncludedExcludedSection(vm, "info"),
        buildCtaSection(vm),
      ].filter((s) => s.trim().length > 0);
    case "deal":
      return [
        buildTitleForType(vm, "deal"),
        buildDealLeadBlock(vm),
        buildDealMidCtaCompact(vm),
        buildCtaSection(vm),
      ];
    case "compare":
      return [
        buildTitleForType(vm, "compare"),
        buildCompareLeadBlock(vm),
        buildIncludedExcludedSection(vm, "compare"),
        buildCompareJudgmentLine(),
        buildCompareFooterCta(vm),
      ].filter((s) => s.trim().length > 0);
  }
}

/** PR-BLOG-9: 단일 타입 전체 결과(메타·후보 포함) */
export function buildBlogPostBuildResultForType(
  vm: BlogPostViewModel,
  type: BlogPostType,
): BlogPostBuildResult {
  const blocks = buildRawBlocksForType(vm, type);
  const rawText = blocks.map(polishSectionBlock).join("\n\n");
  const text = postProcessText(rawText, type);
  const firstBodyLine = text.split(/\n/).find((l) => l.trim().length > 0) ?? "";
  const hasTimelineDays = vm.timeline.days.length > 0;
  const scheduleText = buildScheduleSection(vm);
  const hasTimelineSummary =
    type === "info" &&
    hasTimelineDays &&
    !scheduleText.includes("구조화된 일정 요약을 자동으로 만들기 어려워");
  const hasIncludedSection =
    (type === "info" || type === "compare") &&
    (vm.includedLines.length > 0 || vm.excludedLines.length > 0 || vm.optionalLines.length > 0);

  const meta: BlogPostBuildMeta = {
    title: sanitizeInlineNoise(firstBodyLine),
    characterCount: text.length,
    sectionCount: blocks.filter((b) => b.trim()).length,
    hasTimelineSummary,
    hasIncludedSection,
    hasNoticeSection: false,
  };

  return {
    text,
    meta,
    titleCandidates: buildTitleCandidatesForType(vm, type).map((c) => postProcessText(c, type)),
    ctaCandidates: buildCtaCandidates(vm).map((c) => postProcessText(c, type)),
  };
}

export function buildBlogPostBundle(vm: BlogPostViewModel): {
  posts: BlogPostsThreePack;
  metaByType: Record<BlogPostType, BlogPostBuildMeta>;
  titleCandidatesByType: Record<BlogPostType, string[]>;
  ctaCandidates: string[];
} {
  const info = buildBlogPostBuildResultForType(vm, "info");
  const deal = buildBlogPostBuildResultForType(vm, "deal");
  const compare = buildBlogPostBuildResultForType(vm, "compare");
  return {
    posts: { info: info.text, deal: deal.text, compare: compare.text },
    metaByType: { info: info.meta, deal: deal.meta, compare: compare.meta },
    titleCandidatesByType: {
      info: info.titleCandidates,
      deal: deal.titleCandidates,
      compare: compare.titleCandidates,
    },
    ctaCandidates: info.ctaCandidates,
  };
}

/** 본문 줄바꿈 유지하며 줄 단위로 잡음 제거 (PR-BLOG-7) */
function polishInlineMultiline(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => sanitizeInlineNoise(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 섹션: 첫 줄은 제목, 나머지는 다줄 본문으로 정제 */
function polishSectionBlock(block: string): string {
  const lines = block.split("\n");
  const first = (lines[0] ?? "").trimEnd();
  const rest = lines.slice(1).join("\n").replace(/^\n+/, "");
  if (!rest.trim()) {
    return /^[📍✈️⚠️💬👉]\s/.test(first) ? first : sanitizeInlineNoise(first);
  }
  const cleanedFirst = /^[📍✈️⚠️💬👉]\s/.test(first) ? first : sanitizeInlineNoise(first);
  return `${cleanedFirst}\n\n${polishInlineMultiline(rest)}`;
}

/** 정보형(PR-BLOG-9) 기준 단일 빌드 — 하위 호환·단위 테스트용 */
export function buildBlogPostWithMeta(vm: BlogPostViewModel): BlogPostBuildResult {
  return buildBlogPostBuildResultForType(vm, "info");
}

export function buildBlogPostText(vm: BlogPostViewModel, type: BlogPostType = "info"): string {
  return buildBlogPostBuildResultForType(vm, type).text;
}
```

[3] 호출부 전체

`src/app/api/admin/products/[id]/blog-post/route.ts`

```ts
const bundle = buildBlogPostBundle(vm);
return NextResponse.json({ ok: true, ...bundle });
```

[4] 관련 상수/템플릿 전체

```ts
const MAX_INCLUDED = 4;
const MAX_EXCLUDED = 3;
const MAX_SCHEDULE_DAYS = 3;
const MAX_SCHEDULE_HUMAN_LINES = 3;

const SCHEDULE_SCROLL_HINT =
  "이 부분은 실제 일정에 따라 달라질 수 있으니 아래에서 확인해보시는 것이 좋습니다.";
```

==================================================
파일 경로:
`src/app/api/admin/products/[id]/blog-post/route.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { BlogPostApiResponse } from "@/lib/blog/blogPost.types";
```

[2] 관련 함수 전체

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { mapProductToBlogPostViewModel } from "@/lib/blog/mapProductToBlogPostViewModel";
import { buildBlogPostBundle } from "@/lib/blog/buildBlogPostText";
import type { BlogPostApiResponse } from "@/lib/blog/blogPost.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<BlogPostApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<BlogPostApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId) {
    return NextResponse.json({ ok: false, message: "상품 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const product = await getProductByIdFresh(rawId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const vm = mapProductToBlogPostViewModel(product, notices);
    const bundle = buildBlogPostBundle(vm);

    return NextResponse.json({ ok: true, ...bundle });
  } catch (e) {
    console.error("[api/admin/products/[id]/blog-post]", e);
    return NextResponse.json(
      { ok: false, message: "블로그 텍스트 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
```

[3] 호출부 전체

`src/components/admin/products/modals/BlogPostGenerateModal.tsx`

```ts
const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/blog-post`, {
  method: "GET",
  credentials: "same-origin",
});
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/modals/blogPostModal.types.ts`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { BlogPostBuildMeta, BlogPostType, BlogPostsThreePack } from "@/lib/blog/blogPost.types";

export type BlogPostGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  onCopied?: () => void;
};

export type BlogPostModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      posts: BlogPostsThreePack;
      metaByType: Record<BlogPostType, BlogPostBuildMeta>;
      titleCandidatesByType: Record<BlogPostType, string[]>;
      ctaCandidates: string[];
    };
```

[2] 관련 함수 전체

없음

[3] 호출부 전체

`src/components/admin/products/modals/BlogPostGenerateModal.tsx`

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/modals/BlogPostGenerateModal.tsx`
==================================================

[1] 관련 타입 정의 전체

```ts
import type { BlogPostGenerateModalProps, BlogPostModalFetchState } from "./blogPostModal.types";
import type { BlogPostApiResponse, BlogPostType, BlogPostsThreePack } from "@/lib/blog/blogPost.types";
```

[2] 관련 함수 전체

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Copy, RefreshCw, X } from "lucide-react";
import type { BlogPostGenerateModalProps, BlogPostModalFetchState } from "./blogPostModal.types";
import type { BlogPostApiResponse, BlogPostType, BlogPostsThreePack } from "@/lib/blog/blogPost.types";
import { applyBlogCtaCandidate, applyBlogTitleCandidate } from "@/lib/blog/blogPost.draftEdit";

const ADMIN_EDIT_TIPS: string[] = [
  "첫 문장(제목 후보)을 브랜드 톤에 맞게 다듬으면 읽기 흐름이 좋아질 수 있습니다.",
  "가격·기간·포함 조건은 실제 상세페이지와 대조해 숫자·표현을 보정해 주세요.",
  "CTA 문장은 운영 방침에 맞게 한 번 손봐도 좋습니다.",
];

const candidateBtnClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm leading-snug text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30";

const BLOG_POST_TABS: { id: BlogPostType; label: string }[] = [
  { id: "info", label: "정보형" },
  { id: "deal", label: "특가형" },
  { id: "compare", label: "비교형" },
];

export default function BlogPostGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: BlogPostGenerateModalProps) {
  const [state, setState] = useState<BlogPostModalFetchState>({ status: "idle" });
  const [activeType, setActiveType] = useState<BlogPostType>("info");
  const [draftByType, setDraftByType] = useState<BlogPostsThreePack | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    setCopyHint(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/blog-post`, {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as BlogPostApiResponse;
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : `요청 실패 (${res.status})`,
        });
        return;
      }
      setState({
        status: "ok",
        posts: data.posts,
        metaByType: data.metaByType,
        titleCandidatesByType: data.titleCandidatesByType,
        ctaCandidates: data.ctaCandidates,
      });
      setDraftByType(data.posts);
      setActiveType("info");
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setState({ status: "idle" });
        setDraftByType(null);
        setActiveType("info");
        setCopyHint(null);
      });
      return;
    }
    queueMicrotask(() => {
      void load();
    });
  }, [open, load]);

  const currentDraft = draftByType?.[activeType] ?? "";

  const handleCopyBody = async () => {
    if (state.status !== "ok" || !draftByType) return;
    try {
      await navigator.clipboard.writeText(currentDraft);
      const label = BLOG_POST_TABS.find((t) => t.id === activeType)?.label ?? "";
      setCopyHint(`${label} 본문이 클립보드에 복사되었습니다.`);
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 아래 영역에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  const meta = state.status === "ok" ? state.metaByType[activeType] : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blog-post-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="blog-post-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <BookOpen className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              블로그 텍스트 생성
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              동일 상품 기준 정보형·특가형·비교형 3종이 생성됩니다. 미리보기·HTML·Markdown은 포함되지 않습니다.
            </p>
            <p className="mt-1 truncate text-sm text-[var(--text-secondary)]" title={productTitle}>
              {productTitle || "(제목 없음)"}
              {productId ? (
                <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">· {productId}</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {state.status === "loading" ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">텍스트를 생성하는 중입니다…</div>
        ) : null}

        {state.status === "error" ? (
          <div className="mx-4 my-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {state.message}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-2 font-semibold underline-offset-2 hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {state.status === "ok" && meta ? (
          <>
            <div className="shrink-0 space-y-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                <li>
                  서버 생성 글자 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {meta.characterCount.toLocaleString("ko-KR")}
                  </span>
                </li>
                <li>
                  현재 탭 편집 글자 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {currentDraft.length.toLocaleString("ko-KR")}
                  </span>
                </li>
                <li>
                  본문 블록 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">{meta.sectionCount}</span>
                </li>
                <li>일정 요약 반영: {meta.hasTimelineSummary ? "예" : "아니오(안내 위주)"}</li>
                <li>포함·불포함 블록: {meta.hasIncludedSection ? "있음" : "생략 또는 요약만"}</li>
                <li>유의사항 블록: 생성 본문에 포함하지 않음</li>
              </ul>
              <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-snug text-[var(--text-muted)]">
                탭마다 톤이 다릅니다. 네이버 블로그에 붙여넣은 뒤{" "}
                <span className="font-medium text-[var(--text-primary)]">1차 수정</span>을 권장합니다. 제목·CTA 후보는{" "}
                <span className="font-medium text-[var(--text-primary)]">현재 탭</span> 본문에만 반영됩니다.
              </p>
              <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                ※ 본 글은 유입용 요약입니다. 상세 조건은 반드시 링크에서 확인하세요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {BLOG_POST_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveType(tab.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 ${
                      activeType === tab.id
                        ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleCopyBody()}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  현재 탭 복사
                </button>
              </div>

              <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">제목 후보 (현재 탭)</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 현재 탭 본문의 첫 줄(제목)만 바뀝니다.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.titleCandidatesByType[activeType].map((t, i) => (
                      <button
                        key={`title-${activeType}-${i}-${t.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() =>
                          setDraftByType((prev) =>
                            prev
                              ? { ...prev, [activeType]: applyBlogTitleCandidate(prev[activeType], t) }
                              : prev,
                          )
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">CTA 후보 (현재 탭)</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 본문에서 <span className="font-medium text-[var(--text-primary)]">가장 아래에 있는 👉 줄</span>이 시작하는 블록만 후보 문단(링크 포함)으로 바뀝니다. (특가형은 최종 CTA, 비교형은 비교 기준 확인 등)
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.ctaCandidates.map((c, i) => (
                      <button
                        key={`cta-${i}-${c.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() =>
                          setDraftByType((prev) =>
                            prev
                              ? { ...prev, [activeType]: applyBlogCtaCandidate(prev[activeType], c) }
                              : prev,
                          )
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mb-1 block text-xs font-semibold text-[var(--text-primary)]">
                본문 — {BLOG_POST_TABS.find((t) => t.id === activeType)?.label} (직접 수정 가능)
              </label>
              <textarea
                value={currentDraft}
                onChange={(e) =>
                  setDraftByType((prev) =>
                    prev ? { ...prev, [activeType]: e.target.value } : prev,
                  )
                }
                className="h-[min(52vh,480px)] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 font-sans text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
                spellCheck={false}
                aria-label="생성된 블로그 본문"
              />
              {copyHint ? (
                <p className="mt-2 text-center text-xs font-medium text-[var(--success)]">{copyHint}</p>
              ) : null}

              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">추천 수정 포인트</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  아래 항목은 복사되는 본문에 포함되지 않습니다.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {ADMIN_EDIT_TIPS.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : null}

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            닫기
          </button>
          {state.status === "ok" ? (
            <>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                본문 다시 생성
              </button>
              <button
                type="button"
                onClick={() => void handleCopyBody()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
              >
                <Copy className="h-4 w-4" aria-hidden />
                현재 탭 본문 복사
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductManager.tsx`

```ts
<BlogPostGenerateModal
  open={blogPostModalOpen}
  productId={blogPostProduct?.id ?? null}
  productTitle={blogPostProduct?.title?.trim() ?? ""}
  onClose={() => {
    setBlogPostModalOpen(false);
    setBlogPostProduct(null);
  }}
  onCopied={() => showToast("success", "블로그 텍스트가 복사되었습니다.")}
/>
```

[4] 관련 상수/템플릿 전체

```ts
const ADMIN_EDIT_TIPS: string[] = [
  "첫 문장(제목 후보)을 브랜드 톤에 맞게 다듬으면 읽기 흐름이 좋아질 수 있습니다.",
  "가격·기간·포함 조건은 실제 상세페이지와 대조해 숫자·표현을 보정해 주세요.",
  "CTA 문장은 운영 방침에 맞게 한 번 손봐도 좋습니다.",
];

const candidateBtnClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm leading-snug text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30";

const BLOG_POST_TABS: { id: BlogPostType; label: string }[] = [
  { id: "info", label: "정보형" },
  { id: "deal", label: "특가형" },
  { id: "compare", label: "비교형" },
];
```

==================================================
파일 경로:
`src/components/admin/products/AdminProductsQuickActions.tsx`
==================================================

[1] 관련 타입 정의 전체

```ts
type AdminProductsQuickActionsProps = {
  product: Product;
  pendingToggleId: string | null;
  pendingDeleteId: string | null;
  pendingDownloadId?: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (product: Product) => void;
  /** 스마트스토어 상세 HTML 생성 모달 */
  onSmartstoreHtml?: (product: Product) => void;
  /** 네이버 블로그용 텍스트 생성 모달 */
  onBlogPost?: (product: Product) => void;
  /** 옵션 모달만 열기 (레거시 단일 버튼용) */
  onOpenDownloadOptions?: (product: Product) => void;
  /** preset 선택 메뉴 + 즉시 실행 */
  downloadPresets?: StoredImageDownloadPreset[];
  downloadDefaultPresetId?: string | null;
  downloadRecentPresetIds?: string[];
  onRunProductImageDownloadWithPreset?: (product: Product, preset: StoredImageDownloadPreset) => void;
  /** preset 관리 모달 */
  onOpenDownloadPresetManager?: () => void;
  /** 이미지 선택 다운로드 모달 */
  onOpenImageSelector?: (product: Product) => void;
  /** A4 유인물 빌더 모달 */
  onFlyer?: (product: Product) => void;
  /** 모바일 등에서 텍스트 라벨 표시 */
  compact?: boolean;
  /** 목록 한 줄 행용 더 작은 버튼 */
  dense?: boolean;
};
```

[2] 관련 함수 전체

```tsx
export default function AdminProductsQuickActions({
  product,
  pendingToggleId,
  pendingDeleteId,
  pendingDownloadId = null,
  onEdit,
  onDelete,
  onToggleActive,
  onSmartstoreHtml,
  onBlogPost,
  onOpenDownloadOptions,
  downloadPresets,
  downloadDefaultPresetId,
  downloadRecentPresetIds,
  onRunProductImageDownloadWithPreset,
  onOpenDownloadPresetManager,
  onOpenImageSelector,
  onFlyer,
  compact = false,
  dense = false,
}: AdminProductsQuickActionsProps) {
  const rowDownloadBusy = pendingDownloadId === product.id;
  const busy =
    pendingToggleId === product.id || pendingDeleteId === product.id || rowDownloadBusy;
  const anyZipDownloadPending = pendingDownloadId != null;
  const downloadDisabled =
    busy || (anyZipDownloadPending && !rowDownloadBusy);
  const active = product.is_active !== false;

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = downloadMenuWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDownloadMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadMenuOpen]);

  const showDownloadMenu =
    onOpenDownloadOptions != null &&
    onRunProductImageDownloadWithPreset != null &&
    downloadPresets != null &&
    downloadRecentPresetIds != null &&
    onOpenDownloadPresetManager != null &&
    onOpenImageSelector != null;

  const btnBase = dense
    ? "inline-flex items-center justify-center gap-0.5 rounded border text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const iconBtn = compact || dense ? "h-7 w-7 p-0" : "px-2 py-1";
  const icoCls = "h-3.5 w-3.5 shrink-0";

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => onEdit(product)}
        className={`${btnBase} ${iconBtn} border-[var(--primary)]/35 bg-[var(--primary-soft)] text-[var(--primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-1`}
        title="편집 화면으로"
      >
        <Pencil className={icoCls} aria-hidden />
        {!compact && !dense ? <span>편집</span> : null}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleActive(product)}
        className={`${btnBase} ${iconBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 focus-visible:ring-offset-1 ${
          active
            ? "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            : "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]"
        }`}
        title={active ? "비노출로 전환" : "노출로 전환"}
      >
        <Power className={icoCls} aria-hidden />
        {!compact && !dense ? <span>{active ? "비활성" : "활성"}</span> : null}
      </button>
      {onSmartstoreHtml ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSmartstoreHtml(product)}
          className={`${btnBase} ${iconBtn} border-sky-200/80 bg-sky-50 text-sky-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-1 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100`}
          title="스마트스토어 상세 HTML 생성"
        >
          <FileCode2 className={icoCls} aria-hidden />
          {!compact && !dense ? <span className="max-w-[4.5rem] truncate">HTML 생성</span> : null}
        </button>
      ) : null}
      {onBlogPost ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onBlogPost(product)}
          className={`${btnBase} ${iconBtn} border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-1 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100`}
          title="블로그 텍스트 생성"
        >
          <BookOpen className={icoCls} aria-hidden />
          {!compact && !dense ? (
            <span className="max-w-[7.5rem] truncate">블로그 텍스트</span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductsListView.tsx`

```tsx
<AdminProductsQuickActions
  product={product}
  pendingToggleId={pendingToggleId}
  pendingDeleteId={pendingDeleteId}
  pendingDownloadId={pendingDownloadId}
  onEdit={onEditProduct}
  onSmartstoreHtml={onOpenSmartstoreHtml}
  onBlogPost={onOpenBlogPost}
  onOpenDownloadOptions={onOpenDownloadOptions}
  onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
  downloadPresets={downloadPresets}
  downloadDefaultPresetId={downloadDefaultPresetId}
  downloadRecentPresetIds={downloadRecentPresetIds}
  onOpenDownloadPresetManager={onOpenDownloadPresetManager}
  onOpenImageSelector={onOpenImageSelector}
  onFlyer={onOpenFlyer}
  onDelete={onDeleteProduct}
  onToggleActive={onQuickToggleActive}
  dense
/>
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/AdminProductsListView.tsx`
==================================================

[1] 관련 타입 정의 전체

`src/components/admin/products/adminProducts.types.ts`를 사용합니다.

[2] 관련 함수 전체

관련 호출부만 발췌:

```tsx
function renderDesktopRow(product: Product) {
  return (
    <tr>
      <td className="w-[218px] min-w-[218px] px-1 py-2 align-middle">
        <AdminProductsQuickActions
          product={product}
          pendingToggleId={pendingToggleId}
          pendingDeleteId={pendingDeleteId}
          pendingDownloadId={pendingDownloadId}
          onEdit={onEditProduct}
          onSmartstoreHtml={onOpenSmartstoreHtml}
          onBlogPost={onOpenBlogPost}
          onOpenDownloadOptions={onOpenDownloadOptions}
          onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
          downloadPresets={downloadPresets}
          downloadDefaultPresetId={downloadDefaultPresetId}
          downloadRecentPresetIds={downloadRecentPresetIds}
          onOpenDownloadPresetManager={onOpenDownloadPresetManager}
          onOpenImageSelector={onOpenImageSelector}
          onFlyer={onOpenFlyer}
          onDelete={onDeleteProduct}
          onToggleActive={onQuickToggleActive}
          dense
        />
      </td>
    </tr>
  );
}

function renderMobileRow(product: Product) {
  return (
    <div>
      <AdminProductsQuickActions
        product={product}
        pendingToggleId={pendingToggleId}
        pendingDeleteId={pendingDeleteId}
        pendingDownloadId={pendingDownloadId}
        onEdit={onEditProduct}
        onSmartstoreHtml={onOpenSmartstoreHtml}
        onBlogPost={onOpenBlogPost}
        onOpenDownloadOptions={onOpenDownloadOptions}
        onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
        downloadPresets={downloadPresets}
        downloadDefaultPresetId={downloadDefaultPresetId}
        downloadRecentPresetIds={downloadRecentPresetIds}
        onOpenDownloadPresetManager={onOpenDownloadPresetManager}
        onOpenImageSelector={onOpenImageSelector}
        onFlyer={onOpenFlyer}
        onDelete={onDeleteProduct}
        onToggleActive={onQuickToggleActive}
        compact
      />
    </div>
  );
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductListSection.tsx`

```tsx
<AdminProductsListView
  ...
  onOpenSmartstoreHtml={onOpenSmartstoreHtml}
  onOpenBlogPost={onOpenBlogPost}
  ...
/>
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/AdminProductListSection.tsx`
==================================================

[1] 관련 타입 정의 전체

```ts
export type AdminProductListSectionProps = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  /** 상품 삭제 성공 후 호출 (현재 편집 중이던 상품이 삭제된 경우 상위에서 편집 상태 초기화용) */
  onAfterDelete?: (deletedId: string) => void;
  /** 상품 수정 클릭 시 (상위에서 편집 모드로 전환) */
  onEditProduct: (product: Product) => void;
  /** 스마트스토어 HTML 생성 (목록 작업 열) */
  onOpenSmartstoreHtml?: (product: Product) => void;
  /** 블로그 텍스트 생성 (목록 작업 열) */
  onOpenBlogPost?: (product: Product) => void;
  /** 이미지 ZIP 옵션 모달 (목록 작업 열) */
  onOpenDownloadOptions?: (product: Product) => void;
  /** preset 즉시 다운로드 */
  onRunProductImageDownloadWithPreset?: (product: Product, preset: StoredImageDownloadPreset) => void;
  downloadPresets?: StoredImageDownloadPreset[];
  downloadDefaultPresetId?: string | null;
  downloadRecentPresetIds?: string[];
  /** preset 관리 모달 */
  onOpenDownloadPresetManager?: () => void;
  /** 이미지 선택 다운로드 */
  onOpenImageSelector?: (product: Product) => void;
  /** ZIP 다운로드 진행 중인 상품 id */
  pendingDownloadId?: string | null;
  /** A4 유인물 빌더 (목록 작업 열) */
  onOpenFlyer?: (product: Product) => void;
  /** 새 상품 등록 링크 (없으면 버튼 비표시) */
  newProductHref?: string;
  /** 목록 새로고침 함수 등록 (저장 후 등 호출용) */
  registerRefresh?: (refresh: () => Promise<void>) => void;
};
```

[2] 관련 함수 전체

```tsx
export default function AdminProductListSection({
  showToast,
  confirm,
  onAfterDelete,
  onEditProduct,
  onOpenSmartstoreHtml,
  onOpenBlogPost,
  onOpenDownloadOptions,
  onRunProductImageDownloadWithPreset,
  downloadPresets,
  downloadDefaultPresetId,
  downloadRecentPresetIds,
  onOpenDownloadPresetManager,
  onOpenImageSelector,
  pendingDownloadId,
  onOpenFlyer,
  newProductHref,
  registerRefresh,
}: AdminProductListSectionProps) {
  const ctrl = useAdminProductsListController({
    showToast,
    confirm,
    onAfterDelete,
  });

  useEffect(() => {
    registerRefresh?.(ctrl.loadProducts);
  }, [registerRefresh, ctrl.loadProducts]);

  return (
    <AdminProductsListView
      products={ctrl.displayProducts}
      pageSourceCount={ctrl.products.length}
      pageActiveCount={ctrl.pageActiveCount}
      pageWarningStats={ctrl.pageWarningStats}
      taxonomyNameMap={ctrl.taxonomyNameMap}
      totalCount={ctrl.totalCount}
      currentPage={ctrl.currentPage}
      pageSize={ctrl.pageSize}
      pageSizeOptions={ctrl.pageSizeOptions}
      onPageSizeChange={ctrl.setPageSize}
      totalPages={ctrl.totalPages}
      sortField={ctrl.sortField}
      sortDirection={ctrl.sortDirection}
      keyword={ctrl.keyword}
      isSearchPending={ctrl.isSearchPending}
      isLoading={ctrl.isLoading}
      errorMessage={ctrl.errorMessage || null}
      selectedIds={ctrl.selectedIds}
      pendingMoveId={ctrl.pendingMoveId}
      pendingToggleId={ctrl.pendingToggleId}
      pendingDeleteId={ctrl.pendingDeleteId}
      pendingDownloadId={pendingDownloadId}
      onKeywordChange={ctrl.setKeyword}
      onSortChange={ctrl.handleSortChange}
      onPageChange={ctrl.movePage}
      onToggleSelectAll={ctrl.toggleSelectAllForPage}
      onToggleSelectOne={ctrl.toggleSelectOne}
      onClearSelection={() => ctrl.setSelectedIds([])}
      onBulkDelete={ctrl.handleBulkDeleteSelected}
      onEditProduct={onEditProduct}
      onOpenSmartstoreHtml={onOpenSmartstoreHtml}
      onOpenBlogPost={onOpenBlogPost}
      onOpenDownloadOptions={onOpenDownloadOptions}
      onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
      downloadPresets={downloadPresets}
      downloadDefaultPresetId={downloadDefaultPresetId}
      downloadRecentPresetIds={downloadRecentPresetIds}
      onOpenDownloadPresetManager={onOpenDownloadPresetManager}
      onOpenImageSelector={onOpenImageSelector}
      onOpenFlyer={onOpenFlyer}
      onDeleteProduct={ctrl.handleDelete}
      onQuickToggleActive={ctrl.quickToggleActive}
      onMoveSortOrder={ctrl.moveSortOrder}
      filterActive={ctrl.filterActive}
      filterStatus={ctrl.filterStatus}
      filterDestinationId={ctrl.filterDestinationId}
      filterProductLineId={ctrl.filterProductLineId}
      filterThemeQuery={ctrl.filterThemeQuery}
      filterIssuesOnly={ctrl.filterIssuesOnly}
      destinationOptions={ctrl.destinationOptions}
      productLineOptions={ctrl.productLineOptions}
      themeNameOptions={ctrl.themeNameOptions}
      onFilterActiveChange={ctrl.setFilterActive}
      onFilterStatusChange={ctrl.setFilterStatus}
      onFilterDestinationIdChange={ctrl.setFilterDestinationId}
      onFilterProductLineIdChange={ctrl.setFilterProductLineId}
      onFilterThemeQueryChange={ctrl.setFilterThemeQuery}
      onFilterIssuesOnlyChange={ctrl.setFilterIssuesOnly}
      newProductHref={newProductHref}
      onRetryLoad={ctrl.loadProducts}
    />
  );
}
```

[3] 호출부 전체

`src/components/admin/products/AdminProductManager.tsx`

```tsx
<AdminProductListSection
  ...
  onOpenSmartstoreHtml={(product) => {
    setSmartstoreHtmlProduct(product);
    setSmartstoreHtmlModalOpen(true);
  }}
  onOpenBlogPost={(product) => {
    setBlogPostProduct(product);
    setBlogPostModalOpen(true);
  }}
  ...
/>
```

[4] 관련 상수/템플릿 전체

없음

==================================================
파일 경로:
`src/components/admin/products/AdminProductManager.tsx`
==================================================

[1] 관련 타입 정의 전체

관련 상태 타입/반환 타입만 발췌:

```ts
const [blogPostModalOpen, setBlogPostModalOpen] = useState(false);
const [blogPostProduct, setBlogPostProduct] = useState<Product | null>(null);

const [serverPreview, setServerPreview] = useState<{
  previewProduct: Product;
  cardProps: ReturnType<typeof productToCardPropsPayload>;
  detailProps: ReturnType<typeof productToDetailV2PropsPayload>;
} | null>(null);
```

[2] 관련 함수 전체

블로그/미리보기 관련 핵심 블록:

```tsx
const previewProduct = useMemo(() => {
  const base = mapAdminProductFormToPreviewProduct(
    form,
    previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
  );
  return hydrateProductWithCampaignCardMeta(base, activeCampaignOptions);
}, [form, previewImageObjectUrl, activeCampaignOptions]);

const localCardProps = useMemo<ProductCardProps>(() => {
  const payload = productToCardPropsPayload(previewProduct);
  return {
    ...payload,
    onClickDetail: () => {},
    onClickConsult: () => {},
  };
}, [previewProduct]);

const localDetailProps = useMemo(() => {
  const payload = productToDetailV2PropsPayload(
    previewProduct,
    noticeTemplatesByGroup,
    legacyTermsTemplateMap,
  );
  return {
    ...payload,
    onConsultClick: () => {},
    kakaoHref: "#",
    trust: undefined,
  };
}, [previewProduct, noticeTemplatesByGroup, legacyTermsTemplateMap]);

const effectivePreviewProduct = serverPreview?.previewProduct ?? previewProduct;
const previewCardProps: ProductCardProps = serverPreview
  ? { ...serverPreview.cardProps, onClickDetail: () => {}, onClickConsult: () => {} }
  : localCardProps;
const previewDetailProps = serverPreview
  ? {
      ...serverPreview.detailProps,
      onConsultClick: () => {},
      kakaoHref: "#",
      trust: undefined,
    }
  : localDetailProps;

const hasPreviewImage = !!(form.image_url?.trim() || form.images_json.length > 0 || previewImageFile);
const previewWarnings = useMemo(
  () => getPreviewWarnings(form, hasPreviewImage),
  [form, hasPreviewImage],
);

useEffect(() => {
  if (!previewImageFile) {
    setPreviewImageObjectUrl(null);
    return;
  }
  const url = URL.createObjectURL(previewImageFile);
  setPreviewImageObjectUrl(url);
  return () => {
    URL.revokeObjectURL(url);
  };
}, [previewImageFile]);

const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const previewRequestIdRef = useRef(0);
useEffect(() => {
  setServerPreview(null);
  previewDebounceRef.current && clearTimeout(previewDebounceRef.current);
  const requestId = ++previewRequestIdRef.current;
  previewDebounceRef.current = setTimeout(() => {
    previewDebounceRef.current = null;
    const imageUrl = previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "";
    fetch("/api/admin/products/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form, imageUrl }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: { previewProduct: Product; cardProps: unknown; detailProps: unknown }) => {
        if (requestId !== previewRequestIdRef.current) return;
        setServerPreview({
          previewProduct: data.previewProduct,
          cardProps: data.cardProps as ReturnType<typeof productToCardPropsPayload>,
          detailProps: data.detailProps as ReturnType<typeof productToDetailV2PropsPayload>,
        });
      })
      .catch(() => {
        if (requestId !== previewRequestIdRef.current) return;
        setServerPreview(null);
      });
  }, 400);
  return () => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
  };
}, [form, previewImageObjectUrl]);
```

[3] 호출부 전체

목록 액션과 모달 연결:

```tsx
<AdminProductListSection
  ...
  onOpenSmartstoreHtml={(product) => {
    setSmartstoreHtmlProduct(product);
    setSmartstoreHtmlModalOpen(true);
  }}
  onOpenBlogPost={(product) => {
    setBlogPostProduct(product);
    setBlogPostModalOpen(true);
  }}
  ...
/>

<SmartstoreHtmlGenerateModal
  open={smartstoreHtmlModalOpen}
  productId={smartstoreHtmlProduct?.id ?? null}
  productTitle={smartstoreHtmlProduct?.title?.trim() ?? ""}
  onClose={() => {
    setSmartstoreHtmlModalOpen(false);
    setSmartstoreHtmlProduct(null);
  }}
  onCopied={() => showToast("success", "HTML이 복사되었습니다.")}
/>

<BlogPostGenerateModal
  open={blogPostModalOpen}
  productId={blogPostProduct?.id ?? null}
  productTitle={blogPostProduct?.title?.trim() ?? ""}
  onClose={() => {
    setBlogPostModalOpen(false);
    setBlogPostProduct(null);
  }}
  onCopied={() => showToast("success", "블로그 텍스트가 복사되었습니다.")}
/>
```

[4] 관련 상수/템플릿 전체

없음
