"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import type { Product, ItineraryStructuredDay, ItineraryV2, SelectedEventRef } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { ProductFormState, ProductFormDraft, TermsTemplateType } from "@/types/adminProductForm";
import { mergeProductFormWithSchemaDefaults } from "@/types/adminProductForm";
import { createEmptyAdminProductFormState } from "@/components/admin/products/editor/adminProductForm.defaults";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import {
  mapAdminProductFormToPreviewProduct,
  getPreviewWarnings,
  type PreviewWarning,
} from "@/components/admin/products/editor/adminProductPreview.mapper";
import { SECTIONS } from "@/components/admin/products/editor/adminProductForm.validation";
import { useProductFormIssues } from "@/components/admin/products/editor/hooks/useProductFormIssues";
import { useProductFormAutosave } from "@/components/admin/products/editor/hooks/useProductFormAutosave";
import { useUnsavedChangesGuard } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";
import {
  EDITOR_UI_STATE_KEY,
  useEditorSectionPersistence,
} from "@/components/admin/products/editor/hooks/useEditorSectionPersistence";
import { useEditorKeyboardShortcuts } from "@/components/admin/products/editor/hooks/useEditorKeyboardShortcuts";
import { parseDetailedSchedule, type DayScheduleDraft } from "@/components/admin/products/editor/adminProductForm.helpers";

import type { SectionId, FormIssue, SectionIssue } from "@/components/admin/products/editor/adminProductForm.types";
/** AdminProductManager에서 사용하는 섹션/이슈 타입 re-export */
export type { SectionId, FormIssue, SectionIssue };
export type { PreviewWarning } from "@/components/admin/products/editor/adminProductPreview.mapper";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import ProductCard, { type ProductCardProps } from "@/components/products/ProductCard";
import ProductDetailV2, { type ProductDetailV2StatusTag } from "@/components/products/ProductDetailV2";
import {
  ProductDetailStickyV2Desktop,
  ProductDetailStickyV2Mobile,
} from "@/components/products/ProductDetailStickyV2";
import { ConsultModalProvider } from "@/components/inquiry/ConsultModal";
import { ProductQuoteProvider } from "@/components/products/ProductQuoteContext";
import {
  productToCardPropsPayload,
  productToDetailV2PropsPayload,
} from "@/lib/admin/productPreview";
import { hydrateProductWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  itineraryV2ToTimelineModel,
} from "@/lib/products/mapProductToTimelineModel";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { normalizeImageList } from "@/lib/products/images";
import {
  fetchAdminProduct,
  createAdminProduct,
  updateAdminProduct,
} from "@/components/admin/products/api/adminProducts.client";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { ImageImportGuideModal } from "@/components/admin/ImageImportGuideModal";
import { parsePastedImageUrls } from "@/lib/admin/parsePastedImageUrls";
import { ProductFormActionBar } from "@/components/admin/ProductFormActionBar";
import { ProductFormSectionNav } from "@/components/admin/ProductFormSectionNav";
import { extractTitleCandidates } from "@/lib/products/extractProductTitle";
import {
  recommendCoverCandidates,
  type CoverCandidate,
} from "@/lib/products/recommendCoverImage";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import AdminHomeCuratedManager from "@/components/admin/products/AdminHomeCuratedManager";
import AdminHomeRegionCardsManager from "@/components/admin/products/AdminHomeRegionCardsManager";
import AdminHomeThemeCardsManager from "@/components/admin/products/AdminHomeThemeCardsManager";
import AdminProductsCollectionCampaignsManager from "@/components/admin/products/AdminProductsCollectionCampaignsManager";
import AdminProductTaxonomyView from "@/components/admin/products/AdminProductTaxonomyView";
import AdminProductListSection from "@/components/admin/products/AdminProductListSection";
import { useAdminProductTaxonomyController } from "@/components/admin/products/hooks/useAdminProductTaxonomyController";
import AdminProductEditorView from "@/components/admin/products/AdminProductEditorView";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  DEFAULT_PRODUCTS_PAGE_SIZE,
} from "@/components/admin/products/adminProducts.constants";
import { buildRegionTree } from "@/lib/productTaxonomies";
import type { RegionTreeNode } from "@/types/productTaxonomy";
import { ProductEditorShell } from "@/components/admin/products/editor/ProductEditorShell";

function normalizeUrlForCompare(url: string): string {
  return url.trim();
}

type TermsTemplateMap = Record<TermsTemplateType, string>;

function createEmptyTermsTemplateMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

/** 임시저장 localStorage 키 접두사 (뒤에 productId or 'new' 붙임) */
const PRODUCT_FORM_DRAFT_KEY_PREFIX = "admin_product_form_draft_v1:";

function getDraftKey(productId: string | null): string {
  return PRODUCT_FORM_DRAFT_KEY_PREFIX + (productId ?? "new");
}

/** 상품 폼용: taxonomy 항목을 대분류(parent_id null) 기준 그룹으로 묶어 반환. 대분류가 있으면 그룹별로, 없으면 한 그룹에 전체. */
function buildTaxonomyGroupsForForm(
  items: ProductTaxonomyWithUsage[],
  fallbackGroupLabel: string,
): { label: string; items: { id: string; name: string }[] }[] {
  const active = items.filter((i) => i.is_active);
  const roots = active
    .filter((i) => !i.parent_id || i.parent_id.trim() === "")
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    });
  const byParent = new Map<string, ProductTaxonomyWithUsage[]>();
  for (const i of active) {
    const pid = i.parent_id?.trim();
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
  if (roots.length > 0) {
    return roots.map((root) => {
      const children = byParent.get(root.id) ?? [];
      return {
        label: root.name ?? "",
        items: [
          { id: root.id, name: root.name ?? "" },
          ...children.map((c) => ({ id: c.id, name: c.name ?? "" })),
        ],
      };
    });
  }
  const flat = active
    .sort((a, b) => {
      const sa = a.sort_order ?? 9999;
      const sb = b.sort_order ?? 9999;
      if (sa !== sb) return sa - sb;
      return (a.name ?? "").localeCompare(b.name ?? "", "ko");
    })
    .map((i) => ({ id: i.id, name: i.name ?? "" }));
  return flat.length > 0 ? [{ label: fallbackGroupLabel, items: flat }] : [];
}

/** 트리에서 id에 해당하는 노드까지의 경로(루트→리프) 반환. 없으면 []. */
function getPathToNodeById(tree: RegionTreeNode[], targetId: string): RegionTreeNode[] {
  const path: RegionTreeNode[] = [];
  function find(nodes: RegionTreeNode[], target: string): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.id === target) return true;
      if (node.children?.length && find(node.children, target)) return true;
      path.pop();
    }
    return false;
  }
  find(tree, targetId);
  return path;
}

/** 트리 모든 노드 id 수집 (activeDestinationIds 등용). */
function flattenTreeIds(nodes: RegionTreeNode[]): string[] {
  const ids: string[] = [];
  function walk(n: RegionTreeNode) {
    ids.push(n.id);
    n.children?.forEach(walk);
  }
  nodes.forEach(walk);
  return ids;
}

/** 트리에서 name에 해당하는 노드까지의 경로(루트→리프) 반환. 첫 번째 일치. 없으면 []. */
function getPathToNodeByName(tree: RegionTreeNode[], targetName: string): RegionTreeNode[] {
  const path: RegionTreeNode[] = [];
  const name = targetName.trim();
  if (!name) return [];
  function find(nodes: RegionTreeNode[], target: string): boolean {
    for (const node of nodes) {
      path.push(node);
      if (node.name === target) return true;
      if (node.children?.length && find(node.children, target)) return true;
      path.pop();
    }
    return false;
  }
  find(tree, name);
  return path;
}

