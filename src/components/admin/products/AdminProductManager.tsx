"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, AlertCircle } from "lucide-react";
import { ProductFormSectionIssuesPanel } from "@/components/admin/ProductFormSectionIssuesPanel";
import { AirlineLogo } from "@/components/airlines/AirlineLogo";
import type { Product, ItineraryStructuredDay, ItineraryV2, SelectedEventRef } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { ProductFormState, ProductFormDraft, TermsTemplateType } from "@/types/adminProductForm";
import { createEmptyAdminProductFormState } from "@/components/admin/products/editor/adminProductForm.defaults";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import {
  mapAdminProductFormToPreviewProduct,
  getPreviewWarnings,
  type PreviewWarning,
} from "@/components/admin/products/editor/adminProductPreview.mapper";
import {
  SECTIONS,
  collectAllRequiredIssues,
  collectFormIssues,
} from "@/components/admin/products/editor/adminProductForm.validation";
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
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { MultiImageUploadField } from "@/components/admin/MultiImageUploadField";
import { InteractiveTimelineV2 } from "@/components/products/InteractiveTimelineV2";
import { ScheduleVisualEditorV2 } from "@/components/admin/ScheduleVisualEditorV2";
import { HintDisclosure } from "@/components/admin/common/HintDisclosure";
import { StructuredDaysEditor } from "@/components/admin/itinerary/structured/StructuredDaysEditor";
import { normalizeAirline } from "@/lib/airlines/normalizeAirline";
import { AIRLINE_LOGO_BY_CODE } from "@/lib/airlines/airlineLogos";
import { normalizeImageList } from "@/lib/products/images";
import {
  fetchAdminProduct,
  createAdminProduct,
  updateAdminProduct,
} from "@/components/admin/products/api/adminProducts.client";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { BOOKMARKLET_EXTRACT_IMAGE_URLS } from "@/lib/bookmarkletExtractImageUrls";
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

function normalizeUrlForCompare(url: string): string {
  return url.trim();
}

