import type {
  BlogPostViewModel,
  BlogPostBuildMeta,
  BlogPostBuildResult,
  BlogPostType,
  BlogPostsThreePack,
} from "@/lib/blog/blogPost.types";
import {
  postProcessSingleBlogText,
  postProcessText,
  toManPriceBandFromPriceText,
} from "@/lib/blog/postProcessText";
import { BLOG_SECTION_EMOJI, BLOG_BANNED_AD_PHRASES } from "@/lib/blog/blogPost.constants";
import {
  cleanCategory,
  cleanScheduleText,
  sanitizeInlineNoise,
  stripBlogRetailNoise,
  trimText,
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
    scrubAdTone(`지금 출발 가능한 일정과 가격을 아래 링크에서 확인해보세요.\n\n${url}`),
    scrubAdTone(`포함 사항과 실제 예약 가능 조건을 아래 링크에서 확인해보세요.\n\n${url}`),
    scrubAdTone(`상품 상세와 문의 전 확인할 조건을 아래 링크에서 먼저 살펴보세요.\n\n${url}`),
  ];
}

/** 첫 줄: 정보형 제목 후보 1번 (SEO 패턴) */
export function buildBlogTitleLine(vm: BlogPostViewModel): string {
  return buildTitleForType(vm, "info");
}

function buildBlogMeta(
  vm: BlogPostViewModel,
  text: string,
  sectionCount: number,
  options?: {
    hasTimelineSummary?: boolean;
    hasIncludedSection?: boolean;
    hasNoticeSection?: boolean;
  },
): BlogPostBuildMeta {
  const firstBodyLine = text.split(/\n/).find((l) => l.trim().length > 0) ?? "";
  return {
    title: sanitizeInlineNoise(firstBodyLine),
    characterCount: text.length,
    sectionCount,
    hasTimelineSummary: options?.hasTimelineSummary ?? false,
    hasIncludedSection: options?.hasIncludedSection ?? false,
    hasNoticeSection: options?.hasNoticeSection ?? false,
  };
}

function buildSingleTitleBlock(vm: BlogPostViewModel): string {
  const [first] = buildSingleTitleCandidates(vm);
  return first ?? buildTitleForType(vm, "info");
}

function buildPhotoGuideLine(index: number, label: string): string {
  return `[사진 ${index}: ${label}]`;
}

function suggestPhotoLabelFromText(text: string): string {
  if (/바나힐|banahill|bana hill/i.test(text)) {
    return "바나힐 테마파크 또는 골든브릿지 이미지";
  }

  if (/마블|오행산|마블\s*마운틴/i.test(text)) {
    return "마블 마운틴(오행산) 또는 다낭 시내 관광 이미지";
  }

  if (/골프|라운딩|tee|티오프/i.test(text)) {
    return "골프 라운딩 또는 골프장 전경 이미지";
  }

  if (/해변|비치|바다|리조트/i.test(text)) {
    return "미케비치 또는 리조트/해변 이미지";
  }

  return "여행지 대표 이미지";
}

function buildDynamicPhotoGuideLine(
  index: number,
  vm: BlogPostViewModel,
  context: "hero" | "schedule" | "highlight" | "cta",
): string {
  if (context === "hero") {
    const region = vm.regionText?.trim() || seoDisplayRegion(vm) || "여행지";
    return buildPhotoGuideLine(index, `${region} 대표 이미지 또는 호텔/전경 이미지`);
  }

  if (context === "schedule") {
    const dayText =
      vm.timeline?.days
        ?.map((d) => [d.title, d.events?.[0]?.heading, d.events?.[0]?.description].filter(Boolean).join(" "))
        .join(" ") ?? "";
    return buildPhotoGuideLine(index, suggestPhotoLabelFromText(dayText));
  }

  if (context === "highlight") {
    const highlightText = [
      vm.title,
      vm.oneLiner,
      ...vm.recommendedTargetLines,
      ...vm.includedLines.slice(0, 3),
    ]
      .filter(Boolean)
      .join(" ");
    return buildPhotoGuideLine(index, suggestPhotoLabelFromText(highlightText));
  }

  const region = vm.regionText?.trim() || seoDisplayRegion(vm) || "여행지";
  return buildPhotoGuideLine(index, `${region} 여행 분위기 또는 상담 유도 이미지`);
}

