import type { HeaderNavGroup, HeaderPrimaryNavItem } from "./headerNav.types";
import {
  HEADER_PRIMARY_NAV_DEFAULT_HREF,
  HEADER_CATALOG_PRIMARY_NAV_KEYS,
  type HeaderCatalogPrimaryNavKey,
} from "./headerNav.constants";
import { getCorporateNavLeafItems } from "@/lib/corporate/content";

const FALLBACK_RECOMMENDED_GROUP: HeaderNavGroup = {
  key: "package-recommended",
  label: "추천여행",
  labelHref: "/recommended",
  items: [
    { key: "recommended-all", label: "전체 여행 보기", href: "/products" },
    { key: "recommended-recommend", label: "추천 여행", href: "/products?collection=recommend" },
    { key: "recommended-popular", label: "인기 여행", href: "/products?collection=popular" },
    { key: "recommended-new", label: "신규 여행", href: "/products?collection=new" },
  ],
};

const FALLBACK_REGION_GROUP: HeaderNavGroup = {
  key: "package-region",
  label: "지역별 여행",
  labelHref: "/destinations",
  items: [
    { key: "region-all", label: "지역 전체 보기", href: "/destinations" },
    { key: "region-products", label: "전체 상품 보기", href: "/products" },
  ],
};

function buildPackageNavItem(primaryNav: HeaderPrimaryNavItem[]): HeaderPrimaryNavItem {
  const recommended = primaryNav.find((item) => item.key === "recommended");
  const region = primaryNav.find((item) => item.key === "region");

  const recommendedGroups =
    recommended?.groups
      ?.filter((group) => group.key !== "golf-recommend")
      .map((group) =>
        group.key === "recommended-collection"
          ? { ...group, label: "추천여행", labelHref: group.labelHref ?? "/recommended" }
          : group,
      ) ?? [];

  const regionGroups = region?.groups ?? [];
  const groups: HeaderNavGroup[] = [
    ...(recommendedGroups.length > 0 ? recommendedGroups : [FALLBACK_RECOMMENDED_GROUP]),
    ...(regionGroups.length > 0 ? regionGroups : [FALLBACK_REGION_GROUP]),
  ];

  return {
    key: "package",
    label: "패키지여행",
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF.package,
    groups,
  };
}

function relabelTheme(item: HeaderPrimaryNavItem | undefined): HeaderPrimaryNavItem {
  return {
    key: "theme",
    label: "테마여행",
    href: item?.href ?? HEADER_PRIMARY_NAV_DEFAULT_HREF.theme,
    groups: item?.groups,
  };
}

function buildCorporateInquiryNavItem(): HeaderPrimaryNavItem {
  return {
    key: "inquiry",
    label: "기업·단체여행",
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF.inquiry,
    groups: [
      {
        key: "corporate-links",
        label: "고객군·견적",
        items: getCorporateNavLeafItems(),
      },
    ],
  };
}

/**
 * 카탈로그형 1차 메뉴: 패키지여행 · 테마여행 · 기업·단체여행 · (플래너).
 * 골프는 Desktop/Mobile에서 별도 주입. 원본 recommended/region은 패키지 하위로 합친다.
 */
export function assembleCatalogPrimaryNav(primaryNav: HeaderPrimaryNavItem[]): HeaderPrimaryNavItem[] {
  const byKey = new Map(primaryNav.map((item) => [item.key, item]));
  const packageItem = buildPackageNavItem(primaryNav);
  const themeItem = relabelTheme(byKey.get("theme"));
  const inquiryItem = buildCorporateInquiryNavItem();
  const plannerItem = byKey.get("planner");

  const result: HeaderPrimaryNavItem[] = [packageItem, themeItem, inquiryItem];
  if (plannerItem) {
    const inquiryIndex = result.findIndex((item) => item.key === "inquiry");
    result.splice(inquiryIndex < 0 ? result.length : inquiryIndex + 1, 0, {
      key: "planner",
      label: "여행플래너",
      href: plannerItem.href ?? HEADER_PRIMARY_NAV_DEFAULT_HREF.planner,
    });
  }

  return result.filter((item) =>
    HEADER_CATALOG_PRIMARY_NAV_KEYS.includes(item.key as HeaderCatalogPrimaryNavKey),
  );
}
