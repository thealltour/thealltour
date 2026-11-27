import {
  buildCorporateQuoteHref,
  type CorporateQuoteCategory,
} from "@/lib/corporate/buildCorporateQuoteHref";

export type CorporateSegmentId =
  | "business"
  | "public-enterprises"
  | "public-institutions"
  | "councils";

export type CorporateItineraryStatus = "예시" | "면담 후보" | "협의 대상" | "선택 가능";

export type CorporateItineraryStep = {
  title: string;
  detail: string;
  status: CorporateItineraryStatus;
};

export type CorporateProgram = {
  /** URL·저장용 안정 ID */
  id: string;
  title: string;
  summary: string;
};

/** Tailwind object-* utility for cover crop focus (e.g. object-[center_35%]). */
export type CorporateImageAsset = {
  src: string;
  width: number;
  height: number;
  alt: string;
  mobileObjectPosition: string;
  desktopObjectPosition?: string;
  /** 생성 사진: 이미지 밖 캡션 */
  showExampleCaption: boolean;
};

export type CorporateDownloadAsset = {
  href: string;
  label: string;
  fileName: string;
  bytes: number;
  pages: number;
};

export type CorporateSegmentContent = {
  id: CorporateSegmentId;
  path: `/corporate/${CorporateSegmentId}`;
  navLabel: string;
  title: string;
  description: string;
  intro: string;
  quoteCategory: CorporateQuoteCategory;
  programs: CorporateProgram[];
  sampleItinerary: {
    title: string;
    summary: string;
    steps: CorporateItineraryStep[];
  };
  supportScope: string[];
  negotiationNotes: string[];
  /** 장면 사진이 public에 있을 때만 설정. 없으면 UI는 텍스트만 유지. */
  image: CorporateImageAsset | null;
  download: CorporateDownloadAsset | null;
};

/** 홈·허브·세그먼트에 연결된 장면 사진 경로 (실파일 검증용). */
export const CORPORATE_IMAGE_FILES = [
  "public/images/corporate/hub-hotel-briefing.jpg",
  "public/images/corporate/business-reward-dinner.jpg",
  "public/images/corporate/public-enterprises-facility.jpg",
  "public/images/corporate/public-institutions-field.jpg",
  "public/images/corporate/councils-briefing.jpg",
] as const;

export const CORPORATE_HUB_PATH = "/corporate" as const;

export const CORPORATE_HUB = {
  path: CORPORATE_HUB_PATH,
  navLabel: "기업·단체여행",
  title: "기업·기관 단체여행",
  description:
    "포상여행부터 직무연수·정책시찰까지, 조직 목적에 맞춰 일정을 함께 설계합니다.",
  intro:
    "기업·공기업·공공기관·의회 등 조직 성격에 맞는 단체여행을 상담합니다. 확정되지 않은 면담·방문은 후보로만 안내하며, 실제 일정은 협의 후 확정합니다.",
  supportScope: [
    "목적·인원·예산에 맞춘 일정 초안 제안",
    "숙소·이동·현지 동선 조율",
    "행사·시상·만찬 등 부대 프로그램 협의",
    "참가자 안내문·일정표 초안 지원",
  ],
  processSteps: [
    { title: "상담 접수", detail: "목적·일정·인원·예산을 먼저 확인합니다." },
    { title: "일정 초안", detail: "고객군별 예시와 후보지를 바탕으로 초안을 제안합니다." },
    { title: "협의·조정", detail: "면담·견학·행사 등 협의 대상을 함께 좁혀 갑니다." },
    { title: "견적·확정", detail: "합의된 범위로 견적을 정리하고 진행 여부를 결정합니다." },
  ],
  /** 홈·허브 공용 대표 사진 */
  image: {
    src: "/images/corporate/hub-hotel-briefing.jpg",
    width: 1672,
    height: 941,
    alt: "호텔 로비에서 일정 자료를 보며 브리핑을 듣는 기업·단체 여행 일행",
    mobileObjectPosition: "object-[70%_42%]",
    desktopObjectPosition: "object-[62%_40%]",
    showExampleCaption: true,
  } satisfies CorporateImageAsset,
  download: {
    href: "/downloads/corporate/corporate-program-guide-4p.pdf",
    label: "기업·기관 단체 프로그램 공통 안내서",
    fileName: "corporate-program-guide-4p.pdf",
    bytes: 53430,
    pages: 4,
  } satisfies CorporateDownloadAsset,
};

