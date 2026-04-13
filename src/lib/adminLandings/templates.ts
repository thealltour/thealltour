import type { AdminLandingSectionType, AdminLandingTemplateType } from "@/types/adminLanding";

export type DefaultLandingSectionSeed = {
  sectionType: AdminLandingSectionType;
  title: string;
  description: string;
  body: string;
  isEnabled: boolean;
  sortOrder: number;
};

const destinationConsultingSections: DefaultLandingSectionSeed[] = [
  {
    sectionType: "hero",
    title: "목적지 상담 랜딩",
    description: "원하시는 지역과 일정에 맞춰 여행 상담을 도와드립니다.",
    body: "여행 목적, 예산, 희망 일정을 남겨주시면 맞춤 플랜을 제안합니다.",
    isEnabled: true,
    sortOrder: 0,
  },
  {
    sectionType: "intro",
    title: "상담 안내",
    description: "초기 상담에서 확인하는 핵심 항목입니다.",
    body: "인원, 일정, 예산, 선호 숙소/이동 수단을 우선 확인합니다.",
    isEnabled: true,
    sortOrder: 1,
  },
  {
    sectionType: "consulting_points",
    title: "추천 포인트",
    description: "상담 후 제공되는 핵심 추천 항목입니다.",
    body: "항공/숙소/이동 동선/체류 일정까지 일괄 제안합니다.",
    isEnabled: true,
    sortOrder: 2,
  },
  {
    sectionType: "faq",
    title: "자주 묻는 질문",
    description: "상담 전 많이 질문하시는 내용을 모았습니다.",
    body: "예약 가능 시점, 변경/취소 규정, 결제 방식 등을 확인해 보세요.",
    isEnabled: true,
    sortOrder: 3,
  },
  {
    sectionType: "cta",
    title: "상담 신청",
    description: "지금 상담을 시작해 보세요.",
    body: "상담 신청 후 담당자가 순차적으로 연락드립니다.",
    isEnabled: true,
    sortOrder: 4,
  },
];

const themeConsultingSections: DefaultLandingSectionSeed[] = [
  { ...destinationConsultingSections[0], title: "테마 상담 랜딩", description: "테마 중심 상담을 진행합니다." },
  { ...destinationConsultingSections[1], sortOrder: 1 },
  {
    sectionType: "recommended_targets",
    title: "추천 대상",
    description: "이런 분께 특히 적합합니다.",
    body: "동행 형태/여행 스타일/예산에 따라 추천 시나리오를 제공합니다.",
    isEnabled: true,
    sortOrder: 2,
  },
  { ...destinationConsultingSections[3], sortOrder: 3 },
  { ...destinationConsultingSections[4], sortOrder: 4 },
];

const productLineConsultingSections: DefaultLandingSectionSeed[] = [
  {
    ...destinationConsultingSections[0],
    title: "상품군 상담 랜딩",
    description: "상품군(라인) 중심으로 여행 상담을 진행합니다.",
    body: "골프·파크골프 등 상품군별 니즈에 맞춰 일정과 상품 구성을 제안합니다.",
  },
  { ...themeConsultingSections[1], sortOrder: 1 },
  { ...themeConsultingSections[2], sortOrder: 2 },
  { ...destinationConsultingSections[3], sortOrder: 3 },
  { ...destinationConsultingSections[4], sortOrder: 4 },
];

const recommendedCollectionSections: DefaultLandingSectionSeed[] = [
  {
    sectionType: "hero",
    title: "추천 컬렉션 랜딩",
    description: "엄선된 추천 상품을 한 번에 확인하세요.",
    body: "검증된 인기 상품을 주제별로 정리했습니다.",
    isEnabled: true,
    sortOrder: 0,
  },
  {
    sectionType: "intro",
    title: "컬렉션 소개",
    description: "이번 컬렉션의 기획 의도를 소개합니다.",
    body: "추천 기준과 대상 고객을 간단히 안내합니다.",
    isEnabled: true,
    sortOrder: 1,
  },
  {
    sectionType: "consulting_points",
    title: "추천 기준",
    description: "상품 선별 기준을 공개합니다.",
    body: "가격 대비 만족도, 동선, 시즌성, 상담 반응을 반영했습니다.",
    isEnabled: true,
    sortOrder: 2,
  },
  {
    sectionType: "cta",
    title: "문의하기",
    description: "원하시는 조건을 남겨 주세요.",
    body: "상담 요청 시 추천 상품 기준으로 우선 안내드립니다.",
    isEnabled: true,
    sortOrder: 3,
  },
];

const customSections: DefaultLandingSectionSeed[] = [
  {
    sectionType: "hero",
    title: "커스텀 랜딩",
    description: "자유형 랜딩의 시작 섹션입니다.",
    body: "필요한 섹션을 이후 단계에서 추가/수정할 수 있습니다.",
    isEnabled: true,
    sortOrder: 0,
  },
  {
    sectionType: "intro",
    title: "소개",
    description: "기본 소개 섹션입니다.",
    body: "서비스/상품 특징을 간단히 정리하세요.",
    isEnabled: true,
    sortOrder: 1,
  },
  {
    sectionType: "cta",
    title: "상담 요청",
    description: "행동 유도 섹션입니다.",
    body: "문의 또는 신청 버튼 영역을 이 섹션에 배치합니다.",
    isEnabled: true,
    sortOrder: 2,
  },
];

const TEMPLATE_DEFAULTS: Record<AdminLandingTemplateType, DefaultLandingSectionSeed[]> = {
  destination_consulting: destinationConsultingSections,
  theme_consulting: themeConsultingSections,
  product_line_consulting: productLineConsultingSections,
  recommended_collection: recommendedCollectionSections,
  custom: customSections,
};

export function getDefaultSectionsForTemplate(templateType: string): DefaultLandingSectionSeed[] {
  const t = templateType as AdminLandingTemplateType;
  const found = TEMPLATE_DEFAULTS[t];
  if (!found) return customSections;
  return found.map((s) => ({ ...s }));
}
