/**
 * 헤더 네비게이션 IA 상수
 * 1차 메뉴 key/label, 그룹 key — 데스크톱/모바일 공통 재사용
 */

/** 1차 메뉴 내부 key (라벨과 분리) */
export const HEADER_PRIMARY_NAV_KEYS = [
  "recommended",
  "region",
  "theme",
  "inquiry",
  "guides",
  "support",
] as const;

export type HeaderPrimaryNavKey = (typeof HEADER_PRIMARY_NAV_KEYS)[number];

/** 1차 메뉴: key ↔ 사용자 노출 label */
export const HEADER_PRIMARY_NAV_ITEMS: ReadonlyArray<{ key: HeaderPrimaryNavKey; label: string }> = [
  { key: "recommended", label: "추천여행" },
  { key: "region", label: "지역별 여행" },
  { key: "theme", label: "테마별 여행" },
  { key: "inquiry", label: "맞춤/단체문의" },
  { key: "guides", label: "여행가이드" },
  { key: "support", label: "고객센터" },
];

/** 그룹 식별용 key (추천/지역/테마 하위 그룹) */
export const HEADER_NAV_GROUP_KEYS = {
  RECOMMENDED: "recommended",
  REGION: "region",
  THEME: "theme",
} as const;

/** 정적 1차 메뉴용 기본 href (메가메뉴 없이 상단만 쓸 때) */
export const HEADER_PRIMARY_NAV_DEFAULT_HREF: Record<HeaderPrimaryNavKey, string> = {
  recommended: "/recommended",
  region: "/destinations",
  theme: "/themes",
  inquiry: "/quote",
  guides: "/guides",
  support: "/support",
};

/** 데스크톱 2행에 노출할 1차 탐색축 메뉴 key (추천·지역·테마·맞춤문의) */
export const HEADER_DESKTOP_PRIMARY_NAV_KEYS: readonly HeaderPrimaryNavKey[] = [
  "recommended",
  "region",
  "theme",
  "inquiry",
];