export function buildSingleTitleCandidates(vm: BlogPostViewModel): string[] {
  const region = seoDisplayRegion(vm);
  const duration = durationForTitle(vm);
  const priceBand = toManPriceBandFromPriceText(vm.priceText);
  const base = duration ? `${region} 여행 ${duration}` : `${region} 여행`;

  const raw = [
    priceBand ? `${base} ${priceBand}, 포함 조건까지 보면 괜찮을까요?` : "",
    `${base} 패키지, 가격보다 먼저 봐야 할 포함 조건`,
    `${base} 상품 비교 전 확인할 일정·포함 조건`,
    ...buildTitleCandidates(vm),
  ]
    .filter((part) => part.length > 0)
    .map((title) => scrubAdTone(title.replace(/\s{2,}/g, " ").trim()))
    .filter(Boolean);

  return [...new Set(raw)].slice(0, 4);
}

function buildSingleSearchLeadBlock(vm: BlogPostViewModel): string {
  const region = seoDisplayRegion(vm);

  return `${region} 상품을 찾다 보면 가격만 보고 판단하기 어려운 경우가 많습니다.

특히 저렴해 보이는 상품일수록
포함 조건, 일정 흐름, 현지 추가 비용을 함께 확인해야 실제 조건을 판단하기 좋습니다.

이번 글에서는 주요 조건을 기준으로 한 번에 정리해보겠습니다.`;
}

function buildSingleSummaryBlock(vm: BlogPostViewModel): string {
  const lines: string[] = [];
  const region = seoDisplayRegion(vm);
  if (region && region !== "여행") lines.push(`✔ 지역: ${region}`);
  if (vm.durationText?.trim()) lines.push(`✔ 기간: ${vm.durationText.trim()}`);
  if (vm.priceText?.trim()) lines.push(`✔ 가격대: ${vm.priceText.trim()}`);
  if (vm.minDeparturePeopleText?.trim()) {
    lines.push(`✔ 출발 인원: ${vm.minDeparturePeopleText.trim()}`);
  }

  const includedPreview = vm.includedLines
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");

  if (includedPreview) {
    lines.push(`✔ 포함 요약: ${includedPreview}`);
  }

  if (vm.optionalLines.length > 0 || vm.excludedLines.length > 0) {
    lines.push("✔ 확인 포인트: 불포함 항목·선택 관광 여부");
  }

  if (lines.length === 0) return "";

  return `핵심 조건 요약

${lines.join("\n")}`;
}

function buildSinglePriceJudgmentBlock(vm: BlogPostViewModel): string {
  const priceLead = vm.priceText?.trim()
    ? `${vm.priceText.trim()} 기준으로 보더라도 포함 조건을 함께 살펴보는 것이 중요합니다.`
    : "패키지 여행은 가격보다 포함 범위를 함께 보는 것이 중요합니다.";
  return `이 가격대라면 무엇을 봐야 할까요?

${priceLead}

같은 일정이라도 항공, 숙박, 관광 포함 여부에 따라
실제 체감 비용은 크게 달라질 수 있습니다.

이 가격대에서는 포함 조건에 따라 실제 비용 차이가 크게 날 수 있는 구간입니다.`;
}

