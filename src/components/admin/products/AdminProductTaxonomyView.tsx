"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { UpdateAdminTaxonomyPayload } from "@/components/admin/products/api/adminProductTaxonomy.client";
import { cn } from "@/lib/cn";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminBadge from "@/components/admin/ui/AdminBadge";

// --- 운영 인사이트: 검색/필터/정렬 (클라이언트 only, 원본 배열 비변경) ---
const LANDING_CTR_LOW_THRESHOLD = 0.1;

type ActiveFilter = "all" | "active" | "inactive";
type PerformanceFilter =
  | "all"
  | "has-header-click"
  | "has-search-inbound"
  | "low-landing-ctr"
  | "no-performance"
  | "priority-review";
type SortKey =
  | "default"
  | "header-click-desc"
  | "search-inbound-desc"
  | "landing-ctr-desc"
  | "usage-desc"
  | "name-asc";

function applyTaxonomySearch(
  items: ProductTaxonomyWithUsage[],
  searchTerm: string,
): ProductTaxonomyWithUsage[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const name = (item.name ?? "").toLowerCase();
    const slug = (item.slug ?? "").toLowerCase();
    return name.includes(q) || slug.includes(q);
  });
}

function applyTaxonomyFilters(
  items: ProductTaxonomyWithUsage[],
  activeFilter: ActiveFilter,
  performanceFilter: PerformanceFilter,
): ProductTaxonomyWithUsage[] {
  let out = items;
  if (activeFilter === "active") out = out.filter((item) => item.is_active === true);
  else if (activeFilter === "inactive") out = out.filter((item) => item.is_active !== true);

  if (performanceFilter === "all") return out;
  if (performanceFilter === "has-header-click") {
    return out.filter((item) => (item.headerClickCount ?? 0) > 0);
  }
  if (performanceFilter === "has-search-inbound") {
    return out.filter((item) => (item.searchInboundCount ?? 0) > 0);
  }
  if (performanceFilter === "low-landing-ctr") {
    return out.filter(
      (item) =>
        item.landingCtr != null &&
        typeof item.landingCtr === "number" &&
        Number.isFinite(item.landingCtr) &&
        item.landingCtr < LANDING_CTR_LOW_THRESHOLD,
    );
  }
  if (performanceFilter === "no-performance") {
    return out.filter((item) => {
      const h = item.headerClickCount ?? 0;
      const s = item.searchInboundCount ?? 0;
      const v = item.landingViewCount ?? 0;
      return h === 0 && s === 0 && v === 0;
    });
  }
  if (performanceFilter === "priority-review") {
    return out.filter((item) => getTaxonomyPriorityTag(item) !== null);
  }
  return out;
}

