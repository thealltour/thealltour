import type {
  BandHookBuildResult,
  BlogPostViewModel,
} from "@/lib/blog/blogPost.types";
import { buildProductUrl, seoDisplayRegion } from "@/lib/blog/buildBlogPostText";
import { toManPriceBandFromPriceText } from "@/lib/blog/postProcessText";

function cleanLine(text: string): string {
  return text.replace(/\s{2,}/g, " ").trim();
}

function compactIncludedSummary(vm: BlogPostViewModel): string[] {
  const lines: string[] = [];

  const joined = vm.includedLines.join(" ");
  const scheduleJoined =
    vm.timeline?.days
      ?.map((d) => `${d.title ?? ""} ${(d.events ?? []).map((e) => e.heading ?? "").join(" ")}`)
      .join(" ") ?? "";

  if (/바나힐|바나\s*힐|banahill|bana hill/i.test(scheduleJoined)) {
    lines.push("바나힐 포함 일정");
  }

  if (/마블|오행산|마블\s*마운틴/i.test(scheduleJoined)) {
    lines.push("다낭 주요 관광 포함");
  }

  if (/항공|왕복\s*항공|항공료/.test(joined)) {
    lines.push("항공 포함 조건");
  }

  if (/숙박|호텔|리조트/.test(joined) || vm.durationText) {
    lines.push("숙박 포함 구성");
  }

  if (vm.optionalLines.length > 0 || vm.excludedLines.length > 0) {
    lines.push("포함·불포함 확인 필요");
  }

  return [...new Set(lines.map(cleanLine).filter(Boolean))].slice(0, 3);
}

function buildTargetLine(vm: BlogPostViewModel): string {
  const joined = [
    vm.title,
    vm.oneLiner,
    vm.categoryText,
    vm.regionText,
    ...vm.recommendedTargetLines,
  ]
    .filter(Boolean)
    .join(" ");

  if (/효도|부모님|어르신|시니어/.test(joined)) {
    return "부모님 여행이나 가족 여행을 찾는 분께 참고하기 좋습니다.";
  }

  if (/가족|아이|키즈|동반/.test(joined)) {
    return "가족 여행을 준비하는 분께 참고하기 좋습니다.";
  }

  if (/골프|라운딩|티오프|cc/i.test(joined)) {
    return "골프여행을 준비하는 분께 참고하기 좋습니다.";
  }

  if (/휴양|리조트|비치|해변|스파|마사지/.test(joined)) {
    return "휴양 중심 여행을 찾는 분께 참고하기 좋습니다.";
  }

  return "일정과 포함 조건을 비교해보고 싶은 분께 참고하기 좋습니다.";
}

export function buildBandHookCandidates(vm: BlogPostViewModel): string[] {
  const region = seoDisplayRegion(vm);
  const duration = vm.durationText?.trim();
  const price = toManPriceBandFromPriceText(vm.priceText) ?? vm.priceText;

  const base = [region !== "여행" ? region : "", duration].filter(Boolean).join(" ");
  const subject = cleanLine(base || "여행 상품");

  const candidates = [
    `🔥 ${subject} ${price}, 이 조건이면 바로 확인해보셔도 좋습니다`,
    `✈️ ${subject} 패키지, 조건 괜찮은지 한번 확인해보세요`,
    `📌 ${subject} 여행 찾는 분이라면 조건 비교용으로 참고해보세요`,
  ];

  return [...new Set(candidates.map(cleanLine).filter(Boolean))];
}

export function buildBandHookText(vm: BlogPostViewModel): BandHookBuildResult {
  const [title] = buildBandHookCandidates(vm);
  const summaryLines = compactIncludedSummary(vm);
  const price = toManPriceBandFromPriceText(vm.priceText) ?? vm.priceText;
  const targetLine = buildTargetLine(vm);
  const productUrl = buildProductUrl(vm, "naver_band");

  const body: string[] = [];

  body.push(title || "🔥 여행 조건 확인해볼 만한 상품입니다");
  body.push("");

  if (summaryLines.length > 0) {
    body.push(...summaryLines.map((line) => `✔ ${line}`));
    body.push("");
  }

  if (price && price !== "별도 문의") {
    body.push(`${price} 기준으로 보더라도 포함 조건을 함께 보는 것이 중요합니다.`);
  } else {
    body.push("패키지 여행은 표시 가격보다 포함 조건을 함께 보는 것이 중요합니다.");
  }

  body.push("");
  body.push(targetLine);
  body.push("");
  body.push("자세한 설명은 공유된 블로그 글에서 확인하실 수 있습니다.");
  body.push("출발 가능 여부와 실제 조건은 아래 상품 페이지에서 바로 확인해보세요.");
  body.push("");
  body.push("👉 상품 상세 바로가기");
  body.push(productUrl);
  body.push("");
  body.push("댓글이나 채팅으로 문의 주셔도 안내드리겠습니다.");

  const text = body.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    text,
    meta: {
      title: title || "",
      characterCount: text.length,
      lineCount: text.split(/\r?\n/).length,
      hasPrice: Boolean(price && price !== "별도 문의"),
      hasScheduleKeyword: /바나힐|마블|오행산|골프|리조트|비치|해변/i.test(text),
      hasTargetKeyword: /부모님|가족|골프|휴양|비교/.test(text),
      hasProductLink: text.includes(productUrl),
    },
    hookCandidates: buildBandHookCandidates(vm),
  };
}