export const CORPORATE_SEGMENTS: readonly CorporateSegmentContent[] = [
  {
    id: "business",
    path: "/corporate/business",
    navLabel: "기업",
    title: "기업 단체여행",
    description: "인센티브·포상, 워크숍·팀빌딩, 기업 골프, 비즈니스 출장 일정을 상담합니다.",
    intro:
      "성과 포상과 팀 프로그램부터 비즈니스 일정까지, 기업 목적에 맞는 단체여행을 설계합니다. 관광·행사 구성은 협의에 따라 조정됩니다.",
    quoteCategory: "corporate-business",
    programs: [
      {
        id: "incentive-reward",
        title: "인센티브·포상",
        summary: "성과 인정과 휴식을 함께 담은 포상여행 구성",
      },
      {
        id: "workshop-teambuilding",
        title: "워크숍·팀빌딩",
        summary: "회의·팀 프로그램과 선택 관광을 균형 있게 배치",
      },
      {
        id: "corporate-golf",
        title: "기업 골프",
        summary: "라운딩과 이동·숙박을 맞춘 기업 골프 일정",
      },
      {
        id: "business-trip",
        title: "비즈니스 출장",
        summary: "미팅·이동 동선을 중심으로 한 출장형 일정",
      },
    ],
    sampleItinerary: {
      title: "3박 4일 포상여행 예시",
      summary: "팀 프로그램 → 시상·만찬 → 선택 관광 흐름의 예시 일정입니다.",
      steps: [
        {
          title: "팀 프로그램",
          detail: "도착 후 팀 소개·아이스브레이크 등 가벼운 팀 활동",
          status: "예시",
        },
        {
          title: "시상·만찬",
          detail: "포상 시상과 만찬 자리 구성(장소·형식은 협의)",
          status: "협의 대상",
        },
        {
          title: "선택 관광",
          detail: "자유 시간 또는 선택 관광 코스",
          status: "선택 가능",
        },
      ],
    },
    supportScope: [
      "포상·워크숍·골프·출장형 일정 초안",
      "숙소·이동·행사 장소 후보 조율",
      "시상·만찬 등 부대 프로그램 협의",
    ],
    negotiationNotes: [
      "행사 장소와 시상 형식은 확정 전이면 협의 대상으로 표기합니다.",
      "방문·면담이 필요한 경우에도 후보 단계로만 안내합니다.",
    ],
    image: {
      src: "/images/corporate/business-reward-dinner.jpg",
      width: 1672,
      height: 941,
      alt: "해안 테라스에서 만찬을 나누는 기업 포상여행 일행",
      mobileObjectPosition: "object-[55%_48%]",
      desktopObjectPosition: "object-[52%_45%]",
      showExampleCaption: true,
    },
    download: {
      href: "/downloads/corporate/business-proposal-summary-1p.pdf",
      label: "기업 행사 제안 요약서",
      fileName: "business-proposal-summary-1p.pdf",
      bytes: 40829,
      pages: 1,
    },
  },
  {
    id: "public-enterprises",
    path: "/corporate/public-enterprises",
    navLabel: "공기업",
    title: "공기업 직무연수 여행",
    description: "에너지·환경, 교통·시설 운영 등 직무연수형 일정을 상담합니다.",
    intro:
      "공기업 직무와 연계한 연수·견학 일정을 중심으로 상담합니다. 운영사 브리핑과 시설 견학은 가능 여부를 협의한 뒤 확정합니다.",
    quoteCategory: "corporate-public-enterprises",
    programs: [
      {
        id: "energy-environment",
        title: "에너지·환경 연수",
        summary: "에너지·환경 관련 현장 이해와 토론을 위한 일정",
      },
      {
        id: "transport-facility",
        title: "교통·시설 운영 연수",
        summary: "교통·시설 운영 사례를 살펴보는 직무연수형 구성",
      },
    ],
    sampleItinerary: {
      title: "직무연수 일정 예시",
      summary: "운영사 브리핑 → 시설 견학 → 참가자 토론 흐름의 예시입니다.",
      steps: [
        {
          title: "운영사 브리핑",
          detail: "관련 운영사·기관 브리핑 후보",
          status: "면담 후보",
        },
        {
          title: "시설 견학",
          detail: "시설·현장 견학 후보 동선",
          status: "협의 대상",
        },
        {
          title: "참가자 토론",
          detail: "견학 내용을 바탕으로 한 참가자 토론·정리",
          status: "예시",
        },
      ],
    },
    supportScope: [
      "직무연수 목적에 맞춘 일정 초안",
      "브리핑·견학 후보지 조율 지원",
      "참가자 토론·정리 시간 배치",
    ],
    negotiationNotes: [
      "기관·운영사 면담과 시설 견학은 확정 일정이 아닙니다.",
      "가능 여부는 상담 후 협의하며, 화면에는 후보·협의 대상으로만 표기합니다.",
    ],
    image: {
      src: "/images/corporate/public-enterprises-facility.jpg",
      width: 1672,
      height: 941,
      alt: "안전모를 쓴 일행이 시설 담당자의 설명을 들으며 현대식 에너지 설비를 견학하는 모습",
      mobileObjectPosition: "object-[58%_48%]",
      desktopObjectPosition: "object-[55%_45%]",
      showExampleCaption: true,
    },
    download: {
      href: "/downloads/corporate/public-enterprises-training-brief-1p.pdf",
      label: "직무연수 검토자료",
      fileName: "public-enterprises-training-brief-1p.pdf",
      bytes: 40604,
      pages: 1,
    },
  },
  {
    id: "public-institutions",
    path: "/corporate/public-institutions",
    navLabel: "공공기관",
    title: "공공기관 정책연수·답사",
    description: "도시재생·지역관광·복지·교육 등 정책연수·답사 일정을 상담합니다.",
    intro:
      "정책 현장 이해와 참가자 정리를 중심으로 한 연수·답사 일정을 상담합니다. 관계기관 면담은 후보로만 안내합니다.",
    quoteCategory: "corporate-public-institutions",
    programs: [
      {
        id: "urban-tourism",
        title: "도시재생·지역관광",
        summary: "도시재생·지역관광 정책 현장 이해형 일정",
      },
      {
        id: "welfare-education",
        title: "복지·교육 정책연수",
        summary: "복지·교육 현장 답사와 참가자 정리",
      },
    ],
    sampleItinerary: {
      title: "정책연수·답사 예시",
      summary: "관계기관 면담 후보 → 정책 현장 답사 → 참가자 정리 흐름입니다.",
      steps: [
        {
          title: "관계기관 면담 후보",
          detail: "관련 기관·부서 면담 후보 일정",
          status: "면담 후보",
        },
        {
          title: "정책 현장 답사",
          detail: "정책이 적용된 현장·사례지 답사",
          status: "협의 대상",
        },
        {
          title: "참가자 정리",
          detail: "답사 내용 공유와 참가자 정리 시간",
          status: "예시",
        },
      ],
    },
    supportScope: [
      "정책연수·답사 목적에 맞춘 일정 초안",
      "면담·답사 후보지 조율 지원",
      "참가자 정리·공유 시간 배치",
    ],
    negotiationNotes: [
      "관계기관 면담은 확정된 일정이 아니며 면담 후보로만 표기합니다.",
      "현장 답사 범위는 협의 후 확정합니다.",
    ],
    image: {
      src: "/images/corporate/public-institutions-field.jpg",
      width: 1672,
      height: 941,
      alt: "산업 유산 재생 공간에서 안내자의 설명을 들으며 현장 답사하는 공공기관 일행",
      mobileObjectPosition: "object-[65%_45%]",
      desktopObjectPosition: "object-[60%_42%]",
      showExampleCaption: true,
    },
    download: {
      href: "/downloads/corporate/public-institutions-policy-brief-1p.pdf",
      label: "정책연수·답사 검토자료",
      fileName: "public-institutions-policy-brief-1p.pdf",
      bytes: 37831,
      pages: 1,
    },
  },
  {
    id: "councils",
    path: "/corporate/councils",
    navLabel: "의회",
    title: "의회 위원회 시찰",
    description: "교통·도시·복지 등 위원회 주제별 시찰 일정을 상담합니다.",
    intro:
      "위원회 주제에 맞춘 시찰·사례 탐방 일정을 상담합니다. 지방의회 면담과 현장 방문은 후보·협의 단계로만 안내합니다.",
    quoteCategory: "corporate-councils",
    programs: [
      {
        id: "transport-urban",
        title: "교통·도시 시찰",
        summary: "교통 운영·도시정책 사례를 중심으로 한 시찰",
      },
      {
        id: "welfare-committee",
        title: "복지 등 위원회 주제 시찰",
        summary: "복지 등 위원회 안건에 맞춘 현장 시찰",
      },
    ],
    sampleItinerary: {
      title: "위원회 시찰 예시",
      summary: "지방의회 면담 후보 → 교통 운영 현장 → 도시정책 사례지 흐름입니다.",
      steps: [
        {
          title: "지방의회 면담 후보",
          detail: "관련 지방의회·위원회 면담 후보",
          status: "면담 후보",
        },
        {
          title: "교통 운영 현장",
          detail: "교통 운영 관련 현장 방문 후보",
          status: "협의 대상",
        },
        {
          title: "도시정책 사례지",
          detail: "도시정책 사례지 탐방",
          status: "협의 대상",
        },
      ],
    },
    supportScope: [
      "위원회 주제별 시찰 일정 초안",
      "면담·현장 후보지 조율 지원",
      "사례지 동선·이동 계획 협의",
    ],
    negotiationNotes: [
      "지방의회 면담과 현장 방문은 수행 실적을 보장하지 않으며 후보로만 표기합니다.",
      "실제 면담·견학 가능 여부는 상담 후 협의합니다.",
    ],
    image: {
      src: "/images/corporate/councils-briefing.jpg",
      width: 1672,
      height: 941,
      alt: "회의실에서 해외 시의회 정책 브리핑을 경청하는 시찰단",
      mobileObjectPosition: "object-[68%_40%]",
      desktopObjectPosition: "object-[62%_38%]",
      showExampleCaption: true,
    },
    download: {
      href: "/downloads/corporate/councils-inspection-brief-1p.pdf",
      label: "의회 정책시찰 검토자료",
      fileName: "councils-inspection-brief-1p.pdf",
      bytes: 39014,
      pages: 1,
    },
  },
] as const satisfies readonly CorporateSegmentContent[];