function sortTaxonomyItems(
  items: ProductTaxonomyWithUsage[],
  sortKey: SortKey,
): ProductTaxonomyWithUsage[] {
  const arr = [...items];
  if (sortKey === "default") return arr;
  if (sortKey === "name-asc") {
    arr.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "ko"));
    return arr;
  }
  if (sortKey === "header-click-desc") {
    arr.sort((a, b) => {
      const va = a.headerClickCount ?? 0;
      const vb = b.headerClickCount ?? 0;
      if (vb !== va) return vb - va;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
    return arr;
  }
  if (sortKey === "search-inbound-desc") {
    arr.sort((a, b) => {
      const va = a.searchInboundCount ?? 0;
      const vb = b.searchInboundCount ?? 0;
      if (vb !== va) return vb - va;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
    return arr;
  }
  if (sortKey === "landing-ctr-desc") {
    arr.sort((a, b) => {
      const va = a.landingCtr != null && Number.isFinite(a.landingCtr) ? a.landingCtr : -1;
      const vb = b.landingCtr != null && Number.isFinite(b.landingCtr) ? b.landingCtr : -1;
      if (vb !== va) return vb - va;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
    return arr;
  }
  if (sortKey === "usage-desc") {
    arr.sort((a, b) => {
      const va = a.usageCount ?? 0;
      const vb = b.usageCount ?? 0;
      if (vb !== va) return vb - va;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
    return arr;
  }
  return arr;
}

function getVisibleTaxonomies(
  items: ProductTaxonomyWithUsage[],
  controls: {
    searchTerm: string;
    activeFilter: ActiveFilter;
    performanceFilter: PerformanceFilter;
    sortKey: SortKey;
  },
): ProductTaxonomyWithUsage[] {
  const afterSearch = applyTaxonomySearch(items, controls.searchTerm);
  const afterFilters = applyTaxonomyFilters(
    afterSearch,
    controls.activeFilter,
    controls.performanceFilter,
  );
  return sortTaxonomyItems(afterFilters, controls.sortKey);
}

// --- taxonomy row 빠른 액션: 랜딩/상품 보기 href (읽기 전용, fallback 안전) ---
function normalizeSlugForPath(slug: string | null | undefined): string {
  const s = (slug ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return s;
}

/** region(category) / theme 구분해 랜딩 또는 필터 fallback URL 반환. slug 없으면 querystring 사용. */
function buildLandingHref(item: ProductTaxonomyWithUsage): string {
  const name = (item.name ?? "").trim() || "all";
  const normalizedSlug = normalizeSlugForPath(item.slug);
  if (item.type === "theme") {
    if (normalizedSlug) return `/products/theme/${encodeURIComponent(normalizedSlug)}`;
    return `/products?theme=${encodeURIComponent(name)}`;
  }
  if (normalizedSlug) return `/products/region/${encodeURIComponent(normalizedSlug)}`;
  return `/products?region=${encodeURIComponent(name)}`;
}

/** 해당 taxonomy로 필터된 상품 목록 URL. */
function buildFilteredProductsHref(item: ProductTaxonomyWithUsage): string {
  const name = (item.name ?? "").trim() || "all";
  if (item.type === "theme") return `/products?theme=${encodeURIComponent(name)}`;
  return `/products?region=${encodeURIComponent(name)}`;
}

// --- 운영 인사이트 요약: 현재 표시 목록 기준 집계 ---
function hasAnyPerformance(item: ProductTaxonomyWithUsage): boolean {
  return (
    (item.headerClickCount ?? 0) > 0 ||
    (item.searchInboundCount ?? 0) > 0 ||
    (item.landingViewCount ?? 0) > 0
  );
}

type TaxonomySummary = {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  totalHeaderClicks7d: number;
  totalSearchInbound7d: number;
  itemsWithPerformanceCount: number;
};

function computeTaxonomySummary(items: ProductTaxonomyWithUsage[]): TaxonomySummary {
  let activeCount = 0;
  let inactiveCount = 0;
  let totalHeaderClicks7d = 0;
  let totalSearchInbound7d = 0;
  let itemsWithPerformanceCount = 0;
  for (const item of items) {
    if (item.is_active) activeCount += 1;
    else inactiveCount += 1;
    totalHeaderClicks7d += item.headerClickCount ?? 0;
    totalSearchInbound7d += item.searchInboundCount ?? 0;
    if (hasAnyPerformance(item)) itemsWithPerformanceCount += 1;
  }
  return {
    totalCount: items.length,
    activeCount,
    inactiveCount,
    totalHeaderClicks7d,
    totalSearchInbound7d,
    itemsWithPerformanceCount,
  };
}

/** row 확장 상세용: 운영 점검 포인트 메시지 (최대 3개, 규칙 기반). */
function getTaxonomyInsightMessages(item: ProductTaxonomyWithUsage): string[] {
  const messages: string[] = [];
  const headerClick = item.headerClickCount ?? 0;
  const searchInbound = item.searchInboundCount ?? 0;
  const landingView = item.landingViewCount ?? 0;
  const landingCtr = item.landingCtr;
  const usageCount = item.usageCount ?? 0;
  const hasLandingCtr = landingCtr != null && typeof landingCtr === "number" && Number.isFinite(landingCtr);

  if (item.is_active && headerClick === 0 && searchInbound === 0 && landingView === 0) {
    messages.push("헤더 반응이 아직 없습니다. 노출 위치/명칭을 점검해보세요.");
  }
  if (searchInbound > 0 && (!hasLandingCtr || landingCtr < 0.1)) {
    messages.push("검색 유입 대비 랜딩 전환이 낮습니다. 랜딩 구성과 추천 상품 구성을 점검해보세요.");
  }
  if (landingView > 0 && hasLandingCtr && landingCtr >= 0.1) {
    messages.push("랜딩 반응이 확인됩니다. 노출 확대 후보로 검토할 수 있습니다.");
  }
  if (usageCount === 0) {
    messages.push("현재 연결 상품이 없거나 매우 적을 수 있습니다. 상품 연결 상태를 확인해보세요.");
  }
  if (messages.length === 0) {
    messages.push("현재 수집된 지표를 계속 관찰해보세요.");
  }
  return messages.slice(0, 3);
}

/** 우선 검토 후보 분류 (1개만, 우선순위 순). 비활성은 무성과/노출 개선 제외. landingCtr null이면 전환 점검 미적용. */
type PriorityTag = { variant: "danger" | "warning" | "success"; label: string };

function getTaxonomyPriorityTag(item: ProductTaxonomyWithUsage): PriorityTag | null {
  const active = item.is_active === true;
  const header = item.headerClickCount ?? 0;
  const search = item.searchInboundCount ?? 0;
  const landingView = item.landingViewCount ?? 0;
  const usageCount = item.usageCount ?? 0;
  const ctr = item.landingCtr;
  const hasCtr = ctr != null && typeof ctr === "number" && Number.isFinite(ctr);

  if (active && header === 0 && search === 0 && landingView === 0) {
    return { variant: "danger", label: "무성과" };
  }
  if (search > 0 && hasCtr && ctr < 0.1) {
    return { variant: "warning", label: "전환 점검" };
  }
  if (active && usageCount > 0 && header === 0) {
    return { variant: "warning", label: "노출 개선" };
  }
  if (landingView > 0 && hasCtr && ctr >= 0.1) {
    return { variant: "success", label: "확대 검토" };
  }
  if (header > 0 && search > 0) {
    return { variant: "success", label: "확대 검토" };
  }
  return null;
}

export type AdminProductTaxonomyViewProps = {
  categoryTaxonomies: ProductTaxonomyWithUsage[];
  themeTaxonomies: ProductTaxonomyWithUsage[];
  hasFallbackItems: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  newCategoryInput: string;
  newCategorySlug: string;
  newCategorySortOrder: string | number;
  newThemeInput: string;
  newThemeSlug: string;
  newThemeSortOrder: string | number;
  pendingCreateType: "category" | "theme" | null;
  pendingDeleteId: string | null;
  pendingUpdateId: string | null;
  onCategoryInputChange: (value: string) => void;
  onCategorySlugChange: (value: string) => void;
  onCategorySortOrderChange: (value: string | number) => void;
  onThemeInputChange: (value: string) => void;
  onThemeSlugChange: (value: string) => void;
  onThemeSortOrderChange: (value: string | number) => void;
  onCreateCategory: () => void;
  onCreateTheme: () => void;
  onDeleteTaxonomy: (item: ProductTaxonomyWithUsage) => void;
  onUpdateTaxonomy: (item: ProductTaxonomyWithUsage, payload: UpdateAdminTaxonomyPayload) => void;
};

type TabId = "region" | "theme";

export default function AdminProductTaxonomyView({
  categoryTaxonomies,
  themeTaxonomies,
  hasFallbackItems,
  errorMessage,
  isLoading,
  newCategoryInput,
  newCategorySlug,
  newCategorySortOrder,
  newThemeInput,
  newThemeSlug,
  newThemeSortOrder,
  pendingCreateType,
  pendingDeleteId,
  pendingUpdateId,
  onCategoryInputChange,
  onCategorySlugChange,
  onCategorySortOrderChange,
  onThemeInputChange,
  onThemeSlugChange,
  onThemeSortOrderChange,
  onCreateCategory,
  onCreateTheme,
  onDeleteTaxonomy,
  onUpdateTaxonomy,
}: AdminProductTaxonomyViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("region");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setExpandedItemKey(null);
  }, [activeTab]);

  const regionItems = categoryTaxonomies;
  const themeItems = themeTaxonomies;

  const visibleRegionItems = useMemo(
    () => getVisibleTaxonomies(regionItems, { searchTerm, activeFilter, performanceFilter, sortKey }),
    [regionItems, searchTerm, activeFilter, performanceFilter, sortKey],
  );
  const visibleThemeItems = useMemo(
    () => getVisibleTaxonomies(themeItems, { searchTerm, activeFilter, performanceFilter, sortKey }),
    [themeItems, searchTerm, activeFilter, performanceFilter, sortKey],
  );
  const currentTotal = activeTab === "region" ? regionItems.length : themeItems.length;
  const currentVisible =
    activeTab === "region" ? visibleRegionItems.length : visibleThemeItems.length;

  const visibleItemsForTab =
    activeTab === "region" ? visibleRegionItems : visibleThemeItems;
  const taxonomySummary = useMemo(
    () => computeTaxonomySummary(visibleItemsForTab),
    [visibleItemsForTab],
  );
  const priorityReviewCount = useMemo(
    () => visibleItemsForTab.filter((item) => getTaxonomyPriorityTag(item) !== null).length,
    [visibleItemsForTab],
  );
  const insightTitle =
    activeTab === "region" ? "지역 운영 인사이트" : "테마 운영 인사이트";

  function startEdit(item: ProductTaxonomyWithUsage) {
    setExpandedItemKey(null);
    setEditingId(item.id);
    setEditSlug(item.slug ?? "");
    setEditSortOrder(item.sort_order !== null ? String(item.sort_order) : "");
    setEditIsActive(item.is_active);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function submitEdit(item: ProductTaxonomyWithUsage) {
    const payload: UpdateAdminTaxonomyPayload = {};
    if (editSlug !== (item.slug ?? "")) payload.slug = editSlug.trim() || null;
    const so = editSortOrder === "" ? null : Number(editSortOrder);
    if (so !== item.sort_order) payload.sort_order = so;
    if (editIsActive !== item.is_active) payload.is_active = editIsActive;
    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }
    onUpdateTaxonomy(item, payload);
    setEditingId(null);
  }

  const inputBase =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-soft)]";
  const btnSmall =
    "rounded border px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

  function formatLandingCtr(value: number | null | undefined): string {
    if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
    return `${(value * 100).toFixed(1)}%`;
  }

  return (
    <section className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="text-lg font-bold text-[var(--primary)]">지역 / 테마 관리</h3>
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}
      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">분류 목록을 불러오는 중입니다...</p>
      ) : (
        <>
          {hasFallbackItems ? (
            <p className="text-xs text-amber-700">
              분류 전용 테이블이 없어 임시 목록으로 표시 중입니다. SQL 적용 후 추가/삭제가 완전 활성화됩니다.
            </p>
          ) : null}

          <div className="flex gap-2 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveTab("region")}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition",
                activeTab === "region"
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              지역 관리
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("theme")}
              className={cn(
                "px-3 py-2 text-sm font-semibold transition",
                activeTab === "theme"
                  ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
              )}
            >
              테마 관리
            </button>
          </div>

          {/* 운영 인사이트 요약: 현재 표시 목록 기준 */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{insightTitle}</h4>
              <p className="text-xs text-[var(--text-muted)]">현재 필터 적용 결과 기준</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <AdminCard variant="muted" className="p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">표시 항목 수</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {taxonomySummary.totalCount.toLocaleString()}
                </p>
              </AdminCard>
              <AdminCard variant="muted" className="p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">활성 항목</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {taxonomySummary.activeCount.toLocaleString()}
                </p>
                {taxonomySummary.inactiveCount > 0 ? (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    비활성 {taxonomySummary.inactiveCount.toLocaleString()}
                  </p>
                ) : null}
              </AdminCard>
              <AdminCard variant="muted" className="p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">헤더 클릭(7일)</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {taxonomySummary.totalHeaderClicks7d.toLocaleString()}
                </p>
              </AdminCard>
              <AdminCard variant="muted" className="p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">검색 유입(7일)</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {taxonomySummary.totalSearchInbound7d.toLocaleString()}
                </p>
              </AdminCard>
              <AdminCard variant="muted" className="p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">우선 검토 후보</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {priorityReviewCount.toLocaleString()}
                </p>
              </AdminCard>
            </div>
          </div>

          {/* 운영 인사이트: 검색/필터/정렬 */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="이름/slug 검색"
              className={cn(inputBase, "min-w-[120px] max-w-[180px]")}
              aria-label="이름 또는 slug 검색"
            />
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className={cn(inputBase, "min-w-[100px]")}
              aria-label="활성 상태 필터"
            >
              <option value="all">전체</option>
              <option value="active">활성만</option>
              <option value="inactive">비활성만</option>
            </select>
            <select
              value={performanceFilter}
              onChange={(e) => setPerformanceFilter(e.target.value as PerformanceFilter)}
              className={cn(inputBase, "min-w-[140px]")}
              aria-label="성과 필터"
            >
              <option value="all">전체</option>
              <option value="has-header-click">헤더 클릭 있음</option>
              <option value="has-search-inbound">검색 유입 있음</option>
              <option value="low-landing-ctr">랜딩 CTR 낮음</option>
              <option value="no-performance">무성과 항목</option>
              <option value="priority-review">우선 검토 후보만</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className={cn(inputBase, "min-w-[140px]")}
              aria-label="정렬"
            >
              <option value="default">기본순</option>
              <option value="header-click-desc">헤더 클릭 높은 순</option>
              <option value="search-inbound-desc">검색 유입 높은 순</option>
              <option value="landing-ctr-desc">랜딩 CTR 높은 순</option>
              <option value="usage-desc">사용 수 높은 순</option>
              <option value="name-asc">이름순</option>
            </select>
            <span className="text-xs text-[var(--text-muted)]">
              총 {currentTotal}개 중 {currentVisible}개 표시
            </span>
          </div>

          {activeTab === "region" ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">이름</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">slug</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">정렬</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">활성</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">사용</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">헤더 클릭(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">검색 유입(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 조회(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 CTR</th>
                      <th className="pb-2 font-semibold text-[var(--text-primary)]">동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRegionItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          조건에 맞는 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleRegionItems.map((item) => {
                        const priorityTag = getTaxonomyPriorityTag(item);
                        return (
                      <Fragment key={item.id}>
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2 pr-2 font-medium text-[var(--foreground)]">
                          <div className="flex flex-col gap-0.5">
                            <span>{item.name}</span>
                            {priorityTag ? (
                              <AdminBadge variant={priorityTag.variant} className="w-fit">
                                {priorityTag.label}
                              </AdminBadge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <input
                              value={editSlug}
                              onChange={(e) => setEditSlug(e.target.value)}
                              placeholder="미설정"
                              className={cn(inputBase, "w-24")}
                            />
                          ) : (
                            <span className="text-[var(--text-muted)]">{item.slug ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <input
                              type="number"
                              value={editSortOrder}
                              onChange={(e) => setEditSortOrder(e.target.value)}
                              placeholder="—"
                              className={cn(inputBase, "w-16")}
                            />
                          ) : (
                            <span className="text-[var(--text-muted)]">{item.sort_order ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                              />
                              <span className="text-xs">{editIsActive ? "활성" : "비활성"}</span>
                            </label>
                          ) : (
                            <span className={item.is_active ? "text-green-600" : "text-[var(--text-muted)]"}>
                              {item.is_active ? "활성" : "비활성"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)]">{item.usageCount}</td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.headerClickCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.searchInboundCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.landingViewCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {formatLandingCtr(item.landingCtr)}
                        </td>
                        <td className="py-2">
                          {editingId === item.id ? (
                            <span className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => submitEdit(item)}
                                disabled={pendingUpdateId === item.id}
                                className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]")}
                              >
                                저장
                              </button>
                              <button type="button" onClick={cancelEdit} className={cn(btnSmall, "border-[var(--border)]")}>
                                취소
                              </button>
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  disabled={item.id.startsWith("fallback-")}
                                  className={cn(btnSmall, "border-[var(--border)]")}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  disabled={pendingDeleteId === item.id || item.id.startsWith("fallback-")}
                                  onClick={() => onDeleteTaxonomy(item)}
                                  className={cn(btnSmall, "border-[var(--danger)]/50 text-[var(--danger)]")}
                                >
                                  삭제
                                </button>
                              </span>
                              <span className="flex flex-wrap gap-2 text-xs">
                                <a
                                  href={buildLandingHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  랜딩 보기
                                </a>
                                <a
                                  href={buildFilteredProductsHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  상품 보기
                                </a>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedItemKey(expandedItemKey === item.id ? null : item.id)
                                  }
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  {expandedItemKey === item.id ? "인사이트 닫기" : "인사이트 보기"}
                                </button>
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedItemKey === item.id ? (
                        <tr>
                          <td colSpan={10} className="bg-[var(--surface-muted)] p-0 align-top">
                            <div className="border-t border-[var(--border)] p-4">
                              {priorityTag ? (
                                <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">
                                  현재 상태: {priorityTag.label} 후보
                                </p>
                              ) : null}
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <AdminCard variant="muted" className="p-4">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">기본 상태</p>
                                  <dl className="mt-2 space-y-1 text-sm">
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">이름 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.name ?? "—"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">slug </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.slug?.trim() ? item.slug : "없음"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">활성 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.is_active ? "활성" : "비활성"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">사용 수 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{(item.usageCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">타입 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.type === "theme" ? "테마" : "지역"}</dd>
                                    </div>
                                  </dl>
                                </AdminCard>
                                <AdminCard variant="muted" className="p-4">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">최근 성과(7일)</p>
                                  <dl className="mt-2 space-y-1 text-sm">
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">헤더 클릭</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.headerClickCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">검색 유입</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.searchInboundCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">랜딩 조회</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.landingViewCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">랜딩 CTR</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{formatLandingCtr(item.landingCtr)}</dd>
                                    </div>
                                  </dl>
                                </AdminCard>
                                <AdminCard variant="muted" className="p-4 sm:col-span-2 lg:col-span-1">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">운영 점검 포인트</p>
                                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-secondary)]">
                                    {getTaxonomyInsightMessages(item).map((msg, i) => (
                                      <li key={i}>{msg}</li>
                                    ))}
                                  </ul>
                                </AdminCard>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <input
                  value={newCategoryInput}
                  onChange={(e) => onCategoryInputChange(e.target.value)}
                  placeholder="이름 (필수)"
                  className={cn(inputBase, "min-w-[100px]")}
                />
                <input
                  value={newCategorySlug}
                  onChange={(e) => onCategorySlugChange(e.target.value)}
                  placeholder="slug (선택)"
                  className={cn(inputBase, "w-24")}
                />
                <input
                  type="number"
                  value={newCategorySortOrder}
                  onChange={(e) => onCategorySortOrderChange(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="정렬"
                  className={cn(inputBase, "w-16")}
                />
                <button
                  type="button"
                  onClick={onCreateCategory}
                  disabled={pendingCreateType === "category" || !newCategoryInput.trim()}
                  className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] disabled:opacity-50")}
                >
                  {pendingCreateType === "category" ? "추가 중..." : "지역 추가"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">이름</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">slug</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">정렬</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">활성</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">사용</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">헤더 클릭(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">검색 유입(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 조회(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 CTR</th>
                      <th className="pb-2 font-semibold text-[var(--text-primary)]">동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleThemeItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          조건에 맞는 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleThemeItems.map((item) => {
                        const priorityTag = getTaxonomyPriorityTag(item);
                        return (
                      <Fragment key={item.id}>
                      <tr className="border-b border-[var(--border)]">
                        <td className="py-2 pr-2 font-medium text-[var(--foreground)]">
                          <div className="flex flex-col gap-0.5">
                            <span>{item.name}</span>
                            {priorityTag ? (
                              <AdminBadge variant={priorityTag.variant} className="w-fit">
                                {priorityTag.label}
                              </AdminBadge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <input
                              value={editSlug}
                              onChange={(e) => setEditSlug(e.target.value)}
                              placeholder="미설정"
                              className={cn(inputBase, "w-24")}
                            />
                          ) : (
                            <span className="text-[var(--text-muted)]">{item.slug ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <input
                              type="number"
                              value={editSortOrder}
                              onChange={(e) => setEditSortOrder(e.target.value)}
                              placeholder="—"
                              className={cn(inputBase, "w-16")}
                            />
                          ) : (
                            <span className="text-[var(--text-muted)]">{item.sort_order ?? "—"}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {editingId === item.id ? (
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={editIsActive}
                                onChange={(e) => setEditIsActive(e.target.checked)}
                              />
                              <span className="text-xs">{editIsActive ? "활성" : "비활성"}</span>
                            </label>
                          ) : (
                            <span className={item.is_active ? "text-green-600" : "text-[var(--text-muted)]"}>
                              {item.is_active ? "활성" : "비활성"}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)]">{item.usageCount}</td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.headerClickCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.searchInboundCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {Number(item.landingViewCount ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2 text-[var(--text-muted)] text-right">
                          {formatLandingCtr(item.landingCtr)}
                        </td>
                        <td className="py-2">
                          {editingId === item.id ? (
                            <span className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => submitEdit(item)}
                                disabled={pendingUpdateId === item.id}
                                className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]")}
                              >
                                저장
                              </button>
                              <button type="button" onClick={cancelEdit} className={cn(btnSmall, "border-[var(--border)]")}>
                                취소
                              </button>
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  disabled={item.id.startsWith("fallback-")}
                                  className={cn(btnSmall, "border-[var(--border)]")}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  disabled={pendingDeleteId === item.id || item.id.startsWith("fallback-")}
                                  onClick={() => onDeleteTaxonomy(item)}
                                  className={cn(btnSmall, "border-[var(--danger)]/50 text-[var(--danger)]")}
                                >
                                  삭제
                                </button>
                              </span>
                              <span className="flex flex-wrap gap-2 text-xs">
                                <a
                                  href={buildLandingHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  랜딩 보기
                                </a>
                                <a
                                  href={buildFilteredProductsHref(item)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  상품 보기
                                </a>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedItemKey(expandedItemKey === item.id ? null : item.id)
                                  }
                                  className="text-[var(--primary)] underline hover:no-underline"
                                >
                                  {expandedItemKey === item.id ? "인사이트 닫기" : "인사이트 보기"}
                                </button>
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                      {expandedItemKey === item.id ? (
                        <tr>
                          <td colSpan={10} className="bg-[var(--surface-muted)] p-0 align-top">
                            <div className="border-t border-[var(--border)] p-4">
                              {priorityTag ? (
                                <p className="mb-3 text-xs font-medium text-[var(--text-muted)]">
                                  현재 상태: {priorityTag.label} 후보
                                </p>
                              ) : null}
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <AdminCard variant="muted" className="p-4">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">기본 상태</p>
                                  <dl className="mt-2 space-y-1 text-sm">
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">이름 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.name ?? "—"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">slug </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.slug?.trim() ? item.slug : "없음"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">활성 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.is_active ? "활성" : "비활성"}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">사용 수 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{(item.usageCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div>
                                      <dt className="inline font-medium text-[var(--text-primary)]">타입 </dt>
                                      <dd className="inline text-[var(--text-secondary)]">{item.type === "theme" ? "테마" : "지역"}</dd>
                                    </div>
                                  </dl>
                                </AdminCard>
                                <AdminCard variant="muted" className="p-4">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">최근 성과(7일)</p>
                                  <dl className="mt-2 space-y-1 text-sm">
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">헤더 클릭</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.headerClickCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">검색 유입</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.searchInboundCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">랜딩 조회</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{(item.landingViewCount ?? 0).toLocaleString()}</dd>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <dt className="text-[var(--text-secondary)]">랜딩 CTR</dt>
                                      <dd className="font-medium text-[var(--text-primary)]">{formatLandingCtr(item.landingCtr)}</dd>
                                    </div>
                                  </dl>
                                </AdminCard>
                                <AdminCard variant="muted" className="p-4 sm:col-span-2 lg:col-span-1">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">운영 점검 포인트</p>
                                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--text-secondary)]">
                                    {getTaxonomyInsightMessages(item).map((msg, i) => (
                                      <li key={i}>{msg}</li>
                                    ))}
                                  </ul>
                                </AdminCard>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <input
                  value={newThemeInput}
                  onChange={(e) => onThemeInputChange(e.target.value)}
                  placeholder="이름 (필수, 예: 가족여행)"
                  className={cn(inputBase, "min-w-[120px]")}
                />
                <input
                  value={newThemeSlug}
                  onChange={(e) => onThemeSlugChange(e.target.value)}
                  placeholder="slug (선택)"
                  className={cn(inputBase, "w-24")}
                />
                <input
                  type="number"
                  value={newThemeSortOrder}
                  onChange={(e) => onThemeSortOrderChange(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="정렬"
                  className={cn(inputBase, "w-16")}
                />
                <button
                  type="button"
                  onClick={onCreateTheme}
                  disabled={pendingCreateType === "theme" || !newThemeInput.trim()}
                  className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] disabled:opacity-50")}
                >
                  {pendingCreateType === "theme" ? "추가 중..." : "테마 추가"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