function summarizeScheduleDay(text: string): string {
  const t = cleanScheduleText(text);

  if (!t) return "세부 일정은 상세페이지에서 확인하는 것이 좋습니다.";
  if (/공항|도착|출국|입국|항공|체크인/.test(t)) {
    return "이동, 도착, 체크인 중심의 일정으로 볼 수 있습니다.";
  }
  if (/바나힐|바나\s*힐|banahill|bana hill/i.test(t)) {
    return "바나힐 테마파크 일정이 포함되어 다낭 여행에서 많이 찾는 관광 포인트를 경험할 수 있습니다.";
  }
  if (/마블|오행산|마블\s*마운틴/i.test(t)) {
    return "마블 마운틴(오행산) 등 다낭 주요 관광 일정이 포함될 수 있습니다.";
  }
  if (/골프|라운드|라운딩|tee|티오프|cc/i.test(t)) {
    return "골프 라운딩 중심 일정이 포함될 수 있습니다.";
  }
  if (/관광|투어|시내|방문|탐방/.test(t)) {
    return "주요 관광지 방문 또는 현지 투어 일정이 포함될 수 있습니다.";
  }
  if (/자유|휴식|리조트|스파|마사지|해변|비치/.test(t)) {
    return "자유시간 또는 휴양 중심 일정으로 구성될 수 있습니다.";
  }

  const trimmed = trimText(t, 80);
  return trimmed.endsWith("입니다.") || trimmed.endsWith("습니다.")
    ? trimmed
    : `${trimmed} 일정이 포함될 수 있습니다.`;
}

function buildScheduleSectionV2(vm: BlogPostViewModel): string {
  const days = vm.timeline?.days ?? [];
  if (days.length === 0) {
    return `일정은 어떻게 구성되나요?

구조화된 일정 정보가 부족해 상세 일정은 상품 페이지에서 확인하는 것이 좋습니다.`;
  }

  const lines = days.slice(0, 5).map((day) => {
    const title = day.title?.trim();
    const firstEvent = day.events?.[0];
    const eventText = [firstEvent?.heading, firstEvent?.description]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    const summary = summarizeScheduleDay(eventText);

    return title
      ? `${day.day}일차 - ${title}\n${summary}`
      : `${day.day}일차\n${summary}`;
  });

  const more =
    days.length > 5
      ? `\n\n전체 ${days.length}일 일정 중 주요 흐름만 요약했습니다.`
      : "";

  return `일정은 어떻게 구성되나요?

${lines.join("\n\n")}${more}

정확한 일정 순서와 세부 내용은 출발일, 항공, 현지 상황에 따라 달라질 수 있습니다.`;
}

function buildIncludedExcludedJudgmentSection(vm: BlogPostViewModel): string {
  const chunks: string[] = [];

  if (vm.includedLines.length > 0) {
    chunks.push(`포함 항목 일부:\n${vm.includedLines.slice(0, 4).map((l) => `• ${l}`).join("\n")}`);
  }

  if (vm.excludedLines.length > 0) {
    chunks.push(`불포함 항목 일부:\n${vm.excludedLines.slice(0, 4).map((l) => `• ${l}`).join("\n")}`);
  }

  if (vm.optionalLines.length > 0) {
    chunks.push("선택 관광이나 옵션은 별도 비용이 발생할 수 있으니, 실제 예약 전 함께 확인하는 것이 좋습니다.");
  }

  if (chunks.length === 0) return "";

  return `포함·불포함 조건은 어떤가요?

패키지 여행은 표시 가격만으로 판단하기보다 포함 범위를 함께 보는 것이 중요합니다.

${chunks.join("\n\n")}

같은 기간의 상품이라도 포함 항목과 현지 추가 비용에 따라 실제 체감 가격은 달라질 수 있습니다.`;
}

function groupNoticeMarkerLines(lines: string[]): string[] {
  const result: string[] = [];
  let pendingMarker = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^[①②③④⑤⑥⑦⑧⑨⑩]$/.test(line)) {
      pendingMarker = line;
      continue;
    }

    if (pendingMarker) {
      result.push(`${pendingMarker} ${line}`);
      pendingMarker = "";
      continue;
    }

    result.push(line);
  }

  if (pendingMarker) result.push(pendingMarker);

  return result;
}

