"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import type { ProductTaxonomyWithUsage, TaxonomyType } from "@/types/productTaxonomy";
import type { LandingGenerationCandidate, LandingGenerationResult } from "@/types/adminLanding";
import type { UpdateAdminTaxonomyPayload } from "@/components/admin/products/api/adminProductTaxonomy.client";
import { cn } from "@/lib/cn";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminBadge from "@/components/admin/ui/AdminBadge";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { LANDING_HERO_FALLBACK_IMAGE } from "@/lib/landingMetadata";

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

/** 지역(destination) 또는 테마(theme) 탭용: 대분류(parent_id null) → 중분류 → 세부 순서의 평면 목록 (다단계 지원) */
function buildTaxonomyTreeOrder(
  items: ProductTaxonomyWithUsage[],
): ProductTaxonomyWithUsage[] {
  const roots = items
    .filter((i) => !i.parent_id || i.parent_id.trim() === "")
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const byParent = new Map<string, ProductTaxonomyWithUsage[]>();
  for (const i of items) {
    const pid = i.parent_id?.trim() || null;
    if (!pid) continue;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(i);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  }
  const out: ProductTaxonomyWithUsage[] = [];
  function appendChildren(parentId: string) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      out.push(c);
      appendChildren(c.id);
    }
  }
  for (const root of roots) {
    out.push(root);
    appendChildren(root.id);
  }
  return out;
}

/** 트리 순서의 항목 목록으로 부모 선택용 옵션 생성 (대분류·중분류 모두 선택 가능) */
function buildParentSelectOptions(
  items: ProductTaxonomyWithUsage[],
  excludeId: string | null,
): { id: string; label: string; depth: number }[] {
  const treeOrdered = buildTaxonomyTreeOrder(items);
  return treeOrdered
    .filter((i) => i.id !== excludeId)
    .map((i) => {
      let depth = 0;
      let current: ProductTaxonomyWithUsage | undefined = i;
      while (current?.parent_id?.trim()) {
        depth += 1;
        current = items.find((x) => x.id === current!.parent_id?.trim());
      }
      return {
        id: i.id,
        label: (depth > 0 ? "　".repeat(depth) + "└ " : "") + (i.name ?? ""),
        depth,
      };
    });
}

/** 해당 taxonomy로 필터된 상품 목록 URL. */
function buildFilteredProductsHref(item: ProductTaxonomyWithUsage): string {
  const name = (item.name ?? "").trim() || "all";
  const tt = item.taxonomy_type;
  if (tt === "theme") return `/products?theme=${encodeURIComponent(name)}`;
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
  activeTab: TaxonomyType;
  setActiveTab: (tab: TaxonomyType) => void;
  taxonomyTabTypes: TaxonomyType[];
  taxonomyItems: ProductTaxonomyWithUsage[];
  hasFallbackItems: boolean;
  errorMessage: string | null;
  isLoading: boolean;
  newNameInput: string;
  newSlug: string;
  newSortOrder: string | number;
  newParentId: string | null;
  pendingCreateType: TaxonomyType | null;
  pendingDeleteId: string | null;
  pendingUpdateId: string | null;
  onNameInputChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onSortOrderChange: (value: string | number) => void;
  onParentIdChange: (value: string | null) => void;
  onCreate: () => void;
  onDeleteTaxonomy: (item: ProductTaxonomyWithUsage) => void;
  onUpdateTaxonomy: (item: ProductTaxonomyWithUsage, payload: UpdateAdminTaxonomyPayload) => void | Promise<void>;
};

const TAB_LABELS: Record<TaxonomyType, string> = {
  destination: "지역 관리",
  theme: "테마 관리",
  product_line: "상품군 관리",
  campaign: "기획/추천 관리",
  tag: "태그",
};

const INSIGHT_TITLES: Record<TaxonomyType, string> = {
  destination: "지역 운영 인사이트",
  theme: "테마 운영 인사이트",
  product_line: "상품군 운영 인사이트",
  campaign: "기획/추천 운영 인사이트",
  tag: "태그 운영 인사이트",
};

const ADD_PLACEHOLDERS: Record<TaxonomyType, string> = {
  destination: "이름 (필수, 예: 일본)",
  theme: "이름 (필수, 예: 가족여행)",
  product_line: "이름 (필수, 예: 골프투어)",
  campaign: "이름 (필수, 예: 마감임박)",
  tag: "이름 (필수)",
};

const ADD_BUTTON_LABELS: Record<TaxonomyType, string> = {
  destination: "지역 추가",
  theme: "테마 추가",
  product_line: "상품군 추가",
  campaign: "기획 추가",
  tag: "태그 추가",
};