export function getCorporateSegment(id: CorporateSegmentId): CorporateSegmentContent {
  const found = CORPORATE_SEGMENTS.find((segment) => segment.id === id);
  if (!found) throw new Error(`Unknown corporate segment: ${id}`);
  return found;
}

export function getCorporateSegmentQuoteHref(
  id: CorporateSegmentId,
  programId?: string | null,
): string {
  const segment = getCorporateSegment(id);
  return buildCorporateQuoteHref({
    sourcePath: segment.path,
    quoteCategory: segment.quoteCategory,
    program: programId,
  });
}

export function getCorporateProgramQuoteHref(
  segmentId: CorporateSegmentId,
  programId: string,
): string {
  return getCorporateSegmentQuoteHref(segmentId, programId);
}

export function getCorporateHubQuoteHref(): string {
  return buildCorporateQuoteHref({
    sourcePath: CORPORATE_HUB_PATH,
    quoteCategory: "corporate",
  });
}

/** 헤더 메가메뉴·모바일 아코디언 공통 하위 링크 */
export function getCorporateNavLeafItems(): {
  key: string;
  label: string;
  href: string;
}[] {
  return [
    ...CORPORATE_SEGMENTS.map((segment) => ({
      key: `corporate-${segment.id}`,
      label: segment.navLabel,
      href: segment.path,
    })),
    {
      key: "corporate-quote",
      label: "기업·기관 견적",
      href: getCorporateHubQuoteHref(),
    },
    {
      key: "family-group-quote",
      label: "가족·동호회 단체 견적",
      href: "/quote",
    },
  ];
}