function buildConceptTargetSection(vm: BlogPostViewModel): string {
  const concept = vm.concept ?? "일반";

  const map = {
    효도여행: `이 상품은 부모님과 함께하는 여행을 고려하는 분들이라면 조건을 확인해볼 만합니다.

부모님 여행은 가격보다 이동 동선, 식사, 숙소, 일정 강도가 중요합니다.
예약 전에는 출발일과 인원뿐 아니라 부모님 연령대와 이동 부담까지 함께 상담받아보시는 것이 좋습니다.`,

    가족여행: `가족여행은 인원 구성에 따라 조건 확인이 달라집니다.

아이 동반 여부, 객실 구성, 자유시간, 선택 관광 여부를 함께 보는 것이 좋습니다.
가족 단위라면 출발일과 객실 가능 여부를 먼저 확인해보시는 것을 추천드립니다.`,

    골프: `골프여행은 일반 패키지보다 확인할 항목이 더 많습니다.

라운딩 횟수, 골프장 위치, 이동 시간, 티오프 조건에 따라 만족도가 달라질 수 있습니다.
동반 인원과 희망 일정이 있다면 먼저 상담으로 가능 여부를 확인하는 것이 좋습니다.`,

    휴양: `휴양 목적이라면 일정이 너무 빡빡하지 않은지 확인하는 것이 중요합니다.

리조트 이용 시간, 자유시간, 이동 거리, 선택 관광 여부를 함께 보면
실제 여행 만족도를 더 정확히 판단할 수 있습니다.`,

    일반: `이 상품은 일정과 포함 조건을 기준으로 비교해볼 만한 여행 상품입니다.

출발일, 인원, 포함 범위에 따라 최종 조건은 달라질 수 있으니
상세페이지에서 조건을 확인한 뒤 문의로 이어가는 것이 좋습니다.`,
  } as const;

  return `이 상품은 어떤 분께 맞을까요?

${map[concept]}`;
}

function buildConversionConclusionBlock(): string {
  return "조건을 기준으로 보면 가성비를 확인해볼 만한 상품으로 볼 수 있습니다.";
}

function buildMidCtaSection(vm: BlogPostViewModel): string {
  const url = buildProductUrl(vm);

  return `👉 지금 출발 가능한 일정 확인하기

현재 조건 기준으로 실제 예약 가능한 일정과 가격을 확인해보세요.

${url}`;
}

function buildBookingNoticeSummarySection(vm: BlogPostViewModel): string {
  const bookingConditions = groupNoticeMarkerLines(vm.bookingConditionLines);
  const bookingNotes = groupNoticeMarkerLines(vm.bookingNotesLines);
  const hasRefund = vm.refundPolicyLines.length > 0;
  const chunks: string[] = [];

  const hasEarlyTicketNotice = bookingNotes.some((line) =>
    /선발권|발권|특가/i.test(line),
  );

  if (bookingConditions.length > 0) {
    chunks.push(
      `예약 조건은 출발일과 좌석 상황에 따라 달라질 수 있습니다.\n${bookingConditions
        .slice(0, 2)
        .map((l) => `• ${l}`)
        .join("\n")}`,
    );
  }

  if (hasEarlyTicketNotice) {
    chunks.push(
      "이 상품은 선발권 특가 조건이 포함될 수 있어 예약 가능 여부와 발권 조건을 먼저 확인하는 것이 좋습니다.",
    );
    chunks.push(
      "특히 선발권 조건이 포함된 경우 일정 변경이나 환불 조건을 꼭 확인하셔야 합니다.",
    );
  } else if (bookingNotes.length > 0) {
    chunks.push(
      `예약 시 유의사항은 상품 조건에 따라 달라질 수 있습니다.\n${bookingNotes
        .slice(0, 2)
        .map((l) => `• ${l}`)
        .join("\n")}`,
    );
  }

  if (hasRefund) {
    chunks.push("환불·취소 규정은 출발일 기준으로 달라질 수 있으니 상세 안내를 확인하는 것이 좋습니다.");
  }

  if (chunks.length === 0) {
    return `예약 전 체크할 점

출발일, 좌석, 객실, 현지 일정은 시점에 따라 달라질 수 있습니다.
예약 전에는 상세페이지와 상담을 통해 최종 조건을 확인해 주세요.`;
  }

  return `예약 전 체크할 점

${chunks.join("\n\n")}

최종 예약 전에는 출발 가능 여부와 세부 조건을 한 번 더 확인하는 것이 좋습니다.`;
}