const initialFormState: ProductFormState = createEmptyAdminProductFormState();

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

function formatPriceWithCommas(raw: string) {
  const hasTilde = raw.includes("~");
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  const formatted = digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return hasTilde ? `${formatted}~` : formatted;
}

function serializeDetailedSchedule(drafts: DayScheduleDraft[]) {
  const cleaned = drafts
    .map((item) => ({
      label: item.label.trim(),
      content: item.content.trim(),
    }))
    .filter((item) => item.label.length > 0 || item.content.length > 0);

  return cleaned
    .map((item) => {
      const safeLabel = item.label || "일정";
      return item.content ? `[${safeLabel}]\n${item.content}` : `[${safeLabel}]`;
    })
    .join("\n\n");
}

function createNextDayLabel(drafts: DayScheduleDraft[]) {
  const dayNumbers = drafts
    .map((item) => item.label.trim().match(/^(\d+)\s*일차$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
  const next = dayNumbers.length > 0 ? Math.max(...dayNumbers) + 1 : drafts.length + 1;
  return `${next}일차`;
}

export default function AdminProductManager() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const viewParam = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const isTaxonomyView = viewParam === ADMIN_PRODUCTS_VIEW.TAXONOMY;
  const isCreateView = viewParam === ADMIN_PRODUCTS_VIEW.CREATE;
  const isFeaturedView = viewParam === ADMIN_PRODUCTS_VIEW.FEATURED;
  const isHomeRegionCardsView = viewParam === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS;
  const isHomeThemeCardsView = viewParam === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS;
  const isListView = !viewParam || viewParam === ADMIN_PRODUCTS_VIEW.LIST;
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplateMap>(createEmptyTermsTemplateMap());
  const [isTermsTemplatesLoading, setIsTermsTemplatesLoading] = useState(true);
  const [isTermsTemplatesSaving, setIsTermsTemplatesSaving] = useState(false);
  const [termsTemplatesErrorMessage, setTermsTemplatesErrorMessage] = useState("");
  const [isTermsTemplatesPanelOpen, setIsTermsTemplatesPanelOpen] = useState(false);
  const [activeSchedulePreviewIndex, setActiveSchedulePreviewIndex] = useState(0);
  const [showRawScheduleEditor, setShowRawScheduleEditor] = useState(false);
  /** 일정 입력 모드: 시각화(권장) vs 레거시 텍스트 */
  const [scheduleEditorMode, setScheduleEditorMode] = useState<"visual" | "legacy">("visual");
  /** 현재 선택된 이벤트 (상품 이미지 → 이 이벤트에 추가용). 일정 탭에서 이벤트 클릭 시 설정 */
  const [selectedEvent, setSelectedEvent] = useState<SelectedEventRef | null>(null);
  const [pasteToAddValue, setPasteToAddValue] = useState("");
  const [showImageImportGuideModal, setShowImageImportGuideModal] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState<ProductFormDraft | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [productFormOpenSections, setProductFormOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    taxonomy: true,
    price: false,
    description: false,
    included: false,
    schedule: false,
    flight: false,
    terms: false,
  });
  /** 목차 네비에서 현재 스크롤 기준 활성 섹션 (IntersectionObserver로 갱신) */
  const [activeSectionId, setActiveSectionId] = useState<SectionId | null>("basic");
  /** 필수 오류 순차 이동 시 `requiredIssues` 인덱스 */
  const [currentIssueIndex, setCurrentIssueIndex] = useState(0);
  const [showShortcutTip, setShowShortcutTip] = useState(false);

  const departureFlightCode = useMemo(
    () => (form.departure_flight_name ? normalizeAirline(form.departure_flight_name) : null),
    [form.departure_flight_name],
  );
  const arrivalFlightCode = useMemo(
    () => (form.arrival_flight_name ? normalizeAirline(form.arrival_flight_name) : null),
    [form.arrival_flight_name],
  );

  const departureHasLogo = departureFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[departureFlightCode]) : false;
  const arrivalHasLogo = arrivalFlightCode ? Boolean(AIRLINE_LOGO_BY_CODE[arrivalFlightCode]) : false;
  /** 미리보기 디바이스 뷰 (클래스로만 구분) */
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  /** 미리보기용 로컬 이미지 파일 선택 시 ObjectURL 생성/해제용 */
  const [previewImageFile, setPreviewImageFile] = useState<File | null>(null);
  const [previewImageObjectUrl, setPreviewImageObjectUrl] = useState<string | null>(null);
  /** 상세 미리보기에서 Sticky CTA 표시 여부 (UX 방해 시 숨김) */
  const [showDetailSticky, setShowDetailSticky] = useState(true);
  /** 상품명 추출 모달 */
  const [showTitleExtractModal, setShowTitleExtractModal] = useState(false);
  const [titleExtractPaste, setTitleExtractPaste] = useState("");
  const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
  /** 대표 이미지 추천 모달 */
  const [showCoverRecommendModal, setShowCoverRecommendModal] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshListRef = useRef<(() => Promise<void>) | null>(null);
  const pageSize = DEFAULT_PRODUCTS_PAGE_SIZE;
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();

  const taxonomyController = useAdminProductTaxonomyController({
    showToast,
    confirm,
    onCategoryAdded(name) {
      setForm((prev) => ({ ...prev, category: name }));
    },
    onThemeAdded(name) {
      setForm((prev) => ({ ...prev, theme: name }));
    },
  });

  /** 대분류만 선택한 상태(중분류 표시용). destination_id가 있으면 path로 대체. */
  const [selectedLevel1Id, setSelectedLevel1Id] = useState("");
  /** 중분류만 선택한 상태(소분류 표시용). */
  const [selectedLevel2Id, setSelectedLevel2Id] = useState("");
  /** 테마 대분류만 선택한 상태(중분류 표시용). */
  const [selectedThemeLevel1Id, setSelectedThemeLevel1Id] = useState("");
  /** 테마 중분류만 선택한 상태(소분류 표시용). */
  const [selectedThemeLevel2Id, setSelectedThemeLevel2Id] = useState("");

  function parseCampaignsList(value: string) {
    return value
      .split(/[,\n|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  function stringifyCampaignsList(list: string[]) {
    return list.join(",");
  }

  function showLocalToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  }

  /** 스크롤 오프셋: sticky 액션바 높이 + 여유 16px */
  function getStickyHeaderOffset(): number {
    if (typeof document === "undefined") return 80;
    const bar = document.getElementById("product-form-actionbar");
    const h = bar?.getBoundingClientRect().height ?? 0;
    return h + 16;
  }

  /** 네비/경고/이슈 클릭 시: 해당 섹션 열기 + DOM 반영 후 스크롤 + (anchorId 있으면 포커스). 토글이 아닌 항상 펼치기만 함. */
  function openSectionAndScrollTo(sectionId: SectionId, anchorId?: string) {
    setProductFormOpenSections((prev) => ({ ...prev, [sectionId]: true }));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const headerOffset = getStickyHeaderOffset();
        const targetId = anchorId ?? `form-section-${sectionId}`;
        const el = document.getElementById(targetId) as HTMLElement | null;
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top, behavior: "smooth" });
        if (anchorId && typeof el.focus === "function") {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  const openSectionAndScrollToRef = useRef(openSectionAndScrollTo);
  openSectionAndScrollToRef.current = openSectionAndScrollTo;

  /** 아코디언 헤더 클릭: 토글(열려 있으면 접기, 닫혀 있으면 열고 스크롤). */
  function toggleSection(sectionId: SectionId) {
    setProductFormOpenSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      if (next[sectionId]) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const headerOffset = getStickyHeaderOffset();
            const el = document.getElementById(`form-section-${sectionId}`) as HTMLElement | null;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
            window.scrollTo({ top, behavior: "smooth" });
          });
        });
      }
      return next;
    });
  }

  /** 검증 실패 시 섹션 열기 + 스크롤 + 포커스 + 토스트. 네비 클릭 시에도 호출되며, 항상 해당 섹션을 펼침만 함(토글 없음). */
  function openSectionAndFocus(opts: {
    sectionId: SectionId;
    anchorId?: string;
    reason?: string;
  }) {
    const { sectionId, anchorId, reason } = opts;
    openSectionAndScrollTo(sectionId, anchorId);
    if (reason) showLocalToast("error", reason);
  }

  /** 상품 공용 이미지 URL을 현재 선택된 이벤트의 images에 추가. 중복 시 스킵, cover/ sortOrder 자동 설정 */
  function addProductImageToSelectedEvent(url: string) {
    const ref = selectedEvent;
    if (!ref) return false;
    const normalized = normalizeUrlForCompare(url);
    if (!normalized || !/^https?:\/\//i.test(normalized)) return false;

    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const newItem = { url: normalized };
      const nextImages = [...images, newItem];
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return true;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return false;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return false;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      if (existingSet.has(normalized)) return false;
      const newItem = { url: normalized };
      const nextImages = [...images, newItem];
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                ),
              }
            : d,
        ),
      }));
      return true;
    }

    return false;
  }

  /** 선택 이벤트 라벨 "Day N - 이벤트명" (상단 배너용) */
  function getSelectedEventLabel(): string | null {
    const ref = selectedEvent;
    if (!ref) return null;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return null;
      const event = day.events?.[ref.eventIndex];
      if (!event) return null;
      const dayNum = day.day ?? ref.dayIndex + 1;
      return `Day ${dayNum} - ${(event.heading || "").trim() || "이벤트"}`;
    }
    return null;
  }

  /** 붙여넣기 URL 목록을 선택 이벤트에 일괄 추가. 중복/cover/sortOrder 동일 규칙. 반환: 추가된 개수 */
  function addImagesToEvent(ref: SelectedEventRef | null, urls: string[]): number {
    if (!ref || urls.length === 0) return 0;
    const parsed = parsePastedImageUrls(urls.join("\n"));
    const valid = parsed.filter((u) => /^https?:\/\//i.test(normalizeUrlForCompare(u)));
    if (valid.length === 0) return 0;

    let added = 0;
    if (ref.editorType === "v2") {
      const days = form.itinerary_v2_json?.days ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = event.images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const toAdd: Array<{ url: string }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        toAdd.push({ url: normalized });
      }
      if (toAdd.length === 0) return added;
      added = toAdd.length;
      const nextImages = [...images, ...toAdd];
      setForm((prev: any) => ({
        ...prev,
        itinerary_v2_json: {
          ...prev.itinerary_v2_json,
          days: prev.itinerary_v2_json.days.map((d: ItineraryStructuredDay, di: number) =>
            di === ref.dayIndex
              ? {
                  ...d,
                  events: d.events.map((e: any, ei: number) =>
                    ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                  ),
                }
              : d,
          ),
        },
      }));
      return added;
    }

    if (ref.editorType === "structured") {
      const days = form.itinerary_days_json ?? [];
      const day = days[ref.dayIndex];
      if (!day) return 0;
      const events = day.events ?? [];
      const event = events[ref.eventIndex];
      if (!event) return 0;
      const images = (event as { images?: Array<{ url: string; sortOrder?: number; isCover?: boolean }> }).images ?? [];
      const existingSet = new Set(images.map((i) => normalizeUrlForCompare(i.url)));
      const toAdd: Array<{ url: string }> = [];
      for (const url of valid) {
        const normalized = normalizeUrlForCompare(url);
        if (!normalized || existingSet.has(normalized)) continue;
        existingSet.add(normalized);
        toAdd.push({ url: normalized });
      }
      if (toAdd.length === 0) return added;
      added = toAdd.length;
      const nextImages = [...images, ...toAdd];
      setForm((prev: any) => ({
        ...prev,
        itinerary_days_json: prev.itinerary_days_json.map((d: ItineraryStructuredDay, di: number) =>
          di === ref.dayIndex
            ? {
                ...d,
                events: d.events.map((e: any, ei: number) =>
                  ei === ref.eventIndex ? { ...e, images: nextImages } : e,
                ),
              }
            : d,
        ),
      }));
      return added;
    }
    return 0;
  }

  async function loadTermsTemplates() {
    try {
      setIsTermsTemplatesLoading(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", { cache: "no-store" });
      const result = (await response.json()) as Partial<TermsTemplateMap> | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "약관 템플릿 조회에 실패했습니다.";
        setTermsTemplatesErrorMessage(msg ?? "약관 템플릿 조회에 실패했습니다.");
        return;
      }
      const templateResult = result as Partial<TermsTemplateMap>;
      setTermsTemplates({
        overseas_brokerage: templateResult.overseas_brokerage ?? "",
        domestic_brokerage: templateResult.domestic_brokerage ?? "",
        overseas_direct: templateResult.overseas_direct ?? "",
        domestic_direct: templateResult.domestic_direct ?? "",
      });
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 조회 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadTermsTemplates();
  }, []);

  const urlEditingId = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.EDITING_ID);
  const initialFormSnapshotRef = useRef<ProductFormState | null>(null);

  const writeDraftToStorage = useCallback((nextForm: ProductFormState) => {
    const key = getDraftKey(editingId);
    const payload: ProductFormDraft = { version: 1, form: nextForm, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(payload));
  }, [editingId]);

  const autosaveEnabled = isCreateView || Boolean(editingId);
  const autosaveStorageKey = autosaveEnabled ? getDraftKey(editingId) : null;
  const autosaveBaseSnapshot = editingId
    ? (initialFormSnapshotRef.current ?? null)
    : initialFormState;

  const {
    isDirty,
    autosaveStatus,
    lastSavedAt,
    resetBaseSnapshot,
    markSavedNow,
  } = useProductFormAutosave({
    enabled: autosaveEnabled,
    form,
    storageKey: autosaveStorageKey,
    saveDraft: writeDraftToStorage,
    initialSnapshot: autosaveBaseSnapshot,
    debounceMs: 1500,
    pause: isSubmitting || isSavingDraft,
  });

  const { markSafeNavigation } = useUnsavedChangesGuard({
    enabled: autosaveEnabled,
    isDirty,
  });

  const editorUIKey = EDITOR_UI_STATE_KEY(editingId);

  useEditorSectionPersistence({
    storageKey: editorUIKey,
    openSections: productFormOpenSections,
    setOpenSections: setProductFormOpenSections,
    activeSectionId,
    setActiveSectionId: (id) => setActiveSectionId(id as SectionId),
  });

  useEffect(() => {
    if (!urlEditingId) return;
    initialFormSnapshotRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const product = await fetchAdminProduct(urlEditingId);
        if (cancelled) return;
        const images = normalizeImageList(product.images_json);
        const productWithImages = {
          ...product,
          images_json: images,
          image_url: images[0] ?? product.image_url ?? "",
        };
        const nextForm = deserializeAdminProductToForm(productWithImages);
        setForm(nextForm);
        initialFormSnapshotRef.current = structuredClone(nextForm);
        setEditingId(urlEditingId);
        setErrorMessage("");
        resetBaseSnapshot(nextForm);
        setTimeout(() => {
          try {
            const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(urlEditingId));
            if (!raw) return;
            const parsed = JSON.parse(raw) as { activeSectionId?: string };
            if (parsed.activeSectionId) {
              openSectionAndScrollToRef.current(parsed.activeSectionId as SectionId);
            }
          } catch {
            // ignore
          }
        }, 0);
      } catch {
        if (!cancelled) {
          setEditingId(urlEditingId);
          setForm(initialFormState);
          resetBaseSnapshot(initialFormState);
          setErrorMessage("상품을 불러오지 못했습니다. 목록에서 다시 시도해 주세요.");
          showLocalToast("error", "상품 조회에 실패했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlEditingId, resetBaseSnapshot]);

  const diffSummary = useMemo(() => {
    const initial = editingId
      ? (initialFormSnapshotRef.current ?? initialFormState)
      : initialFormState;
    return getProductDiffSummary(initial, form);
  }, [form, editingId]);

  const { issuesBySection, allIssues, requiredIssues } = useProductFormIssues(form);

  /** 폼 제출 (액션 바 [저장] 및 form onSubmit에서 공통 호출) */
  const submit = () => void handleSubmit(undefined);

  const submitRequestIdRef = useRef(0);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    if (requiredIssues.length > 0) {
      setCurrentIssueIndex(0);
      const first = requiredIssues[0];
      const sectionTitle = SECTIONS.find((s) => s.id === first.sectionId)?.title ?? first.sectionId;
      openSectionAndFocus({
        sectionId: first.sectionId,
        anchorId: first.anchorId,
        reason: `저장 실패: ${sectionTitle} - ${first.message}`,
      });
      setIsSubmitting(false);
      return;
    }

    const requestId = ++submitRequestIdRef.current;
    const currentDraftKey = getDraftKey(editingId);
    try {
      const payload = serializeAdminProductForm(form, { editingId });
      let result: { message?: string; warningCode?: string };
      if (editingId) {
        result = await updateAdminProduct(editingId, payload);
      } else {
        result = await createAdminProduct(payload);
      }

      if (requestId !== submitRequestIdRef.current) return;

      if (result.warningCode === "IMAGES_JSON_NOT_PERSISTED") {
        showLocalToast(
          "error",
          "DB에 images_json 컬럼이 없어 대표 이미지 외 나머지는 저장되지 않았습니다. supabase/products_images_json_upgrade.sql 실행이 필요합니다.",
        );
      } else {
        showToast("success", editingId ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
      }
      markSafeNavigation();
      setEditingId(null);
      setForm(initialFormState);
      resetBaseSnapshot(initialFormState);
      setActiveSchedulePreviewIndex(0);
      setShowRawScheduleEditor(false);
      setScheduleEditorMode("visual");
      localStorage.removeItem(currentDraftKey);
      setShowDraftBanner(false);
      setDraftData(null);
      await refreshListRef.current?.();
    } catch (error) {
      if (requestId !== submitRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : "상품 저장 중 오류가 발생했습니다.";
      setErrorMessage(message);
      showLocalToast("error", message);
    } finally {
      if (requestId === submitRequestIdRef.current) {
        setIsSubmitting(false);
      }
    }
  }

  function goToNextIssue() {
    if (requiredIssues.length === 0) return;

    const nextIndex = (currentIssueIndex + 1) % requiredIssues.length;
    const issue = requiredIssues[nextIndex];

    openSectionAndFocus({
      sectionId: issue.sectionId,
      anchorId: issue.anchorId,
      reason: `다음 오류: ${issue.message}`,
    });

    setCurrentIssueIndex(nextIndex);
  }

  const categoryGroups = useMemo(
    () =>
      buildTaxonomyGroupsForForm(
        taxonomyController.destinationOptions.filter((i) => i.taxonomy_type === "destination"),
        "지역",
      ),
    [taxonomyController.destinationOptions],
  );
  const destinationTree = useMemo(
    () =>
      buildRegionTree(
        taxonomyController.destinationOptions.filter((i) => i.taxonomy_type === "destination"),
      ),
    [taxonomyController.destinationOptions],
  );
  const categoryOptions = useMemo(
    () => categoryGroups.flatMap((g) => g.items.map((i) => i.name)),
    [categoryGroups],
  );
  const activeDestinationIds = useMemo(
    () => new Set(flattenTreeIds(destinationTree)),
    [destinationTree],
  );
  const destinationPath = useMemo(
    () => (form.destination_id ? getPathToNodeById(destinationTree, form.destination_id) : []),
    [destinationTree, form.destination_id],
  );
  const themeTree = useMemo(
    () =>
      buildRegionTree(
        taxonomyController.themeOptions.filter((i) => i.taxonomy_type === "theme"),
      ),
    [taxonomyController.themeOptions],
  );
  const themePath = useMemo(
    () => (form.theme.trim() ? getPathToNodeByName(themeTree, form.theme.trim()) : []),
    [themeTree, form.theme],
  );
  const availableThemeOptions = useMemo(() => {
    const names: string[] = [];
    function walk(n: RegionTreeNode) {
      names.push(n.name);
      n.children?.forEach(walk);
    }
    themeTree.forEach(walk);
    return names;
  }, [themeTree]);
  const activeProductLineOptions = useMemo(
    () =>
      taxonomyController.productLineOptions.filter(
        (i) => i.taxonomy_type === "product_line" && i.is_active,
      ),
    [taxonomyController.productLineOptions],
  );
  const activeCampaignOptions = useMemo(
    () =>
      taxonomyController.campaignOptions.filter(
        (i) => i.taxonomy_type === "campaign" && i.is_active,
      ),
    [taxonomyController.campaignOptions],
  );
  const selectedCampaigns = useMemo(
    () => parseCampaignsList(form.campaigns),
    [form.campaigns],
  );
  const scheduleDrafts = useMemo(
    () => parseDetailedSchedule(form.detailed_schedule),
    [form.detailed_schedule],
  );
  const effectiveDayCount =
    form.itinerary_days_json.length > 0
      ? form.itinerary_days_json.length
      : scheduleDrafts.length;
  const selectedTermsTemplateContent = useMemo(() => {
    if (!form.terms_template_type) return "";
    return termsTemplates[form.terms_template_type] ?? "";
  }, [form.terms_template_type, termsTemplates]);

  /** 폼 + 이미지(URL 또는 File ObjectURL) 기반 미리보기용 Product (공용 로직). PR3: campaign taxonomy로 배지 해석 */
  const previewProduct = useMemo(() => {
    const base = mapAdminProductFormToPreviewProduct(
      form,
      previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "",
    );
    return hydrateProductWithCampaignCardMeta(base, activeCampaignOptions);
  }, [form, previewImageObjectUrl, activeCampaignOptions]);

  /** 로컬 fallback: 카드/상세 props (API 실패 시 사용) */
  const localCardProps = useMemo<ProductCardProps>(() => {
    const payload = productToCardPropsPayload(previewProduct);
    return {
      ...payload,
      onClickDetail: () => {},
      onClickConsult: () => {},
    };
  }, [previewProduct]);

  const localDetailProps = useMemo(() => {
    const payload = productToDetailV2PropsPayload(previewProduct);
    return {
      ...payload,
      onConsultClick: () => {},
      kakaoHref: "#",
      trust: undefined,
    };
  }, [previewProduct]);

  /** 서버 preview API 응답 (우선 사용, 실패 시 로컬 fallback) */
  const [serverPreview, setServerPreview] = useState<{
    previewProduct: Product;
    cardProps: ReturnType<typeof productToCardPropsPayload>;
    detailProps: ReturnType<typeof productToDetailV2PropsPayload>;
  } | null>(null);

  const effectivePreviewProduct = serverPreview?.previewProduct ?? previewProduct;
  const previewCardProps: ProductCardProps = serverPreview
    ? { ...serverPreview.cardProps, onClickDetail: () => {}, onClickConsult: () => {} }
    : localCardProps;
  const previewDetailProps = serverPreview
    ? {
        ...serverPreview.detailProps,
        onConsultClick: () => {},
        kakaoHref: "#",
        trust: undefined,
      }
    : localDetailProps;

  const hasPreviewImage = !!(form.image_url?.trim() || form.images_json.length > 0 || previewImageFile);
  const previewWarnings = useMemo(
    () => getPreviewWarnings(form, hasPreviewImage),
    [form, hasPreviewImage],
  );

  /** 일정에서 이미지 URL 수집 (대표 이미지 추천: 상품 이미지 없을 때) — Day1 cover 또는 Day1 첫 이벤트 첫 이미지 우선 */
  const itineraryImageUrls = useMemo(() => {
    const out: string[] = [];
    const v2Days = form.itinerary_v2_json?.days ?? [];
    if (v2Days.length > 0) {
      const day1 = v2Days[0];
      if (day1?.coverImageUrl?.trim()) out.push(day1.coverImageUrl.trim());
      const events = day1?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    const structDays = form.itinerary_days_json ?? [];
    if (out.length === 0 && structDays.length > 0) {
      const day1 = structDays[0];
      const events = (day1 as { events?: Array<{ images?: Array<{ url?: string }> }> })?.events ?? [];
      for (const ev of events) {
        const imgs = ev.images ?? [];
        for (const img of imgs) {
          if (typeof img.url === "string" && img.url.trim()) {
            out.push(img.url.trim());
            break;
          }
        }
      }
    }
    return out;
  }, [form.itinerary_v2_json, form.itinerary_days_json]);

  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const key = getDraftKey(editingId);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.form &&
        typeof parsed.savedAt === "number"
      ) {
        setDraftData(parsed as unknown as ProductFormDraft);
        setShowDraftBanner(true);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }, [isCreateView, editingId]);

  /** 상단 액션바 높이에 맞춰 좌측 네비 sticky top 오프셋 설정 (겹침 방지) */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const setNavTop = () => {
      const bar = document.getElementById("product-form-actionbar");
      const h = bar?.getBoundingClientRect().height ?? 0;
      const offset = h + 16;
      document.documentElement.style.setProperty("--product-form-nav-top", `${offset}px`);
    };
    const t = setTimeout(setNavTop, 100);
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(setNavTop);
    });
    const observe = () => {
      const bar = document.getElementById("product-form-actionbar");
      if (bar) ro.observe(bar);
    };
    const t2 = setTimeout(observe, 150);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [isCreateView, editingId]);

  /** Scroll Spy: 윈도우 스크롤 기준 activeSectionId 자동 동기화 */
  useEffect(() => {
    if (!(isCreateView || editingId)) return;
    const headerOffset = getStickyHeaderOffset();
    const ids = SECTIONS.map((s) => s.id);

    const els = ids
      .map((id) => document.getElementById(`form-section-${id}`))
      .filter(Boolean) as HTMLElement[];

    if (els.length === 0) return;

    let raf = 0;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

        const next = visible[0]?.id?.replace("form-section-", "");
        if (!next) return;

        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          setActiveSectionId(next as SectionId);
        });
      },
      {
        root: null,
        rootMargin: `-${headerOffset + 8}px 0px -60% 0px`,
        threshold: [0, 0.1, 0.25],
      }
    );

    els.forEach((el) => io.observe(el));

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [isCreateView, editingId]);

  function handleSaveDraft() {
    setIsSavingDraft(true);
    try {
      writeDraftToStorage(form);
      showLocalToast("success", "임시저장 완료");
      markSavedNow(form);
    } catch {
      showLocalToast("error", "임시저장에 실패했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  const editorShortcutsEnabled =
    (isCreateView || Boolean(editingId)) &&
    !isFeaturedView &&
    !isHomeRegionCardsView &&
    !isHomeThemeCardsView;

  useEditorKeyboardShortcuts({
    enabled: editorShortcutsEnabled,
    onSave: submit,
    onTempSave: handleSaveDraft,
    isSaving: isSubmitting,
    isSavingDraft,
  });

  useEffect(() => {
    if (!(isCreateView || editingId)) {
      setShowShortcutTip(false);
      return;
    }
    try {
      setShowShortcutTip(!localStorage.getItem("editor-shortcut-tip-dismissed"));
    } catch {
      setShowShortcutTip(false);
    }
  }, [isCreateView, editingId]);

  function handleRestoreDraft() {
    if (!draftData) return;
    const restored = mergeProductFormWithSchemaDefaults(draftData.form);
    setForm(restored);
    resetBaseSnapshot(restored);
    markSafeNavigation();
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
    showLocalToast("success", "임시 저장본을 복원했습니다.");
  }

  function handleDismissDraft() {
    localStorage.removeItem(getDraftKey(editingId));
    setDraftData(null);
    setShowDraftBanner(false);
  }

  function handlePreviewClick() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("product-form-preview-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleWarningClick(sectionId: SectionId) {
    openSectionAndFocus({ sectionId });
  }

  function runTitleExtract() {
    const candidates = extractTitleCandidates(titleExtractPaste);
    setTitleCandidates(candidates);
    showLocalToast("success", `후보 ${candidates.length}개 추출`);
  }

  async function applyTitleCandidate(candidate: string, append: boolean) {
    const current = form.title.trim();
    if (current && !append) {
      const ok = await confirm({
        title: "상품명 덮어쓰기",
        description: "이미 입력된 상품명이 있습니다. 덮어쓸까요?",
        confirmLabel: "덮어쓰기",
        cancelLabel: "취소",
      });
      if (!ok) return;
    }
    if (append && current) {
      setForm((prev) => ({ ...prev, title: `${current} ${candidate}`.trim() }));
      showLocalToast("success", "상품명에 이어서 붙였습니다.");
    } else {
      setForm((prev) => ({ ...prev, title: candidate }));
      showLocalToast("success", "상품명 적용 완료");
    }
    setShowTitleExtractModal(false);
    setTitleExtractPaste("");
    setTitleCandidates([]);
  }

  function openCoverRecommendModal() {
    const productImages = normalizeImageList(form.images_json);
    const currentCover = form.image_url?.trim();
    const list = currentCover && !productImages.includes(currentCover) ? [currentCover, ...productImages] : productImages;
    const candidates = recommendCoverCandidates({
      productImages: list,
      itineraryImages: list.length === 0 ? itineraryImageUrls : undefined,
    });
    setCoverCandidates(candidates);
    setShowCoverRecommendModal(true);
  }

  function setCoverAsPrimary(url: string) {
    const hadCover = !!(form.image_url?.trim());
    setForm((prev) => ({ ...prev, image_url: url }));
    showLocalToast("success", hadCover ? "대표 이미지를 변경했습니다." : "대표 이미지가 지정되었습니다.");
    setShowCoverRecommendModal(false);
  }

  /** File 선택 시 ObjectURL 생성, 언마운트/파일 변경 시 revoke */
  useEffect(() => {
    if (!previewImageFile) {
      setPreviewImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewImageFile);
    setPreviewImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [previewImageFile]);

  /** 400ms debounce로 preview API 호출, 성공 시 serverPreview 설정, 실패 시 로컬 fallback 유지 */
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestIdRef = useRef(0);
  useEffect(() => {
    setServerPreview(null);
    previewDebounceRef.current && clearTimeout(previewDebounceRef.current);
    const requestId = ++previewRequestIdRef.current;
    previewDebounceRef.current = setTimeout(() => {
      previewDebounceRef.current = null;
      const imageUrl = previewImageObjectUrl ?? form.images_json[0] ?? form.image_url?.trim() ?? "";
      fetch("/api/admin/products/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, imageUrl }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText);
          return res.json();
        })
        .then((data: { previewProduct: Product; cardProps: unknown; detailProps: unknown }) => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview({
            previewProduct: data.previewProduct,
            cardProps: data.cardProps as ReturnType<typeof productToCardPropsPayload>,
            detailProps: data.detailProps as ReturnType<typeof productToDetailV2PropsPayload>,
          });
        })
        .catch(() => {
          if (requestId !== previewRequestIdRef.current) return;
          setServerPreview(null);
        });
    }, 400);
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, [form, previewImageObjectUrl]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (form.category === "") return;
      setForm((prev) => ({ ...prev, category: "" }));
      return;
    }
    if (form.destination_id) return;
    if (categoryOptions.includes(form.category)) return;
    setForm((prev) => ({ ...prev, category: "" }));
  }, [categoryOptions, form.category, form.destination_id]);

  useEffect(() => {
    if (form.destination_id && !activeDestinationIds.has(form.destination_id)) {
      setForm((prev) => ({ ...prev, destination_id: "" }));
    }
  }, [activeDestinationIds, form.destination_id]);

  useEffect(() => {
    setSelectedLevel1Id("");
    setSelectedLevel2Id("");
    setSelectedThemeLevel1Id("");
    setSelectedThemeLevel2Id("");
  }, [editingId]);

  const themeSyncRef = useRef(false);
  useEffect(() => {
    if (themeSyncRef.current) return;
    const allowedThemes = new Set(availableThemeOptions);
    const current = form.theme.trim();
    const cleaned = current && allowedThemes.has(current) ? current : "";
    if (cleaned !== current) {
      themeSyncRef.current = true;
      setForm((prev) => ({ ...prev, theme: cleaned }));
      queueMicrotask(() => { themeSyncRef.current = false; });
    }
  }, [availableThemeOptions, form.theme]);

  const campaignsSyncRef = useRef(false);
  useEffect(() => {
    if (campaignsSyncRef.current) return;
    const allowedCampaigns = new Set(activeCampaignOptions.map((i) => i.name));
    const cleaned = parseCampaignsList(form.campaigns).filter((c) => allowedCampaigns.has(c));
    const cleanedSet = new Set(cleaned);
    const currentSet = new Set(parseCampaignsList(form.campaigns));
    if (cleanedSet.size !== currentSet.size || [...currentSet].some((c) => !cleanedSet.has(c))) {
      campaignsSyncRef.current = true;
      const cleanedText = stringifyCampaignsList(cleaned);
      setForm((prev) => ({ ...prev, campaigns: cleanedText }));
      queueMicrotask(() => { campaignsSyncRef.current = false; });
    }
  }, [activeCampaignOptions, form.campaigns]);

  useEffect(() => {
    const validIds = new Set(activeProductLineOptions.map((i) => i.id));
    if (form.product_line_id && !validIds.has(form.product_line_id)) {
      setForm((prev) => ({ ...prev, product_line_id: "" }));
    }
  }, [activeProductLineOptions, form.product_line_id]);

  useEffect(() => {
    if (scheduleDrafts.length === 0) {
      if (activeSchedulePreviewIndex === 0) return;
      setActiveSchedulePreviewIndex(0);
      return;
    }
    if (activeSchedulePreviewIndex < scheduleDrafts.length) return;
    setActiveSchedulePreviewIndex(scheduleDrafts.length - 1);
  }, [scheduleDrafts, activeSchedulePreviewIndex]);

  function updateScheduleDrafts(updater: (current: DayScheduleDraft[]) => DayScheduleDraft[]) {
    setForm((prev) => {
      const current = parseDetailedSchedule(prev.detailed_schedule);
      const next = updater(current);
      return {
        ...prev,
        detailed_schedule: serializeDetailedSchedule(next),
      };
    });
  }

  function addScheduleDay() {
    const nextIndex = scheduleDrafts.length;
    updateScheduleDrafts((current) => [
      ...current,
      {
        label: createNextDayLabel(current),
        content: "",
      },
    ]);
    setActiveSchedulePreviewIndex(nextIndex);
  }

  function appendScheduleTemplate(index: number, templateText: string) {
    updateScheduleDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        const nextContent = draft.content.trim()
          ? `${draft.content.trim()}\n${templateText}`
          : templateText;
        return { ...draft, content: nextContent };
      }),
    );
    setActiveSchedulePreviewIndex(index);
  }

  async function saveTermsTemplates() {
    try {
      setIsTermsTemplatesSaving(true);
      setTermsTemplatesErrorMessage("");
      const response = await fetch("/api/admin/terms-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termsTemplates),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setTermsTemplatesErrorMessage(result.message ?? "약관 템플릿 저장에 실패했습니다.");
        return;
      }
      showToast("success", "약관 템플릿을 저장했습니다.");
    } catch {
      setTermsTemplatesErrorMessage("약관 템플릿 저장 중 오류가 발생했습니다.");
    } finally {
      setIsTermsTemplatesSaving(false);
    }
  }

  function toggleCampaign(name: string) {
    setForm((prev) => {
      const current = parseCampaignsList(prev.campaigns);
      const next = current.includes(name)
        ? current.filter((item) => item !== name)
        : [...current, name];
      return { ...prev, campaigns: stringifyCampaignsList(next) };
    });
  }

  return (
    <div className="space-y-6">
      {isTaxonomyView && (
        <AdminProductTaxonomyView
          activeTab={taxonomyController.activeTab}
          setActiveTab={taxonomyController.setActiveTab}
          taxonomyTabTypes={taxonomyController.taxonomyTabTypes}
          taxonomyItems={taxonomyController.taxonomyItems}
          hasFallbackItems={taxonomyController.hasFallbackItems}
          errorMessage={taxonomyController.errorMessage || null}
          isLoading={taxonomyController.isLoading}
          newNameInput={taxonomyController.newNameInput}
          newSlug={taxonomyController.newSlug}
          newSortOrder={taxonomyController.newSortOrder}
          newParentId={taxonomyController.newParentId}
          pendingCreateType={taxonomyController.pendingCreateType}
          pendingDeleteId={taxonomyController.pendingDeleteId}
          pendingUpdateId={taxonomyController.pendingUpdateId}
          onNameInputChange={taxonomyController.setNewNameInput}
          onSlugChange={taxonomyController.setNewSlug}
          onSortOrderChange={taxonomyController.setNewSortOrder}
          onParentIdChange={taxonomyController.setNewParentId}
          onCreate={taxonomyController.addCustom}
          onDeleteTaxonomy={taxonomyController.handleDeleteTaxonomy}
          onUpdateTaxonomy={taxonomyController.handleUpdateTaxonomy}
        />
      )}

      {isFeaturedView && (
        <div className="space-y-10">
          <AdminProductsCollectionCampaignsManager />
          <AdminHomeCuratedManager />
        </div>
      )}

      {isHomeRegionCardsView && <AdminHomeRegionCardsManager />}

      {isHomeThemeCardsView && <AdminHomeThemeCardsManager />}

      {(isCreateView || editingId) && !isFeaturedView && !isHomeRegionCardsView && !isHomeThemeCardsView ? (
        <AdminProductEditorView>
        <>
        {showShortcutTip ? (
          <div className="mb-2 rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-xs text-[var(--text-primary)]">
            새 기능: ⌘/Ctrl+S 저장 · ⌘/Ctrl+Shift+S 임시저장
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem("editor-shortcut-tip-dismissed", "1");
                } catch {
                  // ignore
                }
                setShowShortcutTip(false);
              }}
              className="ml-2 underline font-medium"
            >
              닫기
            </button>
          </div>
        ) : null}
        <div className="flex items-start gap-4 lg:gap-6">
        {/* 좌측 필드: 섹션 네비 + 액션 바 (sticky, 문서 흐름 내) */}
        <aside
          className="sticky top-24 z-10 flex max-h-[calc(100vh-6rem)] w-[260px] shrink-0 flex-col gap-4 self-start overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm max-md:hidden"
          aria-label="폼 섹션 목차 및 액션"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <ProductFormSectionNav
              sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
              activeSectionId={activeSectionId}
              setActiveSectionId={(id) => setActiveSectionId(id as SectionId)}
              openSection={(id, anchorId) =>
                openSectionAndScrollTo(id as SectionId, anchorId)
              }
              issues={allIssues}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-3" role="group" aria-label="상품 등록 액션">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--primary)]">{editingId ? "상품 수정" : "상품 등록"}</h3>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    markSafeNavigation();
                    try {
                      sessionStorage.removeItem(EDITOR_UI_STATE_KEY(null));
                    } catch {
                      // ignore
                    }
                    setEditingId(null);
                    setForm(initialFormState);
                    resetBaseSnapshot(initialFormState);
                    setActiveSchedulePreviewIndex(0);
                    setShowRawScheduleEditor(false);
                    setScheduleEditorMode("visual");
                    setErrorMessage("");
                  }}
                  className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  수정 취소
                </button>
              ) : null}
            </div>
            <ProductFormActionBar
              sections={SECTIONS.map((s) => ({ id: s.id, title: s.title }))}
              openSections={productFormOpenSections}
              setOpenSections={setProductFormOpenSections}
              issues={allIssues}
              onSave={submit}
              onTempSave={handleSaveDraft}
              onNextIssue={goToNextIssue}
              onPreviewClick={handlePreviewClick}
              hasTempDraft={showDraftBanner && !!draftData}
              isSaving={isSubmitting}
              isSavingDraft={isSavingDraft}
              isEditing={Boolean(editingId)}
              sticky={false}
              isDirty={isDirty}
              autosaveStatus={autosaveStatus}
              lastAutosaveAt={lastSavedAt}
            />
          </div>
        </aside>
        {/* 오른쪽 필드: 입력 아코디언 + 미리보기 */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:gap-6">
          {/* 아코디언 폼 (2열 내용) */}
          <main className="min-w-0">
        <form
          className="space-y-4 rounded-xl bg-[var(--surface-muted)] p-4 ring-1 ring-[var(--border)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
        {showDraftBanner && draftData && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-amber-800 dark:text-amber-200">
              임시 저장본이 있습니다 ({new Date(draftData.savedAt).toLocaleString("ko-KR")})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                복원
              </button>
              <button
                type="button"
                onClick={handleDismissDraft}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                무시
              </button>
            </div>
          </div>
        )}

        <ProductEditorShell
          sectionIssuesBySection={issuesBySection}
          openSections={productFormOpenSections}
          toggleSection={toggleSection}
          openSectionAndScrollTo={openSectionAndScrollTo}
          basicInfoProps={{
            form,
            setForm,
            setTitleExtractPaste,
            setTitleCandidates,
            setShowTitleExtractModal,
            selectedEvent,
            addProductImageToSelectedEvent,
            showToast,
            previewImageFile,
            setPreviewImageFile,
            openCoverRecommendModal,
            setShowImageImportGuideModal,
            formatPriceWithCommas,
          }}
          scheduleProps={{
            form,
            setForm,
            scheduleEditorMode,
            setScheduleEditorMode,
            selectedEvent,
            setSelectedEvent,
            pasteToAddValue,
            setPasteToAddValue,
            getSelectedEventLabel,
            addImagesToEvent,
            showToast,
            previewImageObjectUrl,
            activeSchedulePreviewIndex,
            setActiveSchedulePreviewIndex,
            showRawScheduleEditor,
            setShowRawScheduleEditor,
            scheduleDrafts,
            effectiveDayCount,
            updateScheduleDrafts,
            addScheduleDay,
            appendScheduleTemplate,
          }}
          remainingAccordionProps={{
            form,
            setForm,
            destinationTree,
            destinationPath,
            selectedLevel1Id,
            setSelectedLevel1Id,
            selectedLevel2Id,
            setSelectedLevel2Id,
            themeTree,
            themePath,
            selectedThemeLevel1Id,
            setSelectedThemeLevel1Id,
            selectedThemeLevel2Id,
            setSelectedThemeLevel2Id,
            activeProductLineOptions,
            activeCampaignOptions,
            selectedCampaigns,
            toggleCampaign,
            termsTemplates,
            setTermsTemplates,
            selectedTermsTemplateContent,
            isTermsTemplatesPanelOpen,
            setIsTermsTemplatesPanelOpen,
            saveTermsTemplates,
            isTermsTemplatesLoading,
            isTermsTemplatesSaving,
            termsTemplatesErrorMessage,
          }}
        />

        {diffSummary.changed && (
          <div
            className="rounded-lg border border-[var(--primary)]/30 bg-[var(--primary-soft)]/20 px-4 py-3 text-sm"
            role="region"
            aria-label="저장 시 반영될 변경사항"
          >
            <p className="mb-2 font-semibold text-[var(--text-primary)]">
              저장 시 반영될 변경사항
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-[var(--text-secondary)]">
              {diffSummary.sections.flatMap((s) =>
                s.items.map((item, i) => (
                  <li key={`${s.key}-${i}`}>{item}</li>
                )),
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "상품 등록"}
          </button>
          {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
        </div>
        </form>
          </main>
          {/* 실시간 미리보기 — 2열(폼) 하단에 배치 */}
          <aside
            id="product-form-preview-panel"
            className="block"
            aria-label="실시간 미리보기"
          >
            <div className="sticky top-4 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)] p-4">
              <h3 className="text-lg font-bold text-[var(--primary)]">실시간 미리보기</h3>

              {previewWarnings.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-xs font-semibold text-amber-800">미리보기 품질 경고</p>
                  <ul className="space-y-1">
                    {previewWarnings.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => handleWarningClick(w.sectionId)}
                          className="w-full text-left text-xs text-amber-800 underline-offset-2 hover:underline"
                        >
                          {w.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="rounded-lg border border-[var(--border)] bg-slate-50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                  previewProduct 확인 (JSON)
                </summary>
                <div className="relative">
                  <pre className="max-h-48 overflow-auto p-3 text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(effectivePreviewProduct, null, 2)}
                  </pre>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          JSON.stringify(effectivePreviewProduct, null, 2),
                        );
                        showToast("success", "전체 JSON이 클립보드에 복사되었습니다.");
                      } catch {
                        showToast("error", "클립보드 복사에 실패했습니다.");
                      }
                    }}
                    className="absolute right-2 top-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  >
                    전체 복사
                  </button>
                </div>
              </details>

              <div className="flex gap-2" role="tablist" aria-label="미리보기 뷰">
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "desktop"}
                  onClick={() => setPreviewDevice("desktop")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "desktop"
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={previewDevice === "mobile"}
                  onClick={() => setPreviewDevice("mobile")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    previewDevice === "mobile"
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                  }`}
                >
                  Mobile
                </button>
              </div>

              <section className="block" aria-labelledby="preview-card-heading">
                <h4 id="preview-card-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상품 카드 미리보기
                </h4>
                <div
                  className={`${previewDevice === "mobile" ? "max-w-[360px]" : "max-w-[640px]"} mx-auto`}
                  data-preview-view={previewDevice}
                >
                  <ProductCard {...previewCardProps} />
                </div>
              </section>

              <section className="block" aria-labelledby="preview-detail-heading">
                <h4 id="preview-detail-heading" className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
                  상세 페이지 미리보기
                </h4>
                <label className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={showDetailSticky}
                    onChange={(e) => setShowDetailSticky(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  Sticky CTA 표시
                </label>
                <div
                  className={`rounded-xl border border-[#dbeafe] bg-[#f8fbff] ${previewDevice === "mobile" ? "max-w-[360px]" : ""}`}
                  data-preview-view={previewDevice}
                >
                  <ConsultModalProvider>
                    <ProductQuoteProvider>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="min-w-0 flex-1 space-y-4 p-4">
                          <ProductDetailV2 {...previewDetailProps} />
                        </div>
                        {showDetailSticky && previewDevice !== "mobile" && (
                          <ProductDetailStickyV2Desktop
                            priceFormatted={previewDetailProps.priceFormatted}
                            productId="_preview"
                            productTitle={effectivePreviewProduct.title}
                            sourcePath="/admin/products"
                            kakaoHref="#"
                            status={previewDetailProps.statusTag}
                            trust={undefined}
                          />
                        )}
                      </div>
                      {showDetailSticky && (
                        <ProductDetailStickyV2Mobile
                          priceFormatted={previewDetailProps.priceFormatted}
                          productId="_preview"
                          productTitle={effectivePreviewProduct.title}
                          sourcePath="/admin/products"
                          kakaoHref="#"
                          status={previewDetailProps.statusTag}
                        />
                      )}
                    </ProductQuoteProvider>
                  </ConsultModalProvider>
                </div>
              </section>
            </div>
          </aside>
        </div>
        </div>

          {/* 상품명 추출 모달 */}
          {showTitleExtractModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="title-extract-modal-title"
              onClick={() => setShowTitleExtractModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="title-extract-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  상품명 추출
                </h3>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  원본 페이지에서 상품명/요약(상단 소개)을 복사해 붙여넣으세요.
                </p>
                <textarea
                  value={titleExtractPaste}
                  onChange={(e) => setTitleExtractPaste(e.target.value)}
                  placeholder="텍스트 붙여넣기..."
                  rows={5}
                  className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                />
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runTitleExtract}
                    className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
                  >
                    후보 추출
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTitleExtractModal(false);
                      setTitleExtractPaste("");
                      setTitleCandidates([]);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    닫기
                  </button>
                </div>
                {titleCandidates.length > 0 ? (
                  <ul className="space-y-2">
                    {titleCandidates.map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{c}</span>
                        <button
                          type="button"
                          onClick={() => void applyTitleCandidate(c, false)}
                          className="shrink-0 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]"
                        >
                          상품명에 적용
                        </button>
                        {form.title.trim() ? (
                          <button
                            type="button"
                            onClick={() => void applyTitleCandidate(c, true)}
                            className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                          >
                            합치기
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {/* 대표 이미지 추천 모달 */}
          {showCoverRecommendModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cover-recommend-modal-title"
              onClick={() => setShowCoverRecommendModal(false)}
            >
              <div
                className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="cover-recommend-modal-title" className="mb-3 text-lg font-bold text-[var(--text-primary)]">
                  대표 이미지 추천
                </h3>
                {coverCandidates.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">추천할 이미지가 없습니다. 상품 이미지 또는 일정 이미지를 먼저 등록하세요.</p>
                ) : (
                  <ul className="space-y-3">
                    {coverCandidates.map((c, i) => (
                      <li key={c.url + i} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                          <img
                            src={normalizeProductImageUrl(c.url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[var(--text-muted)]">{c.reason}</p>
                          <button
                            type="button"
                            onClick={() => setCoverAsPrimary(c.url)}
                            className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                          >
                            대표로 지정
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setShowCoverRecommendModal(false)}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

        </>
        </AdminProductEditorView>
      ) : null}

      {isListView && !editingId && !isFeaturedView && !isHomeRegionCardsView && !isHomeThemeCardsView ? (
        <AdminProductListSection
          showToast={showToast}
          confirm={confirm}
          pageSize={pageSize}
          onAfterDelete={(id) => {
            if (editingId === id) {
              markSafeNavigation();
              try {
                sessionStorage.removeItem(EDITOR_UI_STATE_KEY(null));
              } catch {
                // ignore
              }
              setEditingId(null);
              setForm(initialFormState);
              resetBaseSnapshot(initialFormState);
              setActiveSchedulePreviewIndex(0);
              setShowRawScheduleEditor(false);
              setScheduleEditorMode("visual");
              setErrorMessage("");
            }
          }}
          onEditProduct={(product: Product) => {
            setEditingId(product.id);
            const nextForm = deserializeAdminProductToForm(product);
            setForm(nextForm);
            initialFormSnapshotRef.current = structuredClone(nextForm);
            resetBaseSnapshot(nextForm);
            setSelectedLevel1Id("");
            setSelectedLevel2Id("");
            setSelectedThemeLevel1Id("");
            setSelectedThemeLevel2Id("");
            setActiveSchedulePreviewIndex(0);
            setShowRawScheduleEditor(false);
            setErrorMessage("");
            setTimeout(() => {
              try {
                const raw = sessionStorage.getItem(EDITOR_UI_STATE_KEY(product.id));
                if (!raw) return;
                const parsed = JSON.parse(raw) as { activeSectionId?: string };
                if (parsed.activeSectionId) {
                  openSectionAndScrollTo(parsed.activeSectionId as SectionId);
                }
              } catch {
                // ignore
              }
            }, 0);
          }}
          newProductHref={pathname ? `${pathname.replace(/\?.*$/, "")}?view=create` : undefined}
          registerRefresh={(fn) => {
            refreshListRef.current = fn;
          }}
        />
      ) : null}

      <ImageImportGuideModal
        open={showImageImportGuideModal}
        onClose={() => setShowImageImportGuideModal(false)}
      />

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.type === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
