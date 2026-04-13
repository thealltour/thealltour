import type { AdminLandingSectionType, AdminLandingTemplateType } from "@/types/adminLanding";
import {
  buildConsultingSectionCopyForLabel,
  type LandingSectionDraftCopy,
} from "@/lib/adminLandings/draftCopyBuilder";

export type DefaultLandingSectionSeed = {
  sectionType: AdminLandingSectionType;
  title: string;
  description: string;
  body: string;
  isEnabled: boolean;
  sortOrder: number;
};

export type BuildDefaultSectionsInput = {
  templateType: string;
  taxonomyName?: string | null;
  taxonomyType?: "destination" | "theme" | "product_line" | null;
  /** taxonomy 자동 생성 시 builder와 동일 문구 주입. 없으면 라벨·타입으로 규칙 생성 */
  sectionCopy?: LandingSectionDraftCopy | null;
};

function displayLabel(taxonomyDisplayName: string | null | undefined, fallback: string): string {
  const t = taxonomyDisplayName?.trim();
  return t && t.length > 0 ? t : fallback;
}

function inferTaxonomyTypeFromTemplate(
  templateType: string,
): "destination" | "theme" | "product_line" | null {
  if (templateType === "destination_consulting") return "destination";
  if (templateType === "theme_consulting") return "theme";
  if (templateType === "product_line_consulting") return "product_line";
  return null;
}

function fallbackLabelForTaxonomyType(
  taxonomyType: "destination" | "theme" | "product_line" | null,
): string {
  if (taxonomyType === "destination") return "목적지";
  if (taxonomyType === "theme") return "테마";
  if (taxonomyType === "product_line") return "상품군";
  return "목적지";
}

function resolveTemplateArgs(
  templateTypeOrInput: string | BuildDefaultSectionsInput,
  taxonomyDisplayName?: string | null,
  taxonomyTypeArg?: "destination" | "theme" | "product_line" | null,
): {
  templateType: string;
  label: string;
  sectionCopy?: LandingSectionDraftCopy | null;
} {
  if (typeof templateTypeOrInput === "object" && templateTypeOrInput !== null) {
    const { templateType, taxonomyName, taxonomyType: tt, sectionCopy } = templateTypeOrInput;
    const effectiveType = tt ?? inferTaxonomyTypeFromTemplate(templateType);
    const fallback = fallbackLabelForTaxonomyType(effectiveType);
    return {
      templateType,
      label: displayLabel(taxonomyName, fallback),
      sectionCopy: sectionCopy ?? null,
    };
  }
  const effectiveType = taxonomyTypeArg ?? inferTaxonomyTypeFromTemplate(templateTypeOrInput);
  const fallback = fallbackLabelForTaxonomyType(effectiveType);
  return {
    templateType: templateTypeOrInput,
    label: displayLabel(taxonomyDisplayName, fallback),
    sectionCopy: null,
  };
}

function buildConsultingSeeds(
  label: string,
  taxonomyType: "destination" | "theme" | "product_line",
  sectionCopy?: LandingSectionDraftCopy | null,
): DefaultLandingSectionSeed[] {
  const copy = sectionCopy ?? buildConsultingSectionCopyForLabel(label, taxonomyType);
  const { hero, intro, cta, consultingPoints } = copy;

  const faqTitle =
    taxonomyType === "product_line" ? `${label} 자주 묻는 질문` : `${label} 여행 자주 묻는 질문`;
  const faqDescription =
    taxonomyType === "product_line"
      ? "예약·변경·결제를 한눈에 정리했습니다."
      : `${label} 여행 예약·변경·결제를 한눈에 정리했습니다.`;

  return [
    {
      sectionType: "hero",
      title: hero.title,
      description: hero.description,
      body: hero.body,
      isEnabled: true,
      sortOrder: 0,
    },
    {
      sectionType: "intro",
      title: intro.title,
      description: intro.description,
      body: intro.body,
      isEnabled: true,
      sortOrder: 1,
    },
    {
      sectionType: "cta",
      title: cta.title,
      description: cta.description,
      body: cta.body,
      isEnabled: true,
      sortOrder: 2,
    },
    {
      sectionType: "consulting_points",
      title: consultingPoints.title,
      description: consultingPoints.description,
      body: consultingPoints.body,
      isEnabled: true,
      sortOrder: 3,
    },
    {
      sectionType: "faq",
      title: faqTitle,
      description: faqDescription,
      body: "예약 가능 시점, 변경/취소 규정, 결제 방식을 먼저 확인해 보세요.",
      isEnabled: true,
      sortOrder: 4,
    },
  ];
}

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

export function getDefaultSectionsForTemplate(input: BuildDefaultSectionsInput): DefaultLandingSectionSeed[];
export function getDefaultSectionsForTemplate(
  templateType: string,
  taxonomyDisplayName?: string | null,
  taxonomyType?: "destination" | "theme" | "product_line" | null,
): DefaultLandingSectionSeed[];
export function getDefaultSectionsForTemplate(
  templateTypeOrInput: string | BuildDefaultSectionsInput,
  taxonomyDisplayName?: string | null,
  taxonomyType?: "destination" | "theme" | "product_line" | null,
): DefaultLandingSectionSeed[] {
  const { templateType, label, sectionCopy } = resolveTemplateArgs(
    templateTypeOrInput,
    taxonomyDisplayName,
    taxonomyType,
  );
  const t = templateType as AdminLandingTemplateType;
  if (t === "destination_consulting") {
    return buildConsultingSeeds(label, "destination", sectionCopy).map((s) => ({ ...s }));
  }
  if (t === "theme_consulting") {
    return buildConsultingSeeds(label, "theme", sectionCopy).map((s) => ({ ...s }));
  }
  if (t === "product_line_consulting") {
    return buildConsultingSeeds(label, "product_line", sectionCopy).map((s) => ({ ...s }));
  }
  if (t === "recommended_collection") {
    return recommendedCollectionSections.map((s) => ({ ...s }));
  }
  return customSections.map((s) => ({ ...s }));
}
