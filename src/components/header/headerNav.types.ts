/**
 * 헤더 네비게이션 IA 타입
 * 데이터 소스: getHeaderNavigationData() (taxonomy + home-curated)
 */

/** 단일 링크(리프) 항목 */
export type HeaderNavLeafItem = {
  key: string;
  label: string;
  href: string;
};

/** 그룹(드롭다운/메가메뉴용): 라벨 + 하위 링크 목록 */
export type HeaderNavGroup = {
  key: string;
  label: string;
  items: HeaderNavLeafItem[];
};

/** 1차 메뉴 항목: 직접 링크(href) 또는 그룹(groups) 소유 */
export type HeaderPrimaryNavItem = {
  key: string;
  label: string;
  /** 직접 이동 링크(맞춤/단체문의 등) */
  href?: string;
  /** 하위 그룹(추천/지역/테마 등) */
  groups?: HeaderNavGroup[];
};

/** 전체 헤더 네비게이션 데이터 */
export type HeaderNavigationData = {
  primaryNav: HeaderPrimaryNavItem[];
};
