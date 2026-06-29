import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  PRODUCT_VIEW_TO_LABEL,
} from "@/components/admin/products/adminProducts.constants";
import { getAdminConsoleRelativePath, isAdminReviewSectionRelativePath } from "@/lib/adminConsolePaths";

export const ADMIN_MANAGER_PREFIX = "/theall_manager_only";

export const ADMIN_MENU_MAP = {
  dashboard: ["오늘 할 일", "지표·리드"],
  product: ["상품 목록", "상품 등록", "상품 등록(모두)", "상품 등록(하나)", "상품 등록(밴드)", "카테고리/테마 관리"],
  home: ["메인 골프투어 상품", "메인 지역카드", "메인 테마카드", "메인 추천상품", "메인배너"],
  landings: ["랜딩 목록", "taxonomy 기반 생성", "성과·UTM", "골프 리드 (UTM)"],
  inquiry: ["전체 문의", "미처리 문의", "운영 대시보드"],
  bookings: ["예약 목록", "예약 생성"],
  sms: [] as string[],
  member_rewards: ["회원 목록", "포인트 지급", "적립 요청", "교환 신청"],
  settings: [] as string[],
  reviews: [] as string[],
  guides: ["가이드 목록", "가이드등록(노션)", "가이드등록(일반)"],
  notices: ["회원가입 법률 문서", "공지 등록", "등록된 공지 목록"],
  notifications: ["알림 목록", "OS 푸시 알림", "로그인된 기기"],
  tools_hanatour: [] as string[],
  tools_modetour: [] as string[],
} as const;

export type MainMenuKey = keyof typeof ADMIN_MENU_MAP;

export const MAIN_MENU_TITLE: Record<MainMenuKey, string> = {
  dashboard: "대시보드",
  product: "상품",
  home: "홈·배너 구성",
  landings: "랜딩·유입",
  inquiry: "문의·상담",
  bookings: "예약 관리",
  sms: "SMS 센터",
  member_rewards: "회원·리워드",
  settings: "환경설정",
  reviews: "후기",
  guides: "여행가이드",
  notices: "공지사항",
  notifications: "알림 센터",
  tools_hanatour: "하나투어 익스텐션",
  tools_modetour: "모두투어 익스텐션",
};

const HOME_PRODUCT_VIEWS = new Set<string>([
  ADMIN_PRODUCTS_VIEW.FEATURED,
  ADMIN_PRODUCTS_VIEW.HOME_GOLF_TOUR_CARDS,
  ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS,
  ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS,
]);

export function inferMainMenuKey(pathname: string, searchParamsView: string | null): MainMenuKey | null {
  const rel = getAdminConsoleRelativePath(pathname);
  if (rel == null) return null;
  if (rel === "/" || rel === "") return "dashboard";
  if (rel.startsWith("/banners")) return "home";
  if (rel.startsWith("/products")) {
    if (rel.includes("/new-modetour") || rel.includes("/new-hanatour") || rel.includes("/new-band")) return "product";
    if (searchParamsView && HOME_PRODUCT_VIEWS.has(searchParamsView)) return "home";
    return "product";
  }
  if (rel.startsWith("/landings") || rel.startsWith("/golf-leads")) return "landings";
  if (rel.startsWith("/sms") || rel.startsWith("/inbound-sms")) return "sms";
  if (rel.startsWith("/inquiries")) return "inquiry";
  if (rel.startsWith("/bookings")) return "bookings";
  if (rel.startsWith("/members") || rel.startsWith("/points") || rel.startsWith("/rewards")) {
    return "member_rewards";
  }
  if (rel.startsWith("/settings")) return "settings";
  if (isAdminReviewSectionRelativePath(rel)) return "reviews";
  if (rel.startsWith("/guides")) return "guides";
  if (rel.startsWith("/notices")) return "notices";
  if (rel.startsWith("/notifications")) return "notifications";
  if (rel.startsWith("/tools/hanatour")) return "tools_hanatour";
  if (rel.startsWith("/tools/modetour")) return "tools_modetour";
  return null;
}

type NavSearchParams = {
  view: string | null;
  status: string | null;
  tab: string | null;
};