const TERMS_TEMPLATE_OPTIONS = [
  { value: "overseas_brokerage", label: "해외중개" },
  { value: "domestic_brokerage", label: "국내중개" },
  { value: "overseas_direct", label: "해외직접" },
  { value: "domestic_direct", label: "국내직접" },
] as const;

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
      } catch {
        if (!cancelled) {
          setEditingId(urlEditingId);
          setForm(initialFormState);
          setErrorMessage("상품을 불러오지 못했습니다. 목록에서 다시 시도해 주세요.");
          showLocalToast("error", "상품 조회에 실패했습니다.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlEditingId]);

  const diffSummary = useMemo(() => {
    const initial = editingId
      ? (initialFormSnapshotRef.current ?? initialFormState)
      : initialFormState;
    return getProductDiffSummary(initial, form);
  }, [form, editingId]);

  /** 폼 제출 (액션 바 [저장] 및 form onSubmit에서 공통 호출) */
  const submit = () => void handleSubmit(undefined);

  const submitRequestIdRef = useRef(0);

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    const requiredIssues = collectAllRequiredIssues(form);
    if (requiredIssues.length > 0) {
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
      setEditingId(null);
      setForm(initialFormState);
      setActiveSchedulePreviewIndex(0);
      setShowRawScheduleEditor(false);
      setScheduleEditorMode("visual");
      localStorage.removeItem(getDraftKey(editingId));
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

  const sectionIssuesBySection = useMemo(() => {
    const out: Record<SectionId, SectionIssue[]> = {} as Record<SectionId, SectionIssue[]>;
    for (const section of SECTIONS) {
      out[section.id] = section.getIssues(form);
    }
    return out;
  }, [form, editingId]);

  const completedSectionCount = useMemo(() => {
    return SECTIONS.filter(
      (s) => (sectionIssuesBySection[s.id] ?? []).filter((i) => i.severity === "required").length === 0,
    ).length;
  }, [sectionIssuesBySection]);

  const sectionNavIssueCounts = useMemo(() => {
    const out: Record<string, { required: number; recommended: number }> = {};
    for (const s of SECTIONS) {
      const issues = sectionIssuesBySection[s.id] ?? [];
      out[s.id] = {
        required: issues.filter((i) => i.severity === "required").length,
        recommended: issues.filter((i) => i.severity === "recommended").length,
      };
    }
    return out;
  }, [sectionIssuesBySection]);

  /** 액션 바 진행률/필수 누락용 이슈 목록 (섹션 순서) */
  const formIssuesForBar = useMemo(
    () => SECTIONS.flatMap((s) => sectionIssuesBySection[s.id] ?? []),
    [sectionIssuesBySection],
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
      const key = getDraftKey(editingId);
      const payload: ProductFormDraft = { version: 1, form, savedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(payload));
      showLocalToast("success", "임시저장 완료");
    } catch {
      showLocalToast("error", "임시저장에 실패했습니다.");
    } finally {
      setIsSavingDraft(false);
    }
  }

  function handleRestoreDraft() {
    if (!draftData) return;
    setForm(draftData.form);
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

      {isFeaturedView && <AdminHomeCuratedManager />}

      {isHomeRegionCardsView && <AdminHomeRegionCardsManager />}

      {isHomeThemeCardsView && <AdminHomeThemeCardsManager />}

      {(isCreateView || editingId) && !isFeaturedView && !isHomeRegionCardsView && !isHomeThemeCardsView ? (
        <AdminProductEditorView>
        <>
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
              issues={formIssuesForBar}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] pt-3" role="group" aria-label="상품 등록 액션">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--primary)]">{editingId ? "상품 수정" : "상품 등록"}</h3>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(initialFormState);
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
              issues={formIssuesForBar}
              onSave={submit}
              onTempSave={handleSaveDraft}
              onPreviewClick={handlePreviewClick}
              hasTempDraft={showDraftBanner && !!draftData}
              isSaving={isSubmitting}
              isSavingDraft={isSavingDraft}
              isEditing={Boolean(editingId)}
              sticky={false}
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

        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const id = section.id;
            const issues = sectionIssuesBySection[id] ?? [];
            const requiredCount = issues.filter((i) => i.severity === "required").length;
            const recommendedCount = issues.filter((i) => i.severity === "recommended").length;
            const badgeLabel =
              requiredCount === 0 && recommendedCount === 0
                ? "완료"
                : requiredCount > 0
                  ? `필수 ${requiredCount}개`
                  : `권장 ${recommendedCount}개`;
            const badgeVariant =
              requiredCount > 0 ? "required" : recommendedCount > 0 ? "recommended" : "complete";
            return (
            <div
              key={id}
              id={`form-section-${id}`}
              className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] ring-1 ring-[var(--border)]"
            >
              <button
                type="button"
                onClick={() => toggleSection(id as SectionId)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                <span className="flex items-center gap-2">
                  {requiredCount > 0 ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" aria-hidden />
                  ) : null}
                  {section.title}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      badgeVariant === "complete"
                        ? "bg-[var(--success)]/20 text-[var(--success)]"
                        : badgeVariant === "required"
                          ? "bg-[var(--danger)]/20 text-[var(--danger)]"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {badgeLabel}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 transition ${productFormOpenSections[id] ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              <div
                className={productFormOpenSections[id] ? "block" : "hidden"}
                aria-hidden={!productFormOpenSections[id]}
              >
                <div className="border-t border-[var(--divider)] p-4">
                  {issues.length > 0 ? (
                    <ProductFormSectionIssuesPanel
                      sectionId={id}
                      sectionIssues={issues}
                      onIssueClick={(anchorId) =>
                        openSectionAndScrollTo(id as SectionId, anchorId ?? undefined)
                      }
                    />
                  ) : null}
                  {id === "basic" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            placeholder="상품명"
            id="field-product-name"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <button
            type="button"
            onClick={() => {
              setTitleExtractPaste("");
              setTitleCandidates([]);
              setShowTitleExtractModal(true);
            }}
            className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
          >
            상품명 추출
          </button>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">한 줄 소개 (상세 상단 요약)</label>
            <input
              value={form.one_liner}
              onChange={(event) => setForm((prev) => ({ ...prev, one_liner: event.target.value }))}
              placeholder="비우면 상품 설명 첫 줄 사용"
              id="form-field-basic-one_liner"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
            <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-xs font-semibold text-[var(--text-primary)]">여행 오버뷰 카드 (숙소·지역·기간)</p>
              <p className="text-xs text-[var(--text-muted)]">
                상세 페이지 첫 화면에 표시되는 카드 값입니다. 비우면 기존 자동 추출(meta_info, theme, duration)을 사용합니다.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">숙소</label>
                  <input
                    value={form.overview_accommodation}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_accommodation: e.target.value }))
                    }
                    placeholder="예: 상담 시 안내, 전일정4성"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">지역</label>
                  <input
                    value={form.overview_region}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_region: e.target.value }))
                    }
                    placeholder="예: 호주, 동남아"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <label className="block text-xs font-medium text-[var(--text-secondary)]">기간</label>
                  <input
                    value={form.overview_duration}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, overview_duration: e.target.value }))
                    }
                    placeholder="예: 6일, 3박4일"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
              </div>
            </div>
          <div className="space-y-2 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">일정 테마 구성비 (상세 오버뷰 차트)</p>
            <p className="text-xs text-[var(--text-muted)]">
              2개 이상 입력 시 상세 페이지에 도넛 차트로 표시됩니다. 미입력 시 카테고리·테마 기반으로 자동 생성됩니다.
            </p>
            <div className="space-y-2">
              {form.theme_chart_json.map((item, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2"
                >
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="항목명 (예: 자연)"
                    className="flex-1 min-w-[80px] rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.percent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setForm((prev) => ({
                          ...prev,
                          theme_chart_json: prev.theme_chart_json.map((x, i) =>
                            i === idx ? { ...x, percent: Math.max(0, Math.min(100, v)) } : x,
                          ),
                        }));
                    }}
                    placeholder="%"
                    className="w-16 rounded border border-[var(--border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--primary)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        theme_chart_json: prev.theme_chart_json.filter((_, i) => i !== idx),
                      }))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    theme_chart_json: [...prev.theme_chart_json, { label: "", percent: 0 }],
                  }))
                }
                className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                + 항목 추가
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">상품 상태 (카드/상세 태그)</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "AVAILABLE", label: "예약 가능" },
                { value: "LIMITED", label: "잔여 한정" },
                { value: "SOLD_OUT", label: "마감" },
                { value: "CONSULT_REQUIRED", label: "상담 후 안내" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, status: opt.value as ProductFormState["status"] }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.status === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2" id="field-product-cover-image" tabIndex={0}>
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">대표 이미지</p>
              {form.image_url?.trim() || form.images_json.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded border-2 border-[var(--primary)] bg-[var(--surface-muted)]">
                    <img
                      src={normalizeProductImageUrl(form.image_url?.trim() || form.images_json[0] || "")}
                      alt="대표"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-primary)]">
                      현재 대표: {form.image_url?.trim() ? "지정됨" : "첫 번째 이미지"}
                    </p>
                    <button
                      type="button"
                      onClick={openCoverRecommendModal}
                      className="mt-1 rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                    >
                      대표 이미지 추천 보기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">대표 이미지 미지정</span>
                  <button
                    type="button"
                    onClick={openCoverRecommendModal}
                    className="rounded border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
                  >
                    대표 이미지 추천 보기
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품 이미지 (여러 장)</p>
            <MultiImageUploadField
              value={form.images_json}
              primaryImageUrl={form.image_url?.trim() || form.images_json[0] || undefined}
              onChange={(urls) =>
                setForm((prev) => ({
                  ...prev,
                  images_json: urls,
                  image_url: prev.image_url?.trim() || (urls[0] ?? ""),
                }))
              }
              selectedEvent={selectedEvent}
              onAddToEvent={(url) => {
                const added = addProductImageToSelectedEvent(url);
                if (added) showToast("success", "이벤트에 이미지 추가됨");
                else if (selectedEvent) showToast("warning", "이미 해당 이벤트에 등록된 이미지입니다.");
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)]">
                미리보기용 이미지 파일 선택
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPreviewImageFile(file ?? null);
                  }}
                />
              </label>
              {previewImageFile && (
                <span className="text-xs text-[var(--text-secondary)]">
                  {previewImageFile.name}
                  <button
                    type="button"
                    onClick={() => setPreviewImageFile(null)}
                    className="ml-1 text-[var(--danger)] hover:underline"
                  >
                    해제
                  </button>
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold text-[var(--success)]">관리자 전용 | 상품 원본주소</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={form.product_source_url}
                onChange={(event) => setForm((prev) => ({ ...prev, product_source_url: event.target.value }))}
                placeholder="상품 원본주소 (관리자 확인용 URL)"
                className="min-w-0 flex-1 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)]/40 px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(BOOKMARKLET_EXTRACT_IMAGE_URLS);
                    showToast("success", "북마클릿이 복사되었습니다. 사용법은 [!] 버튼을 참고하세요.");
                  } catch {
                    showToast("error", "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
                  }
                }}
                className="shrink-0 rounded-lg border border-[var(--primary)]/50 bg-[var(--primary-soft)] px-3 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary-soft)]/80"
              >
                이미지 추출 도구
              </button>
              <button
                type="button"
                onClick={() => setShowImageImportGuideModal(true)}
                className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                title="이미지 자동 등록 사용법"
              >
                [!]
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              1) 버튼 눌러 북마클릿 복사 → 2) 브라우저 북마크 URL에 붙여넣기 → 3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨 → 4) 아래 상품 이미지 또는 이벤트 이미지 입력란에 붙여넣기
            </p>
          </div>
                  </div>
                  )}
                  {id === "taxonomy" && (
        <div className="flex flex-col gap-6" id="form-field-taxonomy-category">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">지역 (destination)</p>
            <p className="text-[11px] text-[var(--text-muted)]">상품에 연결할 지역 1개. 대분류 → 중분류 → 소분류 순으로 선택합니다. DB taxonomy 축으로 저장됩니다.</p>
            <div className="space-y-4">
              {destinationTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  지역을 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  {/* 대분류 */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                          setSelectedLevel1Id("");
                          setSelectedLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.destination_id && !selectedLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {destinationTree.map((node) => {
                        const selected = (destinationPath[0]?.id === node.id) || (!form.destination_id && selectedLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedLevel1Id(node.id);
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                              } else {
                                setSelectedLevel1Id("");
                                setSelectedLevel2Id("");
                                setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.destination_id
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : destinationPath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 중분류 (대분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (destinationPath[1]?.id === node.id) || (!form.destination_id && selectedLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, destination_id: "", category: "" }));
                                  } else {
                                    setSelectedLevel1Id("");
                                    setSelectedLevel2Id("");
                                    setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.destination_id
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : destinationPath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {/* 소분류 (중분류 선택 시에만) */}
                  {(() => {
                    const level1Node = destinationPath[0] ?? destinationTree.find((n) => n.id === selectedLevel1Id);
                    const level2Node = destinationPath[1] ?? (level1Node?.children?.find((n) => n.id === selectedLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.destination_id === node.id;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedLevel1Id("");
                                  setSelectedLevel2Id("");
                                  setForm((prev) => ({ ...prev, destination_id: node.id, category: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2" id="form-field-taxonomy-theme">
            <p className="text-xs font-semibold text-[var(--text-primary)]">테마</p>
            <p className="text-[11px] text-[var(--text-muted)]">대분류 → 중분류 순으로 선택합니다. 1개 선택.</p>
            <div className="space-y-4">
              {themeTree.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  테마를 먼저 추가해 주세요 (카테고리/테마 관리에서 추가)
                </span>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">대분류</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, theme: "" }));
                          setSelectedThemeLevel1Id("");
                          setSelectedThemeLevel2Id("");
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          !form.theme.trim() && !selectedThemeLevel1Id
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        미선택
                      </button>
                      {themeTree.map((node) => {
                        const selected = (themePath[0]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel1Id === node.id);
                        const hasChildren = node.children && node.children.length > 0;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => {
                              if (hasChildren) {
                                setSelectedThemeLevel1Id(node.id);
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: "" }));
                              } else {
                                setSelectedThemeLevel1Id("");
                                setSelectedThemeLevel2Id("");
                                setForm((prev) => ({ ...prev, theme: node.name }));
                              }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              selected && !form.theme.trim()
                                ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                : themePath[0]?.id === node.id
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                            }`}
                          >
                            {node.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const showMid = level1Node && (level1Node.children?.length ?? 0) > 0;
                    if (!showMid) return null;
                    const midChildren = level1Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">중분류</span>
                        <div className="flex flex-wrap gap-2">
                          {midChildren.map((node) => {
                            const selected = (themePath[1]?.id === node.id) || (!form.theme.trim() && selectedThemeLevel2Id === node.id);
                            const hasChildren = node.children && node.children.length > 0;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  if (hasChildren) {
                                    setSelectedThemeLevel2Id(node.id);
                                    setForm((prev) => ({ ...prev, theme: "" }));
                                  } else {
                                    setSelectedThemeLevel1Id("");
                                    setSelectedThemeLevel2Id("");
                                    setForm((prev) => ({ ...prev, theme: node.name }));
                                  }
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected && !form.theme.trim()
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : themePath[1]?.id === node.id
                                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const level1Node = themePath[0] ?? themeTree.find((n) => n.id === selectedThemeLevel1Id);
                    const level2Node = themePath[1] ?? (level1Node?.children?.find((n) => n.id === selectedThemeLevel2Id));
                    const showSmall = level2Node && (level2Node.children?.length ?? 0) > 0;
                    if (!showSmall) return null;
                    const smallChildren = level2Node.children ?? [];
                    return (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">소분류</span>
                        <div className="flex flex-wrap gap-2">
                          {smallChildren.map((node) => {
                            const selected = form.theme.trim() === node.name;
                            return (
                              <button
                                key={node.id}
                                type="button"
                                onClick={() => {
                                  setSelectedThemeLevel1Id("");
                                  setSelectedThemeLevel2Id("");
                                  setForm((prev) => ({ ...prev, theme: node.name }));
                                }}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                  selected
                                    ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                                    : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                                }`}
                              >
                                {node.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-[var(--text-muted)]">선택된 테마: {form.theme.trim() || "-"}</p>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">상품군</p>
            <div className="flex flex-wrap gap-2">
              {activeProductLineOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  상품군을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, product_line_id: "" }))}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      !form.product_line_id
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    미선택
                  </button>
                  {activeProductLineOptions.map((item) => {
                    const selected = form.product_line_id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, product_line_id: item.id }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          selected
                            ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                            : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">기획/추천</p>
            <div className="flex flex-wrap gap-2">
              {activeCampaignOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-muted)] ring-1 ring-slate-200">
                  기획 항목을 먼저 추가해 주세요 (지역·테마 관리)
                </span>
              ) : (
                activeCampaignOptions.map((item) => {
                  const selected = selectedCampaigns.includes(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCampaign(item.name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">선택된 기획/추천: {selectedCampaigns.join(", ") || "-"}</p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
            <p className="text-xs font-medium text-blue-900">여행 오버뷰 품질 가이드</p>
            <p className="mt-0.5 text-xs text-blue-800">
              지역·테마는 상세 첫 화면의 여행 오버뷰 &quot;지역&quot; 카드에 반영됩니다. 대표 이미지는 오버뷰 커버로 사용됩니다.
            </p>
          </div>
        </div>
                  )}
                  {id === "price" && (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <input
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: formatPriceWithCommas(event.target.value) }))
            }
            placeholder="가격(숫자)"
            id="field-price-main"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            placeholder="일정(예: 5일)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <p className="text-xs text-[var(--text-muted)] md:col-span-2">일정 값은 여행 오버뷰 &quot;기간&quot; 카드에 반영됩니다.</p>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">가격 기준 문구</label>
            <input
              value={form.price_meta}
              onChange={(event) => setForm((prev) => ({ ...prev, price_meta: event.target.value }))}
              placeholder="예: 1인 기준 (비우면 기본값 1인 기준)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">유류할증료 문구</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "", label: "표시 안 함" },
                { value: "true", label: "유류할증료 포함" },
                { value: "false", label: "유류할증료 별도" },
              ].map((opt) => (
                <button
                  key={opt.value || "none"}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, fuel_included: opt.value as "" | "true" | "false" }))
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    form.fuel_included === opt.value
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">카드 메타 문구 (일정·지역 옆 표시)</label>
            <input
              value={form.meta_info}
              onChange={(event) => setForm((prev) => ({ ...prev, meta_info: event.target.value }))}
              placeholder="예: 항공 포함"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              이 값은 상세 첫 화면 여행 오버뷰의 &quot;숙소&quot;·&quot;기타&quot; 카드에 반영될 수 있습니다. (예: 전일정4성, 호텔 등)
            </p>
          </div>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">상품 옵션 (기간·룸 등 선택 시 견적)</p>
            <HintDisclosure
              id="price.optionsJsonGuide"
              summary="가격 옵션 JSON 형식 보기"
            >
              {`JSON 형식. 비우면 옵션 미사용.
필수 필드: basePrice, currency, groups 배열.
선택: requiredGroups (필수 선택 그룹 키 배열).

예시:
{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}`}
            </HintDisclosure>
            <textarea
              value={form.options_json}
              onChange={(event) => setForm((prev) => ({ ...prev, options_json: event.target.value }))}
              rows={8}
              placeholder='{"basePrice": 1000000, "currency": "KRW", "requiredGroups": ["period"], "groups": [{"key": "period", "title": "기간", "type": "radio", "items": [{"value": "3n4d", "label": "3박4일", "priceDelta": 0, "isDefault": true}, {"value": "4n5d", "label": "4박5일", "priceDelta": 200000}]}]}'
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
                  </div>
                  )}
                  {id === "description" && (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명 (필요 시 직접 작성. 모두투어 import는 자동 반영하지 않습니다.)"
            id="field-product-description"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.point_benefits}
            onChange={(event) => setForm((prev) => ({ ...prev, point_benefits: event.target.value }))}
            rows={3}
            placeholder="상품 포인트 - 혜택 (줄바꿈 가능)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/80 p-3 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">상품 포인트 O/X 선택</p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              {[
                { key: "travel_insurance", label: "상품 포인트 - 여행자보험" },
                { key: "meeting_info", label: "상품 포인트 - 미팅 정보" },
                { key: "point_tourism", label: "상품 포인트 - 관광" },
                { key: "point_guide", label: "상품 포인트 - 인솔자" },
              ].map((field) => {
                const fieldKey = field.key as
                  | "travel_insurance"
                  | "meeting_info"
                  | "point_tourism"
                  | "point_guide";
                const value = form[fieldKey];
                return (
                  <div key={field.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">{field.label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "O" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "O"
                            ? "bg-emerald-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        O
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "X" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "X"
                            ? "bg-rose-600 text-white"
                            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                        }`}
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
                  </div>
                  )}
                  {id === "included" && (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <textarea
            value={form.included_items}
            onChange={(event) => setForm((prev) => ({ ...prev, included_items: event.target.value }))}
            rows={3}
            placeholder="포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-included"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <textarea
            value={form.excluded_items}
            onChange={(event) => setForm((prev) => ({ ...prev, excluded_items: event.target.value }))}
            rows={3}
            placeholder="불포함 사항 (자동 추출하지 않습니다. 필요 시 직접 입력해 주세요.)"
            id="field-excluded"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start md:col-span-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">선택관광 목록 (줄바꿈 가능)</label>
              <textarea
                value={form.optional_tours}
                onChange={(event) => setForm((prev) => ({ ...prev, optional_tours: event.target.value }))}
                rows={4}
                placeholder="선택관광 목록 (줄바꿈 가능)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">출발인원 (~명 이상)</label>
              <input
                type="text"
                value={form.min_departure_people}
                onChange={(event) => setForm((prev) => ({ ...prev, min_departure_people: event.target.value }))}
                placeholder="예: 10"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            </div>
          </div>
                  </div>
                  )}
                  {id === "flight" && (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">항공편 정보</p>
            <p className="text-xs text-[var(--text-secondary)]">
              출발/도착 공항·편명은 상세 첫 화면 여행 오버뷰의 &quot;항공&quot; 카드에 자동 반영됩니다.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              현재는 라이선스 문제로 실제 항공사 로고 이미지는 사용하지 않고, 아이콘 + 텍스트만 표시됩니다. 추후
              라이선스 획득 시 이 프리뷰 영역과 상세페이지에 로고가 자동 업데이트됩니다.
            </p>
            <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">출발 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.departure_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 09:40)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.departure_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 11:20)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.departure_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, departure_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-departure_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.departure_flight_name} size={32} />
                  </div>
                  <input
                    value={form.departure_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">도착 항공편</p>
                <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-2">
                  <input
                    value={form.arrival_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 인천 ICN)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 12:30)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  <input
                    value={form.arrival_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 14:10)"
                    className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <input
                      value={form.arrival_flight_name}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, arrival_flight_name: event.target.value }))
                      }
                      placeholder="항공편명 (예: 아시아나항공, 티웨이항공 TW501)"
                      id="form-field-flight-arrival_flight_name"
                      className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <AirlineLogo airlineText={form.arrival_flight_name} size={32} />
                  </div>
                  <input
                    value={form.arrival_baggage_limit}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_baggage_limit: event.target.value }))
                    }
                    placeholder="수하물 한도 (예: 23 또는 23KG)"
                    className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                  />
                  {/* 현재는 항상 Plane + 텍스트만 표시 (로고 비활성화) */}
                </div>
              </div>
            </div>
          </div>
                  </div>
                  )}
                  {id === "schedule" && (
        <div className="space-y-3" id="field-schedule-root" tabIndex={-1}>
          {selectedEvent && getSelectedEventLabel() && (
            <div className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)]/40 px-3 py-2">
              <p className="text-sm font-semibold text-[var(--primary)]">
                현재 이미지 추가 대상: {getSelectedEventLabel()}
              </p>
            </div>
          )}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
            <HintDisclosure
              id="schedule.pasteToAddGuide"
              summary="URL을 줄바꿈으로 붙여넣으면 이미지가 추가됩니다."
            >
              {`1) 상단 이미지 자동 등록 [!] 버튼으로 북마클릿 복사
2) 브라우저 북마크 URL에 붙여넣기
3) 모두투어 등 원본 페이지에서 북마클릿 실행 → URL 복사됨
4) 아래 입력란에 URL을 붙여넣기 (줄바꿈 또는 쉼표 구분)

※ 먼저 아래 일정에서 "이 이벤트에 추가 대상"을 선택한 뒤, "선택 이벤트에 추가"를 누르세요.`}
            </HintDisclosure>
            <p className="mb-2 mt-2 text-xs font-semibold text-[var(--text-secondary)]">붙여넣기로 이미지 추가 (Paste-to-Add)</p>
            <textarea
              value={pasteToAddValue}
              onChange={(e) => setPasteToAddValue(e.target.value)}
              placeholder="북마클릿으로 복사한 URL을 여기에 붙여넣으세요 (줄바꿈·쉼표 구분)"
              rows={3}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={selectedEvent == null}
                onClick={() => {
                  if (selectedEvent == null) return;
                  const count = addImagesToEvent(selectedEvent, [pasteToAddValue]);
                  setPasteToAddValue("");
                  if (count > 0) showToast("success", `선택 이벤트에 ${count}개 이미지 추가됨`);
                  else showToast("warning", "추가할 수 있는 URL이 없습니다. (중복 또는 비허용 URL)");
                }}
                className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 이벤트에 추가
              </button>
              {selectedEvent == null && (
                <span className="text-xs text-[var(--text-muted)]">
                  먼저 아래 일정에서 &quot;이 이벤트에 추가 대상&quot;을 선택하세요.
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--divider)] pb-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">일정 입력 방식</span>
            <div className="flex rounded-lg border border-[var(--border)] bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setScheduleEditorMode("visual")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "visual"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                시각화 일정(권장)
              </button>
              <button
                type="button"
                onClick={() => setScheduleEditorMode("legacy")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  scheduleEditorMode === "legacy"
                    ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-slate-900"
                }`}
              >
                레거시 텍스트(기존)
              </button>
            </div>
          </div>

          {scheduleEditorMode === "visual" ? (
            <ScheduleVisualEditorV2
              form={form}
              setForm={setForm}
              previewProductImageUrl={previewImageObjectUrl ?? form.images_json[0] ?? form.image_url ?? ""}
              activeDayIndex={activeSchedulePreviewIndex}
              setActiveDayIndex={setActiveSchedulePreviewIndex}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
            />
          ) : (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--primary)]">상세일정 작성 도우미</p>
                <p className="text-xs text-[var(--text-muted)]">일차별로 작성하면 자동으로 탭 형식으로 저장됩니다.</p>
                <p className="mt-0.5 text-xs text-blue-700">이 일정은 상세 첫 화면의 여행 오버뷰 타임라인에도 자동 반영됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addScheduleDay}
                  className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)]"
                >
                  + 일차 추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawScheduleEditor((prev) => !prev)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  {showRawScheduleEditor ? "원문 편집 숨기기" : "원문 직접 편집"}
                </button>
              </div>
            </div>

            {!showRawScheduleEditor ? (
              <StructuredDaysEditor
                days={form.itinerary_days_json}
                onDaysChange={(updater) =>
                  setForm((prev) => ({ ...prev, itinerary_days_json: updater(prev.itinerary_days_json) }))
                }
                onDayFocus={setActiveSchedulePreviewIndex}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
              />
            ) : (
            <>
            {scheduleDrafts.length === 0 ? (
              <button
                type="button"
                onClick={addScheduleDay}
                className="w-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-6 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                일차를 추가하고 상세일정을 입력해 주세요
              </button>
            ) : (
              <div className="space-y-3">
                {scheduleDrafts.map((item, index) => (
                  <article key={`${item.label}-${index}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        value={item.label}
                        onFocus={() => setActiveSchedulePreviewIndex(index)}
                        onChange={(event) =>
                          updateScheduleDrafts((current) =>
                            current.map((draft, draftIndex) =>
                              draftIndex === index ? { ...draft, label: event.target.value } : draft,
                            ),
                          )
                        }
                        placeholder="예: 1일차"
                        className="w-28 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                      <div className="ml-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index <= 0) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index - 1];
                              next[index - 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          위로
                        </button>
                        <button
                          type="button"
                          disabled={index >= scheduleDrafts.length - 1}
                          onClick={() =>
                            updateScheduleDrafts((current) => {
                              if (index >= current.length - 1) return current;
                              const next = [...current];
                              const target = next[index];
                              next[index] = next[index + 1];
                              next[index + 1] = target;
                              return next;
                            })
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-primary)] disabled:opacity-40"
                        >
                          아래로
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateScheduleDrafts((current) =>
                              current.filter((_, draftIndex) => draftIndex !== index),
                            );
                            setActiveSchedulePreviewIndex((prev) =>
                              prev > index ? prev - 1 : Math.max(0, Math.min(prev, scheduleDrafts.length - 2)),
                            );
                          }}
                          className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={item.content}
                      onFocus={() => setActiveSchedulePreviewIndex(index)}
                      onChange={(event) =>
                        updateScheduleDrafts((current) =>
                          current.map((draft, draftIndex) =>
                            draftIndex === index ? { ...draft, content: event.target.value } : draft,
                          ),
                        )
                      }
                      rows={5}
                      placeholder="해당 일차의 일정을 입력해 주세요."
                      className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        { label: "TEE OFF", text: "▷TEE OFF TIME: " },
                        { label: "식사", text: "▷식사: " },
                        { label: "이동", text: "▷이동: " },
                        { label: "호텔", text: "▷숙소: " },
                      ].map((template) => (
                        <button
                          key={template.label}
                          type="button"
                          onClick={() => appendScheduleTemplate(index, template.text)}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          + {template.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            </>
            )}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--surface)] p-4">
                <p className="mb-2 text-xs font-semibold text-blue-700">실시간 미리보기</p>
                <div className="mb-2 inline-flex items-center rounded-full bg-[var(--primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
                  {form.itinerary_days_json.length > 0
                    ? form.itinerary_days_json[activeSchedulePreviewIndex]?.title || `Day ${(form.itinerary_days_json[activeSchedulePreviewIndex]?.day ?? activeSchedulePreviewIndex + 1)}`
                    : scheduleDrafts[activeSchedulePreviewIndex]?.label || `${activeSchedulePreviewIndex + 1}일차`}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-[var(--text-primary)]">
                  {form.itinerary_days_json.length > 0
                    ? (form.itinerary_days_json[activeSchedulePreviewIndex]?.events ?? [])
                        .map((e) => (e.description ? `${e.heading}: ${e.description}` : e.heading))
                        .join("\n") || "입력한 일정이 여기에 표시됩니다."
                    : scheduleDrafts[activeSchedulePreviewIndex]?.content || "입력한 일정이 여기에 표시됩니다."}
                </p>
              </div>
            ) : null}

            {effectiveDayCount > 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">Day별 대표 이미지 (선택)</p>
                <p className="mb-3 text-xs text-[var(--text-muted)]">
                  일차별로 업로드하거나 URL을 넣으면 상세 일정 타임라인에 표시됩니다. 비우면 상품 대표 이미지로 대체됩니다.
                </p>
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                  {Array.from({ length: effectiveDayCount }, (_, i) => i + 1).map((dayNum) => {
                    const dayKey = String(dayNum);
                    const url = form.itinerary_media_json[dayKey] ?? "";
                    return (
                      <div key={dayKey} className="space-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Day {dayNum}</p>
                        <ImageUploadField
                          value={url}
                          onChange={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          onUploaded={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              itinerary_media_json: { ...prev.itinerary_media_json, [dayKey]: v },
                            }))
                          }
                          uploadedUrlKey="card"
                          optional
                          placeholder="Day 이미지 URL 또는 업로드"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {showRawScheduleEditor ? (
              <textarea
                value={form.detailed_schedule}
                onChange={(event) => setForm((prev) => ({ ...prev, detailed_schedule: event.target.value }))}
                rows={8}
                placeholder={"원문 직접 편집\n예시:\n[1일차]\n인천 출발 / 하노이 도착\n...\n\n[2일차]\n하노이 시내관광\n..."}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
              />
            ) : null}
          </div>
        </div>
          )}
        </div>
                  )}
                  {id === "terms" && (
        <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--primary-soft)] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[var(--primary)]">약관 및 참조사항 템플릿 적용</p>
            <select
              value={form.terms_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  terms_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            >
              <option value="">직접 입력 (템플릿 미사용)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.terms_template_type ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="mb-2 text-xs font-semibold text-[var(--text-primary)]">선택 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-[var(--text-secondary)]">
                  {selectedTermsTemplateContent.trim() || "템플릿 내용이 비어 있습니다. 아래에서 수정해 주세요."}
                </p>
              </div>
            ) : null}
            <textarea
              value={form.terms_and_notes}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_and_notes: event.target.value }))}
              rows={4}
              placeholder="예약 조건·환불·취소 규정 등 (운영자가 직접 확인 후 입력해 주세요. 모두투어 import는 자동 반영하지 않습니다.)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/90 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">약관 템플릿 관리 (공통)</p>
              <button
                type="button"
                onClick={() => setIsTermsTemplatesPanelOpen((prev) => !prev)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
              >
                {isTermsTemplatesPanelOpen ? "접기" : "펼치기"}
              </button>
            </div>
            {!isTermsTemplatesPanelOpen ? (
              <p className="text-xs text-[var(--text-muted)]">
                안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveTermsTemplates}
                    disabled={isTermsTemplatesLoading || isTermsTemplatesSaving}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    {isTermsTemplatesSaving ? "저장 중..." : "템플릿 저장"}
                  </button>
                </div>
                {termsTemplatesErrorMessage ? (
                  <p className="text-xs text-rose-600">{termsTemplatesErrorMessage}</p>
                ) : null}
                <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-3">
                  {TERMS_TEMPLATE_OPTIONS.map((item) => (
                    <div key={item.value} className="space-y-1 rounded-lg border border-[var(--border)] bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{item.label}</p>
                      <textarea
                        value={termsTemplates[item.value]}
                        onChange={(event) =>
                          setTermsTemplates((prev) => ({
                            ...prev,
                            [item.value]: event.target.value,
                          }))
                        }
                        rows={5}
                        placeholder={`${item.label} 약관 템플릿을 입력하세요.`}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <input
            value={form.meta_title}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_title: event.target.value }))}
            placeholder="SEO 메타 타이틀 (선택). 스페이스로 구분한 키워드는 상품 상세페이지에 해시태그(#키워드)로 노출됩니다. 예: 태국 파크골프 치앙마이"
            id="field-seo-title"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <textarea
            value={form.meta_description}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_description: event.target.value }))}
            rows={3}
            placeholder="SEO 메타 설명 (선택, 예시: 타깃층 문제해결 + 차별화된 혜택/신뢰 요소 + CTA포함)"
            id="field-seo-desc"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                          className="h-4 w-4 accent-[var(--primary)]"
            />
            상품 노출 활성화
          </label>
        </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

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
              setEditingId(null);
              setForm(initialFormState);
              setActiveSchedulePreviewIndex(0);
              setShowRawScheduleEditor(false);
              setScheduleEditorMode("visual");
              setErrorMessage("");
            }
          }}
          onEditProduct={(product: Product) => {
            setEditingId(product.id);
            setForm(deserializeAdminProductToForm(product));
            setSelectedLevel1Id("");
            setSelectedLevel2Id("");
            setSelectedThemeLevel1Id("");
            setSelectedThemeLevel2Id("");
            setActiveSchedulePreviewIndex(0);
            setShowRawScheduleEditor(false);
            setErrorMessage("");
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
