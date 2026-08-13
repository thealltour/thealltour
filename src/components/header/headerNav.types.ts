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

/** 2단계 그룹(지역별: 대분류 하위의 중분류). 3단계 items 보유 */
export type HeaderNavSubGroup = {
  key: string;
  label: string;
  /** 중분류 클릭 시 이동 URL */
  labelHref?: string;
  items: HeaderNavLeafItem[];
};

/** 그룹(드롭다운/메가메뉴용): 라벨 + 하위 링크 목록. labelHref 있으면 대분류 라벨도 링크. */
export type HeaderNavGroup = {
  key: string;
  label: string;
  /** 대분류 클릭 시 이동 URL. 있으면 왼쪽 라벨을 링크로 렌더링 */
  labelHref?: string;
  /** 평면 목록(테마별·추천 등). subGroups 있으면 비워둠 */
  items: HeaderNavLeafItem[];
  /** 지역별 3단계: 2단계(중분류) 목록. 있으면 컬럼/캐스케이드 UI 사용 */
  subGroups?: HeaderNavSubGroup[];
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

/** 상단 유틸리티 메뉴(회사소개~고객센터) 활성 탭 */
export type HeaderUtilityTab =
  | "about"
  | "quote"
  | "reviews"
  | "guides"
  | "blog"
  | "support"
  | "products"
  | "signup";
