import type { Inquiry, InquiryLeadPriority } from "@/types/inquiry";
import type { InquiryGuideAnalysis, InquiryGuideType, InquiryLeadTemperature } from "./inquiryResponseGuide.types";
import { ALTERNATIVE_STRATEGIES } from "./templates/alternativeStrategies";
import { PHONE_SCRIPTS } from "./templates/phoneScripts";
import { PROPOSAL_GUIDES } from "./templates/proposalGuides";
import { RESPONSE_TEMPLATES } from "./templates/responseTemplates";

const TYPE_LABELS: Record<InquiryGuideType, string> = {
  golf_custom: "골프 맞춤문의",
  travel_quote: "견적·일정 문의",
  product: "상품 문의",
  general: "일반 문의",
};

const LEAD_LABELS: Record<InquiryLeadTemperature, string> = {
  hot: "HOT",
  warm: "WARM",
  normal: "NORMAL",
};

const GOLF_CONTENT_PATTERN =
  /골프|golf|\bcc\b|씨씨|라운딩|티오프|티\s*타임|티타임|그린피|파\s*3|파\s*4|파\s*5|18홀|9홀|골프장|스크린골프/i;

const RESORT_WITH_GOLF_PATTERN = /리조트/i;

function textHasGolfSignals(text: string): boolean {
  const t = text ?? "";
  if (GOLF_CONTENT_PATTERN.test(t)) return true;
  if (RESORT_WITH_GOLF_PATTERN.test(t) && /(라운드|홀|골프|golf|cc|티오프)/i.test(t)) return true;
  return false;
}

/** 문의 본문·상품명 기반 유형 추정 (휴리스틱) */
export function inferInquiryType(content: string, productTitle?: string | null): InquiryGuideType {
  const c = (content ?? "").trim();
  const pt = (productTitle ?? "").trim();
  const combined = `${c}\n${pt}`;

  if (textHasGolfSignals(combined)) return "golf_custom";
  if (pt.length > 0) return "product";
  if (/(견적|예산|출발|일정|인원|가격|문의\s*드|상담\s*받|최저가|비용)/i.test(c)) return "travel_quote";
  return "general";
}

function scoreLeadSignals(inquiry: Inquiry): number {
  const content = (inquiry.content ?? "").trim();
  let score = 0;

  if (/\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}월\s*\d{1,2}\s*일|\d{1,2}\/\d{1,2}|출발일|출발\s*:/i.test(content)) {
    score += 2;
  }
  if (/(출발(?!\s*공항)|귀국|체크인|체크아웃)/i.test(content)) score += 1;

  if (/\d+\s*명|[2-9]\s*명|10\s*명|인원|성인|소아|아동|부부|가족|커플/i.test(content)) {
    score += 2;
  }

  if ((inquiry.product_title ?? "").trim().length > 0) score += 1;

  if (content.length >= 100) score += 1;
  if (content.length >= 220) score += 1;

  if (/[가-힣]{3,}(리조트|호텔|골프장|투어|랜드|항공)/i.test(content)) score += 1;

  return score;
}

/** 리드 온도 (응답 우선순위 힌트) */
export function inferLeadTemperature(inquiry: Inquiry): InquiryLeadTemperature {
  const score = scoreLeadSignals(inquiry);
  if (score >= 5) return "hot";
  if (score >= 3) return "warm";
  return "normal";
}

function speedLabelForLead(lead: InquiryLeadTemperature): string {
  if (lead === "hot") return "30분 이내";
  if (lead === "warm") return "1시간 이내";
  return "일반 응대";
}

function channelLabelFor(lead: InquiryLeadTemperature, type: InquiryGuideType): string {
  if (type === "golf_custom" || type === "travel_quote") {
    if (lead === "hot") return "전화 병행 권장";
    if (lead === "warm") return "문자 우선 · 필요 시 전화";
    return "견적형 응대 · 문자 우선";
  }
  if (type === "product") {
    if (lead === "hot") return "전화 병행 권장";
    if (lead === "warm") return "문자 우선 · 상품 일정 확인";
    return "문자 우선";
  }
  if (lead === "hot") return "전화 병행 권장";
  if (lead === "warm") return "문자 우선 · 필요 시 전화";
  return "문자 우선";
}

const DEFAULT_CAUTION_ITEMS = [
  "가능 여부를 먼저 확정하지 말 것",
  "가격을 먼저 단정하지 말 것",
  "원문의 핵심 조건을 먼저 확인할 것",
  "대체안은 원안 확인 후 보조적으로 제안할 것",
] as const;

/** 유형별 체크리스트 기본 키·값 (DB 없을 때) */
export function getDefaultChecklist(type: InquiryGuideType): Record<string, boolean> {
  if (type === "golf_custom") {
    return {
      departure_airport: false,
      flight_included: false,
      round_count: false,
      room_type: false,
      budget: false,
    };
  }
  return {
    departure_date: false,
    people: false,
    departure_airport: false,
    budget: false,
  };
}

/** DB 저장값을 기본 키에 병합 (알 수 없는 키는 무시) */
export function mergeStoredChecklist(
  defaults: Record<string, boolean>,
  stored: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const out = { ...defaults };
  if (!stored || typeof stored !== "object") return out;
  for (const key of Object.keys(defaults)) {
    if (typeof stored[key] === "boolean") out[key] = stored[key];
  }
  return out;
}

/** 체크리스트 키 → 화면 라벨 */
export function getChecklistLabel(key: string): string {
  const labels: Record<string, string> = {
    departure_airport: "출발 공항",
    flight_included: "항공 포함 여부",
    round_count: "희망 라운드 수",
    room_type: "객실 타입",
    budget: "예산 범위",
    departure_date: "출발일(희망 시기)",
    people: "인원",
  };
  return labels[key] ?? key;
}

