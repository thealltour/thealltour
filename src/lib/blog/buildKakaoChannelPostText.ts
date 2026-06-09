import type {
  BlogPostViewModel,
  KakaoPostBuildResult,
} from "@/lib/blog/blogPost.types";
import { buildProductUrl, seoDisplayRegion } from "@/lib/blog/buildBlogPostText";
import { toManPriceBandFromPriceText } from "@/lib/blog/postProcessText";

function clean(text: string): string {
  return text.replace(/\s{2,}/g, " ").trim();
}

function extractHighlights(vm: BlogPostViewModel): string[] {
  const joined = [
    vm.includedLines.join(" "),
    vm.timeline?.days
      ?.map((d) => `${d.title ?? ""} ${(d.events ?? []).map((e) => e.heading ?? "").join(" ")}`)
      .join(" "),
    vm.title,
    vm.oneLiner,
    vm.categoryText,
    vm.regionText,
  ]
    .filter(Boolean)
    .join(" ");

  const result: string[] = [];
  const hasAir = /항공|왕복/i.test(joined);
  const hasStay = /숙박|호텔|리조트/i.test(joined) || Boolean(vm.durationText?.trim());
  const hasTour = /관광|투어|시내|방문|탐방|바나힐|마블|오행산/i.test(joined);
  const hasRest = /휴양|리조트|비치|해변|자유|휴식|스파|마사지/i.test(joined);

  if (/바나힐/i.test(joined)) result.push("바나힐 포함 일정");
  if (/골프|라운딩/i.test(joined)) result.push("골프 일정 포함");

  if (hasAir && hasStay) {
    result.push("항공 + 숙박 포함");
  } else {
    if (hasAir) result.push("항공 포함");
    if (hasStay) result.push("숙박 포함");
  }

  if (hasTour && hasRest) {
    result.push("관광 + 휴양 구성");
  }

  if (result.length < 3) {
    result.push("가성비 구성");
  }

  return [...new Set(result.map(clean).filter(Boolean))].slice(0, 3);
}

function buildTargetLine(vm: BlogPostViewModel): string {
  const text = `${vm.title} ${vm.categoryText ?? ""} ${vm.regionText ?? ""}`.toLowerCase();

  if (/효도|부모/.test(text)) return "부모님 여행으로 많이 찾는 조건입니다.";
  if (/가족|아이/.test(text)) return "가족 여행으로 고려해볼 만합니다.";
  if (/골프/.test(text)) return "골프 여행으로 확인해볼 만합니다.";

  return "조건 괜찮은지 한번 확인해보셔도 좋습니다.";
}

export function buildKakaoHookCandidates(vm: BlogPostViewModel): string[] {
  const region = seoDisplayRegion(vm);
  const duration = vm.durationText?.trim() ?? "";
  const price = toManPriceBandFromPriceText(vm.priceText) ?? vm.priceText;

  return [
    `🔥 ${region} ${duration} ${price}, 지금 조건 괜찮은 편입니다`,
    `✈️ ${region} 여행 ${duration}, 이 가격이면 한번 보셔도 좋습니다`,
    `📌 ${region} 여행 찾는 분들, 조건 괜찮은 편입니다`,
  ]
    .map(clean)
    .filter(Boolean);
}

export function buildKakaoChannelPostText(vm: BlogPostViewModel): KakaoPostBuildResult {
  const hook = buildKakaoHookCandidates(vm)[0];
  const highlights = extractHighlights(vm);
  const price = toManPriceBandFromPriceText(vm.priceText) ?? vm.priceText;
  const target = buildTargetLine(vm);
  const productUrl = buildProductUrl(vm, "kakao_channel");

  const lines: string[] = [];

  lines.push(hook || "🔥 지금 조건 괜찮은 편입니다");
  lines.push("");

  highlights.forEach((highlight) => {
    lines.push(`✔ ${highlight}`);
    lines.push("");
  });

  if (price && price !== "별도 문의") {
    lines.push("이 가격대에서는 포함 조건에 따라 실제 비용 차이가 크게 날 수 있습니다.");
  } else {
    lines.push("포함 조건에 따라 실제 비용 차이가 크게 날 수 있습니다.");
  }

  lines.push("");
  lines.push("👉 상품상세확인");
  lines.push("");
  lines.push(productUrl);
  lines.push("");
  lines.push("👉 지금 기준 출발 가능 여부 확인");
  lines.push("");
  lines.push("👉 채팅 주시면 바로 안내드릴게요");

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    text,
    hookCandidates: buildKakaoHookCandidates(vm),
    meta: {
      characterCount: text.length,
      lineCount: text.split(/\r?\n/).length,
      hasPrice: Boolean(price && price !== "별도 문의"),
      hasTarget: Boolean(target && text.includes(target)),
    },
  };
}
