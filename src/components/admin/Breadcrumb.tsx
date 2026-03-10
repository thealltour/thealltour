"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  PRODUCT_VIEW_TO_LABEL,
} from "@/components/admin/products/adminProducts.constants";

const LABEL_ADMIN = "\uAD00\uB9AC\uC790"; // 관리자
const LABEL_DASHBOARD = "\uB300\uC2DC\uBCF4\uB4DC"; // 대시보드
const LABEL_DASHBOARD_OVERVIEW = "\uC6B4\uC601 \uD604\uD669"; // 운영 현황
const LABEL_PRODUCTS = "\uC0C1\uD488 \uAD00\uB9AC"; // 상품 관리
const LABEL_INQUIRIES = "\uBB38\uC758 \uAD00\uB9AC"; // 문의 관리
const LABEL_MEMBERS = "\uD68C\uC6D0 \uAD00\uB9AC"; // 회원 관리
const LABEL_SETTINGS = "\uD658\uACBD\uC124\uC815"; // 환경설정
const LABEL_REVIEWS = "\uD6C4\uAE30 \uAD00\uB9AC"; // 후기 관리
const LABEL_GUIDES = "\uC5EC\uD589\uAC00\uC774\uB4DC"; // 여행가이드
const LABEL_GUIDES_LIST = "\uAC00\uC774\uB4DC \uBAA9\uB85D"; // 가이드 목록
const LABEL_GUIDES_NOTION = "\uAC00\uC774\uB4DC\uB4F1\uB85D(\uB178\uC158)"; // 가이드등록(노션)
const LABEL_GUIDES_GENERAL = "\uAC00\uC774\uB4DC\uB4F1\uB85D(\uC77C\uBC18)"; // 가이드등록(일반)
const LABEL_BANNERS = "\uBA54\uC778\uBC30\uB108"; // 메인배너
const LABEL_NOTICES = "\uACF5\uC9C0\uC0AC\uD56D"; // 공지사항
const LABEL_NOTICES_LEGAL = "\uD68C\uC6D0\uAC00\uC785 \uBC95\uB959 \uBB38\uC11C \uAD00\uB9AC"; // 회원가입 법률 문서 관리
const LABEL_NOTICES_CREATE = "\uACF5\uC9C0 \uB4F1\uB85D"; // 공지 등록
const LABEL_NOTICES_LIST = "\uB4F1\uB85D\uB41C \uACF5\uC9C0 \uBAA9\uB85D"; // 등록된 공지 목록
const LABEL_NOTIFICATIONS = "\uC54C\uB9BC"; // 알림
const LABEL_REWARDS = "\uB9AC\uC6CC\uB4DC \uAD50\uD658 \uAD00\uB9AC"; // 리워드 교환 관리
const LABEL_POINTS = "\uD3EC\uC778\uD2B8 \uC9C1\uAE09 \uAD00\uB9AC"; // 포인트 지급 관리

function buildBreadcrumbLabels(pathname: string, view: string | null): string[] {
  const base = [LABEL_ADMIN];

  const cleanPath = pathname.split("?")[0];
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return base;
  }

  if (segments[0] !== "theall_manager_only") {
    return base;
  }

  const section = segments[1] ?? "";

  if (!section) {
    return [...base, LABEL_DASHBOARD, LABEL_DASHBOARD_OVERVIEW];
  }

  switch (section) {
    case "products": {
      let detail: string | null = null;
      if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
      } else if (view === ADMIN_PRODUCTS_VIEW.CREATE || view === null) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
      } else if (view === ADMIN_PRODUCTS_VIEW.LIST) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      } else if (view === ADMIN_PRODUCTS_VIEW.FEATURED) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.FEATURED];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) {
        detail = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS];
      }
      return detail ? [...base, LABEL_PRODUCTS, detail] : [...base, LABEL_PRODUCTS];
    }
    case "inquiries":
      return [...base, LABEL_INQUIRIES];
    case "members":
      return [...base, LABEL_MEMBERS];
    case "rewards":
      return [...base, LABEL_REWARDS];
    case "points":
      return [...base, LABEL_POINTS];
    case "settings":
      return [...base, LABEL_SETTINGS];
    case "reviews":
      return [...base, LABEL_REVIEWS];
    case "review-reports":
      return [...base, LABEL_REVIEWS, "신고 목록"];
    case "guides": {
      let guideDetail: string;
      if (view === "notion") guideDetail = LABEL_GUIDES_NOTION;
      else if (view === "general") guideDetail = LABEL_GUIDES_GENERAL;
      else guideDetail = LABEL_GUIDES_LIST;
      return [...base, LABEL_GUIDES, guideDetail];
    }
    case "banners":
      return [...base, LABEL_BANNERS];
    case "notices": {
      let noticeDetail: string;
      if (view === "legal") noticeDetail = LABEL_NOTICES_LEGAL;
      else if (view === "create") noticeDetail = LABEL_NOTICES_CREATE;
      else noticeDetail = LABEL_NOTICES_LIST;
      return [...base, LABEL_NOTICES, noticeDetail];
    }
    case "notifications":
      return [...base, LABEL_NOTIFICATIONS];
    default:
      return [...base, LABEL_DASHBOARD];
  }
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const labels = buildBreadcrumbLabels(pathname, view);

  if (labels.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
      {labels.map((label, index) => {
        const isLast = index === labels.length - 1;
        return (
          <span key={`${label}-${index}`} className={isLast ? "font-semibold" : undefined}>
            {index > 0 && <span className="px-1 text-gray-400">/</span>}
            {label}
          </span>
        );
      })}
    </nav>
  );
}

