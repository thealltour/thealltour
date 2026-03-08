/**
 * 상세 랜딩 하위 탐색 카드(landing subnode) 타입.
 * 클룩식으로 상세 랜딩 안에서 도시/소지역/세부 테마/스타일/스팟 등으로 세분화 탐색.
 */

export type LandingParentKind = "destination" | "theme" | "recommended";

export type LandingNodeType =
  | "city"
  | "subdestination"
  | "subtheme"
  | "style"
  | "spot"
  | "custom";

/**
 * 카드 클릭 시 /products?...) 쿼리를 만들기 위한 payload.
 * destination/theme 은 slug(예: japan, golf-travel), region/theme 은 이름(예: 일본, 골프 여행).
 * 랜딩에서는 destination, city, theme(slug) 사용 권장 → 서버에서 region/theme/q 로 해석.
 */
export type LandingSubnodeFilterPayload = {
  /** 지역 slug (상세 랜딩 맥락). 서버에서 region 이름으로 해석 */
  destination?: string;
  /** 도시/세부 키워드. 서버에서 q 로 사용 */
  city?: string;
  /** 테마 slug 또는 이름 */
  theme?: string;
  /** 지역(카테고리) 이름 (직접 전달 시) */
  region?: string;
  /** 검색어 */
  q?: string;
  tourType?: string;
  sort?: string;
  style?: string;
  [key: string]: string | undefined;
};

export type LandingSubnode = {
  id: string;
  parent_kind: LandingParentKind;
  parent_slug: string;
  node_type: LandingNodeType;
  title: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  badge_label?: string | null;
  sort_order: number;
  is_active: boolean;
  filter_payload: LandingSubnodeFilterPayload;
  created_at?: string | null;
  updated_at?: string | null;
};
