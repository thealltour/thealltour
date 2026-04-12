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