/** 유형별 필수 확인 항목 (표시용, 저장 없음) */
export function buildRequiredFields(type: InquiryGuideType): string[] {
  if (type === "golf_custom") {
    return ["출발 공항", "항공 포함 여부", "희망 라운드 수", "객실 타입", "예산 범위"];
  }
  return ["출발일(또는 희망 시기)", "인원", "출발 공항", "예산", "선호 지역·상품"];
}

function displayName(inquiry: Inquiry): string {
  const n = (inquiry.name ?? "").trim();
  if (n.length > 0) return n;
  return "고객";
}

/** 1차 응대 메시지 (규칙 생성, 확답·단정 금지 톤) */
export function buildFirstResponseMessage(inquiry: Inquiry, analysis: Omit<InquiryGuideAnalysis, "generatedMessage">): string {
  const name = displayName(inquiry);
  const product = (inquiry.product_title ?? "").trim();
  const type = analysis.type;

  const lines: string[] = [];

  lines.push(`안녕하세요, ${name}님. 문의 주셔서 감사합니다.`);

  if (type === "golf_custom") {
    lines.push(
      "남겨주신 일정을 기준으로 가능 여부와 예상 비용을 내부에서 확인한 뒤 순차적으로 안내드리겠습니다. (선확정 없이 진행하겠습니다.)",
      "",
      "보다 정확한 안내를 위해 아래 내용을 알려주시면 감사하겠습니다.",
      "· 출발 공항",
      "· 항공 포함 여부",
      "· 희망 라운드 수",
      "· 객실 타입",
      "· 예산 범위(대략적인 범위)",
      "",
      "확인되는 대로 가장 적합한 조건으로 안내드리겠습니다.",
    );
  } else if (type === "product" && product) {
    lines.push(
      `문의 주신 「${product}」 기준으로 일정·옵션·가용 여부를 내부에서 확인한 뒤 안내드리겠습니다.`,
      "",
      "맞춤 견적을 위해 아래를 함께 알려주시면 감사합니다.",
      "· 희망 출발일(또는 시기)",
      "· 인원 구성",
      "· 출발 공항",
      "· 예산 범위",
      "· 기타 희망 조건",
      "",
      "검토 후 가능한 범위에서 안내드리겠습니다.",
    );
  } else if (type === "travel_quote") {
    lines.push(
      "남겨주신 내용을 바탕으로 일정·인원·예산에 맞는지 내부에서 확인한 뒤 안내드리겠습니다.",
      "",
      "추가로 아래 정보를 알려주시면 상담이 더 빨라집니다.",
      "· 출발일 또는 희망 시기",
      "· 인원",
      "· 출발 공항",
      "· 예산",
      "· 선호 지역 또는 상품 성격",
      "",
      "확인되는 대로 차례대로 연락드리겠습니다.",
    );
  } else {
    lines.push(
      "맞춤 상담을 위해 몇 가지 조건만 더 확인한 뒤 안내드리겠습니다.",
      "",
      "가능하시다면 아래를 알려주세요.",
      "· 희망 출발일 또는 여행 시기",
      "· 인원",
      "· 출발 공항",
      "· 예산 범위",
      "· 희망 지역·테마",
      "",
      "내용 확인 후 연락드리겠습니다.",
    );
  }

  return lines.join("\n").trim();
}

/** 문의 1건에 대한 응대 가이드 분석 (브라우저 API 미사용) */
export function analyzeInquiryGuide(inquiry: Inquiry): InquiryGuideAnalysis {
  const content = (inquiry.content ?? "").trim();
  const type = inferInquiryType(content, inquiry.product_title);
  const leadTemperature = inferLeadTemperature(inquiry);

  const base: Omit<InquiryGuideAnalysis, "generatedMessage"> = {
    type,
    typeLabel: TYPE_LABELS[type],
    leadTemperature,
    leadTemperatureLabel: LEAD_LABELS[leadTemperature],
    responseSpeedLabel: speedLabelForLead(leadTemperature),
    responseChannelLabel: channelLabelFor(leadTemperature, type),
    requiredFields: buildRequiredFields(type),
    cautionItems: [...DEFAULT_CAUTION_ITEMS],
  };

  const generatedMessage = buildFirstResponseMessage(inquiry, base);

  return { ...base, generatedMessage };
}

export function getTemplatesByType(type: InquiryGuideType) {
  return RESPONSE_TEMPLATES.filter((t) => t.type === type);
}

export function getPhoneScriptByType(type: InquiryGuideType) {
  return PHONE_SCRIPTS.find((s) => s.type === type) ?? null;
}

export function getProposalGuideByType(type: InquiryGuideType) {
  return PROPOSAL_GUIDES.find((g) => g.type === type) ?? null;
}

export function getAlternativeStrategyByType(type: InquiryGuideType) {
  return ALTERNATIVE_STRATEGIES.find((s) => s.type === type) ?? null;
}

/** datetime-local 입력용 (브라우저 로컬 타임존 기준) */
export function formatDateTimeLocalInput(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** datetime-local 값 → UTC ISO 문자열 */
export function parseDateTimeLocalToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const LEAD_PRIORITY_LABELS: Record<InquiryLeadPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export function getLeadPriorityLabel(priority?: InquiryLeadPriority | null): string {
  if (!priority) return "";
  return LEAD_PRIORITY_LABELS[priority] ?? priority;
}

export function getLeadPriorityTone(priority?: InquiryLeadPriority | null): "red" | "amber" | "slate" {
  if (priority === "high") return "red";
  if (priority === "medium") return "amber";
  return "slate";
}
