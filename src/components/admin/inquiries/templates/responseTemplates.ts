import type { Inquiry } from "@/types/inquiry";
import type { ResponseTemplate } from "../inquiryResponseGuide.types";

function displayName(inquiry: Inquiry): string {
  const n = (inquiry.name ?? "").trim();
  return n.length > 0 ? n : "고객";
}

export const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    id: "golf_custom_basic",
    type: "golf_custom",
    title: "골프 맞춤 기본 응답",
    description: "일정·비용 확인 전 톤",
    build: (inquiry) => {
      const name = displayName(inquiry);
      return `
안녕하세요 ${name}님 😊

남겨주신 일정 기준으로
가능 여부 및 예상 비용을 먼저 확인해보겠습니다.

정확한 안내를 위해 아래 내용 부탁드립니다.

* 출발 공항
* 항공 포함 여부
* 희망 라운드 수
* 객실 타입
* 예산 범위

확인되는 대로 가장 적합한 일정으로 안내드리겠습니다.
`.trim();
    },
  },
  {
    id: "travel_quote_standard",
    type: "travel_quote",
    title: "견적·일정 표준 응답",
    build: (inquiry) => {
      const name = displayName(inquiry);
      return `
안녕하세요, ${name}님. 문의 주셔서 감사합니다.

희망 일정·인원에 맞는 가능 여부와 대략적인 구성을 내부에서 확인한 뒤 안내드리겠습니다.

가능하시면 아래를 함께 알려주시면 상담이 빨라집니다.
* 출발일 또는 희망 시기
* 인원
* 출발 공항
* 예산 범위
* 선호 지역·테마

확인되는 대로 순서대로 연락드리겠습니다.
`.trim();
    },
  },
  {
    id: "product_named",
    type: "product",
    title: "상품 지정 문의 응답",
    build: (inquiry) => {
      const name = displayName(inquiry);
      const title = (inquiry.product_title ?? "").trim() || "문의 주신 상품";
      return `
안녕하세요, ${name}님.

「${title}」 일정·옵션·가용 여부를 확인한 뒤 안내드리겠습니다.

맞춤 견적을 위해 희망 출발일(또는 시기), 인원, 출발 공항, 예산 범위를 알려주시면 감사하겠습니다.

검토 후 가능한 범위에서 안내드리겠습니다.
`.trim();
    },
  },
  {
    id: "fast_short",
    type: "general",
    title: "빠른 응답용",
    build: (inquiry) => {
      const name = displayName(inquiry);
      return `
안녕하세요 ${name}님,
문의 주셔서 감사합니다.

가능 여부 확인 후 빠르게 안내드리겠습니다.
출발일/인원/출발공항만 먼저 부탁드립니다.
`.trim();
    },
  },
  {
    id: "general_polite",
    type: "general",
    title: "일반 상담 안내",
    build: (inquiry) => {
      const name = displayName(inquiry);
      return `
안녕하세요, ${name}님. 문의 주셔서 감사합니다.

맞춤 상담을 위해 여행 시기, 인원, 출발 공항, 예산, 희망 지역을 알려주시면 내용 확인 후 안내드리겠습니다.
`.trim();
    },
  },
];