function buildFinalCtaSection(vm: BlogPostViewModel): string {
  const url = buildProductUrl(vm);

  return `👉 현재 출발 가능 여부 / 가격 확인하기

출발일, 좌석, 객실 상황에 따라 최종 조건은 달라질 수 있습니다.

아래 링크에서 상품 상세를 확인하신 뒤
궁금한 점은 홈페이지 문의로 남겨주시면 안내받으실 수 있습니다.

${url}`;
}

function buildSingleBlogPostBlocks(vm: BlogPostViewModel): string[] {
  return [
    buildSingleTitleBlock(vm),
    buildSingleSearchLeadBlock(vm),
    buildDynamicPhotoGuideLine(1, vm, "hero"),
    buildSingleSummaryBlock(vm),
    buildSinglePriceJudgmentBlock(vm),
    buildDynamicPhotoGuideLine(2, vm, "schedule"),
    buildScheduleSectionV2(vm),
    buildIncludedExcludedJudgmentSection(vm),
    buildDynamicPhotoGuideLine(3, vm, "highlight"),
    buildConceptTargetSection(vm),
    buildConversionConclusionBlock(),
    buildMidCtaSection(vm),
    buildBookingNoticeSummarySection(vm),
    buildDynamicPhotoGuideLine(4, vm, "cta"),
    buildFinalCtaSection(vm),
  ].filter((block): block is string => typeof block === "string" && block.trim().length > 0);
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
  const hasTimelineDays = vm.timeline.days.length > 0;
  const scheduleText = buildScheduleSection(vm);
  const hasTimelineSummary =
    type === "info" &&
    hasTimelineDays &&
    !scheduleText.includes("구조화된 일정 요약을 자동으로 만들기 어려워");
  const hasIncludedSection =
    (type === "info" || type === "compare") &&
    (vm.includedLines.length > 0 || vm.excludedLines.length > 0 || vm.optionalLines.length > 0);

  const meta = buildBlogMeta(vm, text, blocks.filter((b) => b.trim()).length, {
    hasTimelineSummary,
    hasIncludedSection,
    hasNoticeSection: false,
  });

  return {
    text,
    meta,
    titleCandidates: buildTitleCandidatesForType(vm, type).map((c) => postProcessText(c, type)),
    ctaCandidates: buildCtaCandidates(vm).map((c) => postProcessText(c, type)),
  };
}

export function buildSingleBlogPostWithMeta(vm: BlogPostViewModel): BlogPostBuildResult {
  const blocks = buildSingleBlogPostBlocks(vm);
  const rawText = blocks.map(polishSectionBlock).join("\n\n");
  const text = postProcessSingleBlogText(rawText);
  const bookingNoticeText = buildBookingNoticeSummarySection(vm);
  const meta = buildBlogMeta(vm, text, blocks.length, {
    hasTimelineSummary: (vm.timeline?.days?.length ?? 0) > 0,
    hasIncludedSection:
      vm.includedLines.length > 0 || vm.excludedLines.length > 0 || vm.optionalLines.length > 0,
    hasNoticeSection: bookingNoticeText.trim().length > 0,
  });
  meta.hasPhotoGuide = text.includes("[사진 ");

  return {
    text,
    meta,
    titleCandidates: buildSingleTitleCandidates(vm).map((c) => postProcessText(c, "info")),
    ctaCandidates: buildCtaCandidates(vm).map((c) => postProcessText(c, "info")),
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

export function buildSingleBlogPostText(vm: BlogPostViewModel): string {
  return buildSingleBlogPostWithMeta(vm).text;
}