const TAXONOMY_TYPE_LABELS: Record<TaxonomyType, string> = {
  destination: "지역",
  theme: "테마",
  product_line: "상품군",
  campaign: "기획",
  tag: "태그",
};

type TabId = TaxonomyType;

export default function AdminProductTaxonomyView({
  activeTab,
  setActiveTab,
  taxonomyTabTypes,
  taxonomyItems,
  hasFallbackItems,
  errorMessage,
  isLoading,
  newNameInput,
  newSlug,
  newSortOrder,
  newParentId,
  pendingCreateType,
  pendingDeleteId,
  pendingUpdateId,
  onNameInputChange,
  onSlugChange,
  onSortOrderChange,
  onParentIdChange,
  onCreate,
  onDeleteTaxonomy,
  onUpdateTaxonomy,
}: AdminProductTaxonomyViewProps) {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsHubVisible, setEditIsHubVisible] = useState(true);
  const [editIsLandingEnabled, setEditIsLandingEnabled] = useState(false);
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [editCardImageUrl, setEditCardImageUrl] = useState("");
  const [editCardTitle, setEditCardTitle] = useState("");
  const [editCardDescription, setEditCardDescription] = useState("");
  const [editLandingTitle, setEditLandingTitle] = useState("");
  const [editLandingDescription, setEditLandingDescription] = useState("");
  const [editHeroImageUrl, setEditHeroImageUrl] = useState("");
  /** PR3: campaign 탭 — 상품 카드 대표 배지 CMS */
  const [editDisplayLabel, setEditDisplayLabel] = useState("");
  const [editBadgeVisible, setEditBadgeVisible] = useState(true);
  const [editBadgePriority, setEditBadgePriority] = useState("100");
  const [editBadgeTone, setEditBadgeTone] = useState<"primary" | "highlight" | "neutral">("neutral");
  const [editBadgeDescription, setEditBadgeDescription] = useState("");
  const editCardImageUrlRef = useRef("");
  const editCardTitleRef = useRef("");
  const editCardDescriptionRef = useRef("");
  const editLandingTitleRef = useRef("");
  const editLandingDescriptionRef = useRef("");
  const editHeroImageUrlRef = useRef("");
  useEffect(() => {
    editCardImageUrlRef.current = editCardImageUrl;
    editCardTitleRef.current = editCardTitle;
    editCardDescriptionRef.current = editCardDescription;
    editLandingTitleRef.current = editLandingTitle;
    editLandingDescriptionRef.current = editLandingDescription;
    editHeroImageUrlRef.current = editHeroImageUrl;
  }, [editCardImageUrl, editCardTitle, editCardDescription, editLandingTitle, editLandingDescription, editHeroImageUrl]);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);
  const [candidateMap, setCandidateMap] = useState<Map<string, LandingGenerationCandidate>>(() => new Map());
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [generatingLandingId, setGeneratingLandingId] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setExpandedItemKey(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "destination" && activeTab !== "theme" && activeTab !== "product_line") {
      setCandidateMap(new Map());
      setCandidatesError(null);
      setCandidatesLoading(false);
      return;
    }
    let cancelled = false;
    setCandidatesLoading(true);
    setCandidatesError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/landings/generation-candidates?taxonomyType=${encodeURIComponent(activeTab)}`,
        );
        const data = (await res.json()) as { items?: LandingGenerationCandidate[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "후보를 불러오지 못했습니다.");
        const items = data.items ?? [];
        if (cancelled) return;
        const m = new Map<string, LandingGenerationCandidate>();
        for (const c of items) {
          m.set(`${c.taxonomyType}:${c.taxonomyId}`, c);
        }
        setCandidateMap(m);
      } catch (e) {
        if (!cancelled) {
          setCandidateMap(new Map());
          setCandidatesError(e instanceof Error ? e.message : "후보 로드 오류");
        }
      } finally {
        if (!cancelled) setCandidatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const visibleItems = useMemo(
    () => getVisibleTaxonomies(taxonomyItems, { searchTerm, activeFilter, performanceFilter, sortKey }),
    [taxonomyItems, searchTerm, activeFilter, performanceFilter, sortKey],
  );
  const displayItems = useMemo(() => {
    if (activeTab !== "destination" && activeTab !== "theme") return visibleItems;
    return buildTaxonomyTreeOrder(visibleItems);
  }, [activeTab, visibleItems]);
  /** displayItems 기준 계층 깊이 (0=대분류, 1=중분류, 2=세부…) */
  const itemDepthMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of displayItems) {
      let depth = 0;
      let cur: ProductTaxonomyWithUsage | undefined = item;
      while (cur?.parent_id?.trim()) {
        depth += 1;
        cur = displayItems.find((x) => x.id === cur!.parent_id?.trim());
      }
      map.set(item.id, depth);
    }
    return map;
  }, [displayItems]);
  /** 현재 탭의 최상위 항목(대분류 선택용). destination/theme 탭에서만 의미 있음 */
  const topLevelItems = useMemo(
    () => taxonomyItems.filter((i) => !i.parent_id || i.parent_id.trim() === ""),
    [taxonomyItems],
  );
  /** 부모 선택용 옵션: 트리 순서 + 들여쓰기. 대분류·중분류 모두 선택 가능 (지역 관리에서 해외 하위 중분류 생성용) */
  const parentSelectOptions = useMemo(
    () =>
      (activeTab === "destination" || activeTab === "theme")
        ? buildParentSelectOptions(taxonomyItems, null)
        : [],
    [activeTab, taxonomyItems],
  );
  const taxonomySummary = useMemo(
    () => computeTaxonomySummary(visibleItems),
    [visibleItems],
  );
  const priorityReviewCount = useMemo(
    () => visibleItems.filter((item) => getTaxonomyPriorityTag(item) !== null).length,
    [visibleItems],
  );
  const insightTitle = INSIGHT_TITLES[activeTab];

  const taxonomyTableColSpan =
    activeTab === "destination" || activeTab === "theme"
      ? 13
      : activeTab === "campaign"
        ? 15
        : 12;

  function startEdit(item: ProductTaxonomyWithUsage) {
    setExpandedItemKey(null);
    setEditingId(item.id);
    setEditSlug(item.slug ?? "");
    setEditSortOrder(item.sort_order !== null ? String(item.sort_order) : "");
    setEditIsActive(item.is_active);
    setEditIsHubVisible(item.is_hub_visible ?? true);
    setEditIsLandingEnabled(item.is_landing_enabled ?? false);
    setEditParentId(item.parent_id?.trim() || null);
    setEditCardImageUrl(item.card_image_url?.trim() ?? "");
    setEditCardTitle(item.card_title?.trim() ?? "");
    setEditCardDescription(item.card_description?.trim() ?? "");
    setEditLandingTitle(item.landing_title?.trim() ?? "");
    setEditLandingDescription(item.landing_description?.trim() ?? "");
    setEditHeroImageUrl(item.hero_image_url?.trim() ?? "");
    if (activeTab === "campaign") {
      setEditDisplayLabel(item.display_label?.trim() ?? "");
      setEditBadgeVisible(item.badge_visible !== false);
      setEditBadgePriority(
        item.badge_priority != null && Number.isFinite(item.badge_priority)
          ? String(item.badge_priority)
          : "100",
      );
      const tone = (item.badge_tone ?? "").trim().toLowerCase();
      setEditBadgeTone(
        tone === "primary" || tone === "highlight" || tone === "neutral" ? tone : "neutral",
      );
      setEditBadgeDescription(item.badge_description?.trim() ?? "");
    }
  }

  /** 이름 기반 URL-safe slug 생성 (영문/숫자/하이픈만) */
  function generateSlugFromName(name: string): string {
    const s = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return s || "";
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function submitEdit(item: ProductTaxonomyWithUsage) {
    const payload: UpdateAdminTaxonomyPayload = {};
    if (editSlug !== (item.slug ?? "")) payload.slug = editSlug.trim() || null;
    const so = editSortOrder === "" ? null : Number(editSortOrder);
    if (so !== item.sort_order) payload.sort_order = so;
    if (editIsActive !== item.is_active) payload.is_active = editIsActive;
    if ((item.is_hub_visible ?? true) !== editIsHubVisible) payload.is_hub_visible = editIsHubVisible;
    if ((item.is_landing_enabled ?? false) !== editIsLandingEnabled) payload.is_landing_enabled = editIsLandingEnabled;
    const currentParent = item.parent_id?.trim() || null;
    if ((activeTab === "destination" || activeTab === "theme") && editParentId !== currentParent)
      payload.parent_id = editParentId;
    const cardUrl = editCardImageUrlRef.current.trim() || null;
    const cardTitle = editCardTitleRef.current.trim() || null;
    const cardDesc = editCardDescriptionRef.current.trim() || null;
    if (cardUrl !== (item.card_image_url ?? "")) payload.card_image_url = cardUrl;
    if (cardTitle !== (item.card_title ?? "")) payload.card_title = cardTitle || null;
    if (cardDesc !== (item.card_description ?? "")) payload.card_description = cardDesc || null;
    const landingTitle = editLandingTitle.trim() || null;
    const landingDesc = editLandingDescription.trim() || null;
    const heroUrl = editHeroImageUrl.trim() || null;
    if (activeTab === "destination" || activeTab === "theme") {
      payload.landing_title = landingTitle;
      payload.landing_description = landingDesc;
      payload.hero_image_url = heroUrl;
    }
    if (activeTab === "campaign") {
      const dl = editDisplayLabel.trim();
      const currentDl = (item.display_label ?? "").trim();
      if (dl !== currentDl) payload.display_label = dl || null;

      const vis = editBadgeVisible;
      const curVis = item.badge_visible !== false;
      if (vis !== curVis) payload.badge_visible = vis;

      const bpRaw = editBadgePriority.trim();
      const bp = bpRaw === "" ? null : Number(bpRaw);
      const curBp = item.badge_priority ?? null;
      if (bp !== null && !Number.isFinite(bp)) {
        /* 잘못된 숫자는 payload에 넣지 않음 */
      } else if (bp !== curBp) {
        payload.badge_priority = bp;
      }

      const tone = editBadgeTone;
      const curRaw = (item.badge_tone ?? "").trim().toLowerCase();
      const curTone =
        curRaw === "primary" || curRaw === "highlight" || curRaw === "neutral" ? curRaw : "neutral";
      if (tone !== curTone) payload.badge_tone = tone;

      const bd = editBadgeDescription.trim();
      const curBd = (item.badge_description ?? "").trim();
      if (bd !== curBd) payload.badge_description = bd || null;
    }
    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }
    await onUpdateTaxonomy(item, payload);
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

  async function handleGenerateAdminLanding(item: ProductTaxonomyWithUsage) {
    if (
      item.taxonomy_type !== "destination" &&
      item.taxonomy_type !== "theme" &&
      item.taxonomy_type !== "product_line"
    ) {
      return;
    }
    const key = `${item.taxonomy_type}:${item.id}`;
    const cand = candidateMap.get(key);
    if (!cand || cand.isAlreadyGenerated) return;
    setGeneratingLandingId(item.id);
    try {
      const res = await fetch("/api/admin/landings/generate-from-taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ taxonomyId: item.id, taxonomyType: item.taxonomy_type }],
        }),
      });
      const data = (await res.json()) as LandingGenerationResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "랜딩 생성에 실패했습니다.");
      }
      const created = data.created?.[0];
      const skipped = data.skipped?.[0];
      const landingId = created?.landingId ?? skipped?.landingId;
      if (landingId?.trim()) {
        setCandidateMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(key);
          if (cur) {
            next.set(key, {
              ...cur,
              isAlreadyGenerated: true,
              existingLandingId: landingId.trim(),
              existingLandingSlug:
                created?.landingSlug ?? skipped?.landingSlug ?? cur.existingLandingSlug ?? null,
            });
          }
          return next;
        });
        showToast("success", "랜딩 초안이 생성되었습니다.");
        router.push(`/theall_manager_only/landings/${encodeURIComponent(landingId.trim())}`);
        return;
      }
      if (data.skipped?.[0]?.reason === "SLUG_CONFLICT") {
        throw new Error("이미 동일한 slug가 사용 중입니다.");
      }
      if (data.failed?.[0]?.reason) {
        throw new Error(data.failed[0].reason);
      }
      throw new Error("랜딩 생성 결과를 확인할 수 없습니다.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "랜딩 생성에 실패했습니다.";
      showToast("error", msg);
    } finally {
      setGeneratingLandingId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="text-lg font-bold text-[var(--primary)]">지역 / 테마 / 상품군 / 기획 관리</h3>
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
            {taxonomyTabTypes.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-3 py-2 text-sm font-semibold transition",
                  activeTab === tab
                    ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                )}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
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
              총 {taxonomyItems.length}개 중 {visibleItems.length}개 표시
            </span>
          </div>

          <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">이름</th>
                      {activeTab === "campaign" ? (
                        <>
                          <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            카드 라벨
                          </th>
                          <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            배지
                          </th>
                          <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">
                            순위
                          </th>
                        </>
                      ) : null}
                      {(activeTab === "destination" || activeTab === "theme") ? (
                        <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">상위</th>
                      ) : null}
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">slug</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">정렬</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">활성</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">허브 노출</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 공개</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)]">사용</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">헤더 클릭(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">검색 유입(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 조회(7일)</th>
                      <th className="pb-2 pr-2 font-semibold text-[var(--text-primary)] whitespace-nowrap">랜딩 CTR</th>
                      <th className="pb-2 font-semibold text-[var(--text-primary)]">동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.length === 0 ? (
                      <tr>
                        <td colSpan={taxonomyTableColSpan} className="py-8 text-center text-sm text-[var(--text-muted)]">
                          조건에 맞는 항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      displayItems.map((item) => {
                        const priorityTag = getTaxonomyPriorityTag(item);
                        const genKey = `${item.taxonomy_type}:${item.id}`;
                        const generationCandidate =
                          item.taxonomy_type === "destination" ||
                          item.taxonomy_type === "theme" ||
                          item.taxonomy_type === "product_line"
                            ? candidateMap.get(genKey)
                            : undefined;
                        const adminLandingHref =
                          generationCandidate?.existingLandingId?.trim()
                            ? `/theall_manager_only/landings/${encodeURIComponent(generationCandidate.existingLandingId.trim())}`
                            : null;
                        const canUseGenerationApi = Boolean(generationCandidate);
                        const canCreateAdminLanding = Boolean(
                          generationCandidate && !generationCandidate.isAlreadyGenerated,
                        );
                        const isFallbackRow = item.id.startsWith("fallback-") || !item.id?.trim();
                        return (
                          <Fragment key={item.id}>
                            <tr className="border-b border-[var(--border)]">
                              <td className="py-2 pr-2 font-medium text-[var(--foreground)]">
                                <div
                                  className={cn(
                                    "flex flex-col gap-0.5",
                                    (activeTab === "destination" || activeTab === "theme") &&
                                      (() => {
                                        const d = itemDepthMap.get(item.id) ?? 0;
                                        return d >= 1 && (d === 1 ? "pl-6" : d === 2 ? "pl-10" : "pl-14");
                                      })(),
                                  )}
                                >
                                  {(activeTab === "destination" || activeTab === "theme") && (itemDepthMap.get(item.id) ?? 0) > 0 ? (
                                    <span className="text-[var(--text-muted)]">└ </span>
                                  ) : null}
                                  <span>{item.name}</span>
                                  {priorityTag ? (
                                    <AdminBadge variant={priorityTag.variant} className="w-fit">
                                      {priorityTag.label}
                                    </AdminBadge>
                                  ) : null}
                                </div>
                              </td>
                              {activeTab === "campaign" ? (
                                <>
                                  <td className="py-2 pr-2 text-xs text-[var(--text-muted)]">
                                    {(item.display_label ?? "").trim() || item.name || "—"}
                                  </td>
                                  <td className="py-2 pr-2 text-xs">
                                    {item.badge_visible !== false ? (
                                      <span className="text-green-600">노출</span>
                                    ) : (
                                      <span className="text-[var(--text-muted)]">숨김</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-2 text-xs text-[var(--text-muted)]">
                                    {item.badge_priority != null ? item.badge_priority : "—"}
                                  </td>
                                </>
                              ) : null}
                              {activeTab === "destination" || activeTab === "theme" ? (
                                <td className="py-2 pr-2">
                                  {editingId === item.id ? (
                                    <select
                                      value={editParentId ?? ""}
                                      onChange={(e) => setEditParentId(e.target.value === "" ? null : e.target.value)}
                                      className={cn(inputBase, "min-w-[100px]")}
                                      aria-label="상위"
                                    >
                                      <option value="">— 최상위</option>
                                      {parentSelectOptions
                                        .filter((p) => p.id !== item.id)
                                        .map((p) => (
                                          <option key={p.id} value={p.id}>
                                            {p.label}
                                          </option>
                                        ))}
                                    </select>
                                  ) : (
                                    <span className="text-[var(--text-muted)]">
                                      {item.parent_id
                                        ? taxonomyItems.find((p) => p.id === item.parent_id)?.name ?? "—"
                                        : "—"}
                                    </span>
                                  )}
                                </td>
                              ) : null}
                              <td className="py-2 pr-2">
                                {editingId === item.id ? (
                                  <span className="flex items-center gap-1">
                                    <input
                                      value={editSlug}
                                      onChange={(e) => setEditSlug(e.target.value)}
                                      placeholder="미설정"
                                      className={cn(inputBase, "w-24")}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setEditSlug(generateSlugFromName(item.name ?? ""))}
                                      className="text-xs text-[var(--primary)] underline"
                                    >
                                      자동생성
                                    </button>
                                  </span>
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
                              <td className="py-2 pr-2">
                                {editingId === item.id ? (
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={editIsHubVisible}
                                      onChange={(e) => setEditIsHubVisible(e.target.checked)}
                                    />
                                    <span className="text-xs">{editIsHubVisible ? "노출" : "숨김"}</span>
                                  </label>
                                ) : (
                                  <span className={item.is_hub_visible !== false ? "text-green-600" : "text-[var(--text-muted)]"}>
                                    {item.is_hub_visible !== false ? "노출" : "숨김"}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-2">
                                {editingId === item.id ? (
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={editIsLandingEnabled}
                                      onChange={(e) => setEditIsLandingEnabled(e.target.checked)}
                                    />
                                    <span className="text-xs">{editIsLandingEnabled ? "공개" : "비공개"}</span>
                                  </label>
                                ) : (
                                  <span className={item.is_landing_enabled ? "text-green-600" : "text-[var(--text-muted)]"}>
                                    {item.is_landing_enabled ? "공개" : "비공개"}
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
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          void submitEdit(item);
                                        }}
                                        disabled={pendingUpdateId === item.id}
                                        className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]")}
                                      >
                                        저장
                                      </button>
                                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); cancelEdit(); }} className={cn(btnSmall, "border-[var(--border)]")}>
                                        취소
                                      </button>
                                    </span>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <span className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          startEdit(item);
                                        }}
                                        disabled={item.id.startsWith("fallback-") || !item.id?.trim()}
                                        className={cn(btnSmall, "border-[var(--border)]")}
                                      >
                                        수정
                                      </button>
                                      <button
                                        type="button"
                                        disabled={pendingDeleteId === item.id || item.id.startsWith("fallback-") || !item.id?.trim()}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onDeleteTaxonomy(item);
                                        }}
                                        className={cn(btnSmall, "border-[var(--danger)]/50 text-[var(--danger)]")}
                                      >
                                        삭제
                                      </button>
                                    </span>
                                    <span className="flex flex-wrap items-center gap-2 text-xs">
                                      {item.taxonomy_type === "destination" ||
                                      item.taxonomy_type === "theme" ||
                                      item.taxonomy_type === "product_line" ? (
                                        candidatesLoading ? (
                                          <span className="text-[var(--text-muted)]">랜딩 연결 로드…</span>
                                        ) : candidatesError ? (
                                          <span className="text-[var(--danger)]" title={candidatesError}>
                                            랜딩 연결 오류
                                          </span>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              disabled={
                                                isFallbackRow ||
                                                !canCreateAdminLanding ||
                                                generatingLandingId === item.id
                                              }
                                              title={
                                                isFallbackRow
                                                  ? "이 행에서는 사용할 수 없습니다."
                                                  : !canUseGenerationApi
                                                    ? "생성 후보에 없습니다. 활성 분류이며, 지역·테마는 연결 상품이 있어야 합니다."
                                                    : generationCandidate?.isAlreadyGenerated
                                                      ? "이미 관리자 랜딩이 연결되어 있습니다."
                                                      : "검색/유입 랜딩 초안 생성"
                                              }
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                void handleGenerateAdminLanding(item);
                                              }}
                                              className={cn(
                                                btnSmall,
                                                "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]",
                                                (isFallbackRow ||
                                                  !canCreateAdminLanding ||
                                                  generatingLandingId === item.id) &&
                                                  "cursor-not-allowed opacity-50",
                                              )}
                                            >
                                              {generatingLandingId === item.id ? "생성 중…" : "랜딩 생성"}
                                            </button>
                                            {adminLandingHref ? (
                                              <a
                                                href={adminLandingHref}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[var(--primary)] underline hover:no-underline"
                                              >
                                                랜딩 보기
                                              </a>
                                            ) : (
                                              <span
                                                className="text-[var(--text-muted)]"
                                                title={
                                                  canUseGenerationApi
                                                    ? "관리자 랜딩이 아직 없습니다. 랜딩 생성을 눌러 초안을 만듭니다."
                                                    : "생성 후보에 없거나 연결된 랜딩 정보를 불러오지 못했습니다."
                                                }
                                              >
                                                생성 필요
                                              </span>
                                            )}
                                          </>
                                        )
                                      ) : null}
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
                            {editingId === item.id && activeTab === "campaign" ? (
                              <tr>
                                <td
                                  colSpan={taxonomyTableColSpan}
                                  className="border-b border-[var(--border)] bg-[var(--surface)] p-3 align-top"
                                >
                                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                                    <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">
                                      상품 카드 대표 배지 (PR3)
                                    </p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                                          표시 라벨
                                        </label>
                                        <input
                                          type="text"
                                          value={editDisplayLabel}
                                          onChange={(e) => setEditDisplayLabel(e.target.value)}
                                          placeholder="비우면 관리용 이름과 동일"
                                          className={cn(inputBase, "w-full")}
                                          aria-label="카드 표시 라벨"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                                          배지 우선순위 (낮을수록 먼저)
                                        </label>
                                        <input
                                          type="number"
                                          value={editBadgePriority}
                                          onChange={(e) => setEditBadgePriority(e.target.value)}
                                          placeholder="100"
                                          className={cn(inputBase, "w-full max-w-[120px]")}
                                          aria-label="배지 우선순위"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                                          배지 스타일 (톤)
                                        </label>
                                        <select
                                          value={editBadgeTone}
                                          onChange={(e) =>
                                            setEditBadgeTone(e.target.value as "primary" | "highlight" | "neutral")
                                          }
                                          className={cn(inputBase, "w-full max-w-[200px]")}
                                          aria-label="배지 톤"
                                        >
                                          <option value="primary">primary (강조·추천 계열)</option>
                                          <option value="highlight">highlight (인기 계열)</option>
                                          <option value="neutral">neutral (신규·기타)</option>
                                        </select>
                                      </div>
                                      <div className="flex items-end pb-0.5">
                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            checked={editBadgeVisible}
                                            onChange={(e) => setEditBadgeVisible(e.target.checked)}
                                            aria-label="카드 대표 배지 노출"
                                          />
                                          <span>카드 대표 배지로 노출</span>
                                        </label>
                                      </div>
                                      <div className="sm:col-span-2 lg:col-span-3">
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                                          카드 설명 1줄 (피치)
                                        </label>
                                        <input
                                          type="text"
                                          value={editBadgeDescription}
                                          onChange={(e) => setEditBadgeDescription(e.target.value)}
                                          placeholder="예: MD가 추천하는 일정"
                                          className={cn(inputBase, "w-full max-w-xl")}
                                          aria-label="카드 피치 설명"
                                        />
                                        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                                          비우면 카드에서 기본 문구(라벨 기반)를 사용할 수 있습니다.
                                        </p>
                                      </div>
                                    </div>
                                    <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                                      변경 후 위 행의 <strong>저장</strong>을 눌러 반영합니다.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                            {editingId === item.id && (activeTab === "destination" || activeTab === "theme") ? (
                              <tr>
                                <td
                                  colSpan={taxonomyTableColSpan}
                                  className="border-b border-[var(--border)] bg-[var(--surface)] p-3 align-top"
                                >
                                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                                    <p className="mb-3 text-xs font-semibold text-[var(--text-muted)]">카드 / 랜딩 메타 (허브·상세 페이지용)</p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      <div className="sm:col-span-2 lg:col-span-1">
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">카드 이미지</label>
                                        <ImageUploadField
                                          value={editCardImageUrl}
                                          onChange={(v) => setEditCardImageUrl(v)}
                                          onUploaded={(v) => setEditCardImageUrl(v)}
                                          uploadedUrlKey="card"
                                          optional
                                          placeholder="카드 이미지 URL (비우면 상품 대표 이미지 사용)"
                                          sizeHint="권장: 1200×800px 이상 (3:2)"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">카드 제목 (선택)</label>
                                        <input
                                          type="text"
                                          value={editCardTitle}
                                          onChange={(e) => setEditCardTitle(e.target.value)}
                                          placeholder="비우면 이름 사용"
                                          className={cn(inputBase, "w-full")}
                                          aria-label="카드 제목"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">카드 설명 (선택)</label>
                                        <input
                                          type="text"
                                          value={editCardDescription}
                                          onChange={(e) => setEditCardDescription(e.target.value)}
                                          placeholder="카드 부가 설명"
                                          className={cn(inputBase, "w-full")}
                                          aria-label="카드 설명"
                                        />
                                      </div>
                                    </div>
                                    <p className="mb-2 mt-4 text-xs font-semibold text-[var(--text-muted)]">히어로(랜딩 상단) 설정</p>
                                    <p className="mb-3 text-xs text-[var(--text-secondary)]">지역/테마 상세 랜딩 페이지 상단 히어로 제목·설명·배경 이미지입니다.</p>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">히어로 제목 (랜딩)</label>
                                        <input
                                          type="text"
                                          value={editLandingTitle}
                                          onChange={(e) => setEditLandingTitle(e.target.value)}
                                          placeholder="비우면 이름 사용 (예: 일본 여행 추천)"
                                          className={cn(inputBase, "w-full")}
                                          aria-label="히어로 제목"
                                        />
                                        {!editLandingTitle?.trim() && (
                                          <p className="mt-1 text-xs text-[var(--text-muted)]">비어 있음 → 이름 기반 자동 생성</p>
                                        )}
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">히어로 설명 (랜딩)</label>
                                        <input
                                          type="text"
                                          value={editLandingDescription}
                                          onChange={(e) => setEditLandingDescription(e.target.value)}
                                          placeholder="히어로 부가 설명"
                                          className={cn(inputBase, "w-full")}
                                          aria-label="히어로 설명"
                                        />
                                        {!editLandingDescription?.trim() && (
                                          <p className="mt-1 text-xs text-[var(--text-muted)]">비어 있음 → 카드 설명 또는 기본 문구 사용</p>
                                        )}
                                      </div>
                                      <div className="sm:col-span-2 lg:col-span-1">
                                        <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">히어로 배경 이미지 URL</label>
                                        <ImageUploadField
                                          value={editHeroImageUrl}
                                          onChange={(v) => setEditHeroImageUrl(v)}
                                          onUploaded={(v) => setEditHeroImageUrl(v)}
                                          uploadedUrlKey="hero"
                                          optional
                                          placeholder="비우면 카드 이미지·fallback 사용"
                                          sizeHint="권장: 1600×600px 이상"
                                        />
                                        <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">적용 우선순위</p>
                                        <ol className="mt-1 list-inside list-decimal space-y-0.5 text-xs text-[var(--text-secondary)]">
                                          <li>히어로 배경 이미지</li>
                                          <li>카드 이미지</li>
                                          <li>공통 fallback 이미지</li>
                                        </ol>
                                        {!editHeroImageUrl?.trim() && (
                                          <p className="mt-1.5 text-xs text-[var(--text-muted)]">히어로 이미지 없음 → 카드 이미지 또는 fallback 사용</p>
                                        )}
                                      </div>
                                    </div>
                                    {/* Hero Preview: 랜딩 상단 배너 미리보기 */}
                                    <div className="mt-4">
                                      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Hero Preview</p>
                                      <div
                                        className="relative aspect-[1600/600] max-h-[200px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                                        style={{ aspectRatio: "1600/600" }}
                                      >
                                        <img
                                          src={
                                            editHeroImageUrl?.trim() ||
                                            editCardImageUrl?.trim() ||
                                            LANDING_HERO_FALLBACK_IMAGE
                                          }
                                          alt=""
                                          className="absolute inset-0 h-full w-full object-cover object-center"
                                        />
                                        <div
                                          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
                                          aria-hidden
                                        />
                                        <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
                                          <span className="font-semibold text-white drop-shadow-sm line-clamp-1 text-sm sm:text-base">
                                            {editLandingTitle?.trim() || item.name || "히어로 제목"}
                                          </span>
                                          <span className="mt-1 line-clamp-2 text-xs text-white/90 drop-shadow-sm sm:text-sm">
                                            {editLandingDescription?.trim() || item.card_description?.trim() || "히어로 설명 문구"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                            {expandedItemKey === item.id ? (
                              <tr>
                                <td colSpan={taxonomyTableColSpan} className="bg-[var(--surface-muted)] p-0 align-top">
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
                                            <dt className="inline font-medium text-[var(--text-primary)]">분류 </dt>
                                            <dd className="inline text-[var(--text-secondary)]">{TAXONOMY_TYPE_LABELS[item.taxonomy_type] ?? item.taxonomy_type}</dd>
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
                {(activeTab === "destination" || activeTab === "theme") ? (
                  <select
                    value={newParentId ?? ""}
                    onChange={(e) => onParentIdChange(e.target.value === "" ? null : e.target.value)}
                    className={cn(inputBase, "min-w-[100px]")}
                    aria-label="상위 (선택)"
                  >
                    <option value="">대분류 없음 (최상위)</option>
                    {parentSelectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <input
                  value={newNameInput}
                  onChange={(e) => onNameInputChange(e.target.value)}
                  placeholder={ADD_PLACEHOLDERS[activeTab]}
                  className={cn(inputBase, "min-w-[120px]")}
                />
                <input
                  value={newSlug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="slug (선택)"
                  className={cn(inputBase, "w-24")}
                />
                <input
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => onSortOrderChange(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="정렬"
                  className={cn(inputBase, "w-16")}
                />
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={pendingCreateType !== null || !newNameInput.trim()}
                  className={cn(btnSmall, "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] disabled:opacity-50")}
                >
                  {pendingCreateType !== null ? "추가 중..." : ADD_BUTTON_LABELS[activeTab]}
                </button>
              </div>
            </div>
        </>
      )}
    </section>
  );
}
