export type IncludedTemplateItem = {
  id: string;
  label: string;
  included: string;
  excluded: string;
  optional: string;
};

export type TextSnippetTemplate = {
  id: string;
  label: string;
  content: string;
};

export const INCLUDED_TEMPLATES: IncludedTemplateItem[] = [
  {
    id: "golf-basic",
    label: "골프 기본형",
    included: `왕복 항공권
호텔 숙박
조식 포함
그린피`,
    excluded: `캐디피
카트비
개인 경비`,
    optional: `마사지
관광 투어`,
  },
];

export const TERMS_TEMPLATES: TextSnippetTemplate[] = [
  {
    id: "default-terms",
    label: "기본 약관",
    content: `취소 및 환불 규정
출발 30일 전: 전액 환불
출발 7일 전: 50% 환불`,
  },
];

export const DESCRIPTION_TEMPLATES: TextSnippetTemplate[] = [
  {
    id: "basic-desc",
    label: "기본 설명 구조",
    content: `✔ 상품 포인트
- 

✔ 추천 대상
- 

✔ 여행 특징
- `,
  },
];