export function resolveActiveSubTab(
  activeMenu: MainMenuKey | null,
  pathname: string,
  searchParams: NavSearchParams,
): string | null {
  if (!activeMenu) return null;
  const items = ADMIN_MENU_MAP[activeMenu];
  let initial: string | null = items[0] ?? null;

  if (activeMenu === "product") {
    const view = searchParams.view;
    if (pathname.includes("/products/new-hanatour")) {
      initial = "상품 등록(하나)";
    } else if (pathname.includes("/products/new-modetour")) {
      initial = "상품 등록(모두)";
    } else if (pathname.includes("/products/new-band")) {
      initial = "상품 등록(밴드)";
    } else if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) {
      initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
    } else if (view === ADMIN_PRODUCTS_VIEW.CREATE) {
      initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
    } else if (view === ADMIN_PRODUCTS_VIEW.LIST) {
      initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
    } else {
      initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
    }
  }
  if (activeMenu === "home") {
    if (pathname.includes("/banners")) {
      initial = "메인배너";
    } else {
      const view = searchParams.view;
      if (view === ADMIN_PRODUCTS_VIEW.FEATURED) initial = "메인 추천상품";
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) initial = "메인 테마카드";
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) initial = "메인 지역카드";
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_GOLF_TOUR_CARDS) initial = "메인 골프투어 상품";
      else initial = "메인 골프투어 상품";
    }
  }
  if (activeMenu === "notices") {
    const view = searchParams.view;
    if (view === "legal") initial = "회원가입 법률 문서";
    else if (view === "create") initial = "공지 등록";
    else if (view === "list") initial = "등록된 공지 목록";
    else initial = "등록된 공지 목록";
  }
  if (activeMenu === "guides") {
    const view = searchParams.view;
    if (view === "notion") initial = "가이드등록(노션)";
    else if (view === "general") initial = "가이드등록(일반)";
    else initial = "가이드 목록";
  }
  if (activeMenu === "member_rewards") {
    if (pathname.includes("/points/requests")) initial = "적립 요청";
    else if (pathname.startsWith("/theall_manager_only/points")) initial = "포인트 지급";
    else if (pathname.startsWith("/theall_manager_only/rewards")) initial = "교환 신청";
    else initial = "회원 목록";
  }
  if (activeMenu === "inquiry") {
    if (pathname.includes("/inquiries/dashboard")) initial = "운영 대시보드";
    else if (searchParams.status === "pending") initial = "미처리 문의";
    else initial = "전체 문의";
  }
  if (activeMenu === "bookings") {
    if (pathname.includes("/bookings/new")) initial = "예약 생성";
    else initial = "예약 목록";
  }
  if (activeMenu === "landings") {
    if (pathname.includes("/golf-leads")) initial = "골프 리드 (UTM)";
    else if (pathname.includes("/landings/analytics")) initial = "성과·UTM";
    else if (pathname.includes("/landings/generate-from-taxonomy")) initial = "taxonomy 기반 생성";
    else initial = "랜딩 목록";
  }
  if (activeMenu === "dashboard") {
    initial = searchParams.tab === "metrics" ? "지표·리드" : "오늘 할 일";
  }
  if (activeMenu === "notifications") {
    if (pathname.includes("/notifications/push")) initial = "OS 푸시 알림";
    else if (pathname.includes("/notifications/devices")) initial = "로그인된 기기";
    else initial = "알림 목록";
  }

  return initial;
}

const LABEL_ADMIN = "관리자";

export function buildAdminBreadcrumbLabels(pathname: string, view: string | null): string[] {
  const base = [LABEL_ADMIN];
  const rel = getAdminConsoleRelativePath(pathname.split("?")[0] ?? pathname);
  if (rel == null) return base;

  const segments = rel.split("/").filter(Boolean);
  if (segments.length === 0) return [...base, "대시보드", "운영 현황"];

  const section = segments[0] ?? "";
  switch (section) {
    case "products": {
      let detail: string | null = null;
      if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
      else if (view === ADMIN_PRODUCTS_VIEW.CREATE || view === null) detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
      else if (view === ADMIN_PRODUCTS_VIEW.LIST) detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      else if (view === ADMIN_PRODUCTS_VIEW.FEATURED) return [...base, "홈·배너 구성", "메인 추천상품"];
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) return [...base, "홈·배너 구성", "메인 지역카드"];
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) return [...base, "홈·배너 구성", "메인 테마카드"];
      else if (view === ADMIN_PRODUCTS_VIEW.HOME_GOLF_TOUR_CARDS) return [...base, "홈·배너 구성", "메인 골프투어 상품"];
      return detail ? [...base, "상품", detail] : [...base, "상품"];
    }
    case "inquiries":
      if (segments[1] === "dashboard") return [...base, "문의·상담", "운영 대시보드"];
      return [...base, "문의·상담"];
    case "bookings":
      if (segments[1] === "new") return [...base, "예약 관리", "예약 생성"];
      if (segments[1]) return [...base, "예약 관리", "예약 상세"];
      return [...base, "예약 관리", "예약 목록"];
    case "sms":
      return [...base, "SMS 센터"];
    case "inbound-sms":
      return [...base, "SMS 센터", "수신 SMS"];
    case "members":
      return [...base, "회원·리워드", "회원 목록"];
    case "rewards":
      return [...base, "회원·리워드", "교환 신청"];
    case "points":
      if (segments[1] === "requests") return [...base, "회원·리워드", "적립 요청"];
      return [...base, "회원·리워드", "포인트 지급"];
    case "landings":
      return [...base, "랜딩·유입"];
    case "golf-leads":
      return [...base, "랜딩·유입", "골프 리드 (UTM)"];
    case "banners":
      return [...base, "홈·배너 구성", "메인배너"];
    case "settings":
      return [...base, "환경설정"];
    case "reviews":
      return [...base, "후기 관리"];
    case "review-reports":
      return [...base, "후기 관리", "신고 목록"];
    case "guides": {
      let guideDetail = "가이드 목록";
      if (view === "notion") guideDetail = "가이드등록(노션)";
      else if (view === "general") guideDetail = "가이드등록(일반)";
      return [...base, "여행가이드", guideDetail];
    }
    case "notices": {
      let noticeDetail = "등록된 공지 목록";
      if (view === "legal") noticeDetail = "회원가입 법률 문서 관리";
      else if (view === "create") noticeDetail = "공지 등록";
      return [...base, "공지사항", noticeDetail];
    }
    case "notifications":
      if (rel.includes("/notifications/push")) return [...base, "알림", "OS 푸시 알림"];
      if (rel.includes("/notifications/devices")) return [...base, "알림", "로그인된 기기"];
      return [...base, "알림"];
    case "tools":
      if (rel.includes("/tools/hanatour")) return [...base, "도구", "하나투어 익스텐션"];
      if (rel.includes("/tools/modetour")) return [...base, "도구", "모두투어 익스텐션"];
      return [...base, "도구"];
    default:
      return [...base, "대시보드"];
  }
}

export { ADMIN_PRODUCTS_QUERY_KEYS };
