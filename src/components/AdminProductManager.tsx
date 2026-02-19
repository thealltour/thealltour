"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";

type ProductFormState = {
  title: string;
  description: string;
  product_source_url: string;
  point_benefits: string;
  point_tourism: "O" | "X";
  point_guide: "O" | "X";
  meeting_info: "O" | "X";
  travel_insurance: "O" | "X";
  included_items: string;
  excluded_items: string;
  departure_from_airport: string;
  departure_from_date: string;
  departure_from_time: string;
  departure_to_airport: string;
  departure_to_date: string;
  departure_to_time: string;
  departure_flight_name: string;
  arrival_from_airport: string;
  arrival_from_date: string;
  arrival_from_time: string;
  arrival_to_airport: string;
  arrival_to_date: string;
  arrival_to_time: string;
  arrival_flight_name: string;
  detailed_schedule: string;
  optional_tours: string;
  terms_template_type: "" | TermsTemplateType;
  terms_and_notes: string;
  meta_title: string;
  meta_description: string;
  image_url: string;
  category: string;
  theme: string;
  price: string;
  duration: string;
  itinerary: string;
  inclusions: string;
  is_active: boolean;
  is_featured_home: boolean;
  sort_order: string;
};

type ToastState = {
  type: "success" | "error";
  text: string;
} | null;

const FEATURED_PRODUCT_LIMIT = 8;

const TERMS_TEMPLATE_OPTIONS = [
  { value: "overseas_brokerage", label: "해외중개" },
  { value: "domestic_brokerage", label: "국내중개" },
  { value: "overseas_direct", label: "해외직접" },
  { value: "domestic_direct", label: "국내직접" },
] as const;

type TermsTemplateType = (typeof TERMS_TEMPLATE_OPTIONS)[number]["value"];
type TermsTemplateMap = Record<TermsTemplateType, string>;

function createEmptyTermsTemplateMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

const initialFormState: ProductFormState = {
  title: "",
  description: "",
  product_source_url: "",
  point_benefits: "",
  point_tourism: "X",
  point_guide: "X",
  meeting_info: "X",
  travel_insurance: "X",
  included_items: "",
  excluded_items: "",
  departure_from_airport: "",
  departure_from_date: "",
  departure_from_time: "",
  departure_to_airport: "",
  departure_to_date: "",
  departure_to_time: "",
  departure_flight_name: "",
  arrival_from_airport: "",
  arrival_from_date: "",
  arrival_from_time: "",
  arrival_to_airport: "",
  arrival_to_date: "",
  arrival_to_time: "",
  arrival_flight_name: "",
  detailed_schedule: "",
  optional_tours: "",
  terms_template_type: "",
  terms_and_notes: "",
  meta_title: "",
  meta_description: "",
  image_url: "",
  category: "여행상품",
  theme: "",
  price: "",
  duration: "",
  itinerary: "",
  inclusions: "",
  is_active: true,
  is_featured_home: false,
  sort_order: "",
};

function normalizeOXValue(value?: string | null): "O" | "X" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "X";
  if (["o", "y", "yes", "예", "가능", "제공", "포함", "있음", "있다"].includes(normalized)) return "O";
  if (["x", "n", "no", "아니오", "불가", "미제공", "불포함", "없음", "없다"].includes(normalized)) return "X";
  if (normalized.includes("없") || normalized.includes("불가") || normalized.includes("미")) return "X";
  return "O";
}

function formatPriceWithCommas(raw: string) {
  const digitsOnly = raw.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

type DayScheduleDraft = {
  label: string;
  content: string;
};

function parseDetailedSchedule(value: string): DayScheduleDraft[] {
  const source = value.trim();
  if (!source) return [];

  const lines = source.split(/\r?\n/);
  const drafts: DayScheduleDraft[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        drafts.push({
          label: currentLabel,
          content: currentContent.join("\n").trim(),
        });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }

  if (currentLabel) {
    drafts.push({
      label: currentLabel,
      content: currentContent.join("\n").trim(),
    });
  }

  if (drafts.length === 0) {
    return [{ label: "1일차", content: source }];
  }

  return drafts.map((item) => ({
    label: item.label.trim() || "일정",
    content: item.content,
  }));
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

function mapProductToForm(product: Product): ProductFormState {
  const includedItems = product.included_items?.trim() ?? "";
  const excludedItems = product.excluded_items?.trim() ?? "";
  const optionalTours = product.optional_tours?.trim() ?? "";
  const termsAndNotes = product.terms_and_notes?.trim() ?? "";
  const shouldRepairLegacyDetailMix =
    !includedItems && !excludedItems && (optionalTours.length > 0 || termsAndNotes.length > 0);

  return {
    title: product.title ?? "",
    description: product.description ?? "",
    product_source_url: product.product_source_url ?? "",
    point_benefits: product.point_benefits ?? "",
    point_tourism: normalizeOXValue(product.point_tourism),
    point_guide: normalizeOXValue(product.point_guide),
    meeting_info: normalizeOXValue(product.meeting_info),
    travel_insurance: normalizeOXValue(product.travel_insurance),
    included_items: shouldRepairLegacyDetailMix ? optionalTours : product.included_items ?? "",
    excluded_items: shouldRepairLegacyDetailMix ? termsAndNotes : product.excluded_items ?? "",
    departure_from_airport: product.departure_from_airport ?? "",
    departure_from_date: product.departure_from_date ?? "",
    departure_from_time: product.departure_from_time ?? "",
    departure_to_airport: product.departure_to_airport ?? "",
    departure_to_date: product.departure_to_date ?? "",
    departure_to_time: product.departure_to_time ?? "",
    departure_flight_name: product.departure_flight_name ?? "",
    arrival_from_airport: product.arrival_from_airport ?? "",
    arrival_from_date: product.arrival_from_date ?? "",
    arrival_from_time: product.arrival_from_time ?? "",
    arrival_to_airport: product.arrival_to_airport ?? "",
    arrival_to_date: product.arrival_to_date ?? "",
    arrival_to_time: product.arrival_to_time ?? "",
    arrival_flight_name: product.arrival_flight_name ?? "",
    detailed_schedule: product.detailed_schedule ?? "",
    optional_tours: shouldRepairLegacyDetailMix ? "" : product.optional_tours ?? "",
    terms_template_type:
      (product.terms_template_type as "" | TermsTemplateType | undefined) ?? "",
    terms_and_notes: shouldRepairLegacyDetailMix ? "" : product.terms_and_notes ?? "",
    meta_title: product.meta_title ?? "",
    meta_description: product.meta_description ?? "",
    image_url: product.image_url ?? "",
    category: product.category ?? "여행상품",
    theme: product.theme ?? "",
    price: typeof product.price === "number" ? product.price.toLocaleString("ko-KR") : "",
    duration: product.duration ?? "",
    itinerary: product.itinerary ?? "",
    inclusions: product.inclusions ?? "",
    is_active: product.is_active ?? true,
    is_featured_home: product.is_featured_home ?? false,
    sort_order: typeof product.sort_order === "number" ? String(product.sort_order) : "",
  };
}

export default function AdminProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [pendingFeaturedToggleId, setPendingFeaturedToggleId] = useState<string | null>(null);
  const [pendingMoveId, setPendingMoveId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [taxonomyItems, setTaxonomyItems] = useState<ProductTaxonomyWithUsage[]>([]);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [taxonomyErrorMessage, setTaxonomyErrorMessage] = useState("");
  const [pendingTaxonomyDeleteId, setPendingTaxonomyDeleteId] = useState<string | null>(null);
  const [pendingTaxonomyCreateType, setPendingTaxonomyCreateType] = useState<"category" | "theme" | null>(
    null,
  );
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newThemeInput, setNewThemeInput] = useState("");
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplateMap>(createEmptyTermsTemplateMap());
  const [isTermsTemplatesLoading, setIsTermsTemplatesLoading] = useState(true);
  const [isTermsTemplatesSaving, setIsTermsTemplatesSaving] = useState(false);
  const [termsTemplatesErrorMessage, setTermsTemplatesErrorMessage] = useState("");
  const [isTermsTemplatesPanelOpen, setIsTermsTemplatesPanelOpen] = useState(false);
  const [activeSchedulePreviewIndex, setActiveSchedulePreviewIndex] = useState(0);
  const [showRawScheduleEditor, setShowRawScheduleEditor] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 8;

  function parseThemeList(value: string) {
    return value
      .split(/[,\n/|]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function stringifyThemeList(list: string[]) {
    return list.join(",");
  }

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  }

  async function loadProducts() {
    try {
      setErrorMessage("");
      setIsLoading(true);
      const response = await fetch("/api/admin/products", { cache: "no-store" });
      const result = (await response.json()) as Product[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "상품 목록 조회에 실패했습니다.";
        setErrorMessage(msg ?? "상품 목록 조회에 실패했습니다.");
        return;
      }
      setProducts(result as Product[]);
    } catch {
      setErrorMessage("상품 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTaxonomies() {
    try {
      setTaxonomyErrorMessage("");
      setIsTaxonomyLoading(true);
      const response = await fetch("/api/admin/product-taxonomies", { cache: "no-store" });
      const result = (await response.json()) as ProductTaxonomyWithUsage[] | { message?: string };
      if (!response.ok) {
        const msg = "message" in result ? result.message : "분류 목록 조회에 실패했습니다.";
        setTaxonomyErrorMessage(msg ?? "분류 목록 조회에 실패했습니다.");
        return;
      }
      setTaxonomyItems(result as ProductTaxonomyWithUsage[]);
        if (Array.isArray(result) && (result as ProductTaxonomyWithUsage[]).length > 0) {
          setErrorMessage("");
        }
    } catch {
      setTaxonomyErrorMessage("분류 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsTaxonomyLoading(false);
    }
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
    Promise.all([loadProducts(), loadTaxonomies(), loadTermsTemplates()]);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (form.is_featured_home) {
      const isExistingFeatured = Boolean(editingProduct?.is_featured_home);
      if (!isExistingFeatured && featuredCount >= FEATURED_PRODUCT_LIMIT) {
        showToast("error", `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.`);
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const normalizedIncludedItems = form.included_items.trim();
      const normalizedExcludedItems = form.excluded_items.trim();
      const normalizedOptionalTours = form.optional_tours.trim();
      const normalizedTermsAndNotes = form.terms_and_notes.trim();
      const shouldRepairLegacyDetailMix =
        Boolean(editingId) &&
        !normalizedIncludedItems &&
        !normalizedExcludedItems &&
        (normalizedOptionalTours.length > 0 || normalizedTermsAndNotes.length > 0);
      const resolvedIncludedItems = shouldRepairLegacyDetailMix
        ? normalizedOptionalTours
        : normalizedIncludedItems;
      const resolvedExcludedItems = shouldRepairLegacyDetailMix
        ? normalizedTermsAndNotes
        : normalizedExcludedItems;
      const resolvedOptionalTours = shouldRepairLegacyDetailMix ? "" : normalizedOptionalTours;
      const resolvedTermsAndNotes = shouldRepairLegacyDetailMix ? "" : normalizedTermsAndNotes;
      const normalizedPrice = form.price.replace(/,/g, "").trim();
      const payload = {
        title: form.title,
        description: form.description,
        meta_title: form.meta_title.trim() === "" ? undefined : form.meta_title,
        meta_description: form.meta_description.trim() === "" ? undefined : form.meta_description,
        point_benefits: form.point_benefits.trim() === "" ? undefined : form.point_benefits,
        point_tourism: form.point_tourism,
        point_guide: form.point_guide,
        meeting_info: form.meeting_info,
        travel_insurance: form.travel_insurance,
        included_items: resolvedIncludedItems === "" ? undefined : resolvedIncludedItems,
        excluded_items: resolvedExcludedItems === "" ? undefined : resolvedExcludedItems,
        departure_from_airport:
          form.departure_from_airport.trim() === "" ? undefined : form.departure_from_airport,
        departure_from_date: form.departure_from_date.trim() === "" ? undefined : form.departure_from_date,
        departure_from_time: form.departure_from_time.trim() === "" ? undefined : form.departure_from_time,
        departure_to_airport: form.departure_to_airport.trim() === "" ? undefined : form.departure_to_airport,
        departure_to_date: form.departure_to_date.trim() === "" ? undefined : form.departure_to_date,
        departure_to_time: form.departure_to_time.trim() === "" ? undefined : form.departure_to_time,
        departure_flight_name:
          form.departure_flight_name.trim() === "" ? undefined : form.departure_flight_name,
        arrival_from_airport:
          form.arrival_from_airport.trim() === "" ? undefined : form.arrival_from_airport,
        arrival_from_date: form.arrival_from_date.trim() === "" ? undefined : form.arrival_from_date,
        arrival_from_time: form.arrival_from_time.trim() === "" ? undefined : form.arrival_from_time,
        arrival_to_airport: form.arrival_to_airport.trim() === "" ? undefined : form.arrival_to_airport,
        arrival_to_date: form.arrival_to_date.trim() === "" ? undefined : form.arrival_to_date,
        arrival_to_time: form.arrival_to_time.trim() === "" ? undefined : form.arrival_to_time,
        arrival_flight_name: form.arrival_flight_name.trim() === "" ? undefined : form.arrival_flight_name,
        detailed_schedule: form.detailed_schedule.trim() === "" ? undefined : form.detailed_schedule,
        optional_tours: resolvedOptionalTours === "" ? undefined : resolvedOptionalTours,
        terms_template_type: form.terms_template_type === "" ? undefined : form.terms_template_type,
        terms_and_notes: resolvedTermsAndNotes === "" ? undefined : resolvedTermsAndNotes,
        product_source_url: form.product_source_url.trim() === "" ? undefined : form.product_source_url,
        image_url: form.image_url,
        category: form.category,
        theme: form.theme.trim() === "" ? null : form.theme,
        price: normalizedPrice === "" ? null : Number(normalizedPrice),
        duration: form.duration.trim() === "" ? null : form.duration,
        itinerary: form.itinerary.trim() === "" ? null : form.itinerary,
        inclusions: form.inclusions.trim() === "" ? null : form.inclusions,
        is_active: form.is_featured_home ? true : form.is_active,
        is_featured_home: form.is_featured_home,
        sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
      };

      const endpoint = editingId ? `/api/admin/products/${editingId}` : "/api/admin/products";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        showToast("error", result.message ?? "상품 저장에 실패했습니다.");
        return;
      }

      showToast("success", editingId ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
      setEditingId(null);
      setForm(initialFormState);
      setActiveSchedulePreviewIndex(0);
      setShowRawScheduleEditor(false);
      await loadProducts();
    } catch {
      showToast("error", "상품 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("이 상품을 삭제할까요?");
    if (!confirmed) return;

    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "상품 삭제에 실패했습니다.");
        return;
      }

      if (editingId === id) {
        setEditingId(null);
        setForm(initialFormState);
        setActiveSchedulePreviewIndex(0);
        setShowRawScheduleEditor(false);
      }
      showToast("success", "상품이 삭제되었습니다.");
      await loadProducts();
    } catch {
      showToast("error", "상품 삭제 중 오류가 발생했습니다.");
    }
  }

  const orderedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aFeatured = Boolean(a.is_featured_home);
      const bFeatured = Boolean(b.is_featured_home);
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

      const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER;
      const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.title.localeCompare(b.title, "ko");
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const keywordFiltered = !q
      ? orderedProducts
      : orderedProducts.filter(
      (product) =>
        product.title.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        (product.theme ?? "").toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        (product.product_source_url ?? "").toLowerCase().includes(q) ||
        (product.point_benefits ?? "").toLowerCase().includes(q) ||
        (product.point_tourism ?? "").toLowerCase().includes(q) ||
        (product.point_guide ?? "").toLowerCase().includes(q) ||
        (product.meeting_info ?? "").toLowerCase().includes(q) ||
        (product.travel_insurance ?? "").toLowerCase().includes(q) ||
        (product.included_items ?? "").toLowerCase().includes(q) ||
        (product.excluded_items ?? "").toLowerCase().includes(q) ||
        (product.departure_from_airport ?? "").toLowerCase().includes(q) ||
        (product.departure_to_airport ?? "").toLowerCase().includes(q) ||
        (product.departure_flight_name ?? "").toLowerCase().includes(q) ||
        (product.arrival_from_airport ?? "").toLowerCase().includes(q) ||
        (product.arrival_to_airport ?? "").toLowerCase().includes(q) ||
        (product.arrival_flight_name ?? "").toLowerCase().includes(q) ||
        (product.detailed_schedule ?? "").toLowerCase().includes(q) ||
        (product.optional_tours ?? "").toLowerCase().includes(q) ||
        (product.terms_template_type ?? "").toLowerCase().includes(q) ||
        (product.terms_and_notes ?? "").toLowerCase().includes(q) ||
        (product.meta_title ?? "").toLowerCase().includes(q) ||
        (product.meta_description ?? "").toLowerCase().includes(q),
    );

    if (!showFeaturedOnly) return keywordFiltered;
    return keywordFiltered.filter((product) => Boolean(product.is_featured_home));
  }, [orderedProducts, keyword, showFeaturedOnly]);

  const featuredCount = useMemo(
    () => products.filter((product) => Boolean(product.is_featured_home)).length,
    [products],
  );
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingId),
    [products, editingId],
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const categoryOptions = useMemo(() => {
    return taxonomyItems
      .filter((item) => item.type === "category" && item.is_active)
      .map((item) => item.name);
  }, [taxonomyItems]);
  const selectedThemes = useMemo(() => parseThemeList(form.theme), [form.theme]);
  const availableThemeOptions = useMemo(
    () =>
      taxonomyItems
        .filter((item) => item.type === "theme" && item.is_active)
        .map((item) => item.name),
    [taxonomyItems],
  );
  const categoryTaxonomies = useMemo(
    () => taxonomyItems.filter((item) => item.type === "category"),
    [taxonomyItems],
  );
  const themeTaxonomies = useMemo(
    () => taxonomyItems.filter((item) => item.type === "theme"),
    [taxonomyItems],
  );
  const scheduleDrafts = useMemo(
    () => parseDetailedSchedule(form.detailed_schedule),
    [form.detailed_schedule],
  );
  const selectedTermsTemplateContent = useMemo(() => {
    if (!form.terms_template_type) return "";
    return termsTemplates[form.terms_template_type] ?? "";
  }, [form.terms_template_type, termsTemplates]);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (form.category === "") return;
      setForm((prev) => ({ ...prev, category: "" }));
      return;
    }
    if (categoryOptions.includes(form.category)) return;
    setForm((prev) => ({ ...prev, category: categoryOptions[0] }));
  }, [categoryOptions, form.category]);

  useEffect(() => {
    const allowedThemes = new Set(availableThemeOptions);
    const cleaned = parseThemeList(form.theme).filter((theme) => allowedThemes.has(theme));
    const cleanedText = stringifyThemeList(cleaned);
    if (cleanedText === form.theme) return;
    setForm((prev) => ({ ...prev, theme: cleanedText }));
  }, [availableThemeOptions, form.theme]);

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

  function movePage(nextPage: number) {
    setPage(Math.max(1, Math.min(nextPage, totalPages)));
  }

  function addCustomCategory() {
    const value = newCategoryInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("category");
    fetch("/api/admin/product-taxonomies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: value }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { message?: string };
        if (!response.ok) {
          showToast("error", result.message ?? "카테고리 추가에 실패했습니다.");
          return;
        }
        setForm((prev) => ({ ...prev, category: value }));
        setNewCategoryInput("");
        showToast("success", "카테고리를 추가했습니다.");
        await loadTaxonomies();
      })
      .catch(() => {
        showToast("error", "카테고리 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  function toggleTheme(theme: string) {
    setForm((prev) => {
      const current = parseThemeList(prev.theme);
      const next = current.includes(theme)
        ? current.filter((item) => item !== theme)
        : [...current, theme];
      return { ...prev, theme: stringifyThemeList(next) };
    });
  }

  function addCustomTheme() {
    const value = newThemeInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("theme");
    fetch("/api/admin/product-taxonomies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "theme", name: value }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { message?: string };
        if (!response.ok) {
          showToast("error", result.message ?? "테마 추가에 실패했습니다.");
          return;
        }
        setForm((prev) => {
          const current = parseThemeList(prev.theme);
          if (current.includes(value)) return prev;
          return { ...prev, theme: stringifyThemeList([...current, value]) };
        });
        setNewThemeInput("");
        showToast("success", "테마를 추가했습니다.");
        await loadTaxonomies();
      })
      .catch(() => {
        showToast("error", "테마 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  async function handleDeleteTaxonomy(item: ProductTaxonomyWithUsage) {
    const confirmed = window.confirm(`'${item.name}' 항목을 삭제할까요?`);
    if (!confirmed) return;
    setPendingTaxonomyDeleteId(item.id);
    try {
      const response = await fetch(`/api/admin/product-taxonomies/${item.id}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "삭제에 실패했습니다.");
        return;
      }
      showToast("success", "항목을 삭제했습니다.");
      await loadTaxonomies();
    } catch {
      showToast("error", "삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingTaxonomyDeleteId(null);
    }
  }

  async function quickToggleActive(product: Product) {
    setPendingToggleId(product.id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !(product.is_active ?? true) }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "활성화 상태 변경에 실패했습니다.");
        return;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, is_active: !(item.is_active ?? true) } : item,
        ),
      );
      showToast("success", "상품 활성화 상태를 변경했습니다.");
    } catch {
      showToast("error", "활성화 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingToggleId(null);
    }
  }

  async function quickToggleFeaturedHome(product: Product) {
    if (!product.is_featured_home && featuredCount >= FEATURED_PRODUCT_LIMIT) {
      showToast("error", `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.`);
      return;
    }

    setPendingFeaturedToggleId(product.id);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_featured_home: !Boolean(product.is_featured_home) }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        showToast("error", result.message ?? "메인 추천 상태 변경에 실패했습니다.");
        return;
      }

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                is_featured_home: !Boolean(item.is_featured_home),
                is_active: !Boolean(item.is_featured_home) ? true : item.is_active,
              }
            : item,
        ),
      );
      showToast("success", "메인 추천 상태를 변경했습니다.");
    } catch {
      showToast("error", "메인 추천 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingFeaturedToggleId(null);
    }
  }

  async function moveSortOrder(product: Product, direction: "up" | "down") {
    const sameBucket = orderedProducts.filter(
      (item) => Boolean(item.is_featured_home) === Boolean(product.is_featured_home),
    );
    const currentIndex = sameBucket.findIndex((item) => item.id === product.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sameBucket.length) return;

    const target = sameBucket[targetIndex];
    const currentOrder = typeof product.sort_order === "number" ? product.sort_order : currentIndex + 1;
    const targetOrder = typeof target.sort_order === "number" ? target.sort_order : targetIndex + 1;

    setPendingMoveId(product.id);
    try {
      const first = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: targetOrder }),
      });
      const firstResult = (await first.json()) as { message?: string };
      if (!first.ok) {
        showToast("error", firstResult.message ?? "노출순서 변경에 실패했습니다.");
        return;
      }

      const second = await fetch(`/api/admin/products/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: currentOrder }),
      });
      const secondResult = (await second.json()) as { message?: string };
      if (!second.ok) {
        showToast("error", secondResult.message ?? "노출순서 변경에 실패했습니다.");
        return;
      }

      showToast("success", "노출순서를 변경했습니다.");
      await loadProducts();
    } catch {
      showToast("error", "노출순서 변경 중 오류가 발생했습니다.");
    } finally {
      setPendingMoveId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]">
        <h3 className="text-lg font-bold text-[#1e3a8a]">카테고리/테마 관리</h3>
        {taxonomyErrorMessage ? <p className="text-sm text-red-500">{taxonomyErrorMessage}</p> : null}
        {isTaxonomyLoading ? (
          <p className="text-sm text-slate-500">분류 목록을 불러오는 중입니다...</p>
        ) : (
          <div className="space-y-3">
            {taxonomyItems.some((item) => item.id.startsWith("fallback-")) ? (
              <p className="text-xs text-amber-700">
                분류 전용 테이블이 없어 임시 목록으로 표시 중입니다. SQL 적용 후 추가/삭제가 완전 활성화됩니다.
              </p>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">카테고리</p>
              <div className="flex flex-wrap gap-2">
                {categoryTaxonomies.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
                  >
                    {item.name}
                    <span className="text-[10px] text-blue-600">({item.usageCount})</span>
                    <button
                      type="button"
                      disabled={pendingTaxonomyDeleteId === item.id || item.id.startsWith("fallback-")}
                      onClick={() => handleDeleteTaxonomy(item)}
                      className="rounded bg-white px-1.5 py-0.5 text-[10px] text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">테마</p>
              <div className="flex flex-wrap gap-2">
                {themeTaxonomies.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    {item.name}
                    <span className="text-[10px] text-amber-600">({item.usageCount})</span>
                    <button
                      type="button"
                      disabled={pendingTaxonomyDeleteId === item.id || item.id.startsWith("fallback-")}
                      onClick={() => handleDeleteTaxonomy(item)}
                      className="rounded bg-white px-1.5 py-0.5 text-[10px] text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          </div>
        )}
      </section>

      <form className="space-y-4 rounded-xl bg-[#f8fbff] p-4 ring-1 ring-[#dbeafe]" onSubmit={handleSubmit}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#1e3a8a]">{editingId ? "상품 수정" : "상품 등록"}</h3>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(initialFormState);
                setActiveSchedulePreviewIndex(0);
                setShowRawScheduleEditor(false);
                setErrorMessage("");
              }}
              className="text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              수정 취소
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            required
            placeholder="상품명"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {categoryOptions.length === 0 ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  카테고리를 먼저 추가해 주세요
                </span>
              ) : (
                categoryOptions.map((category) => {
                  const selected = form.category === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, category }))}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        selected
                          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                          : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {category}
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newCategoryInput}
                onChange={(event) => setNewCategoryInput(event.target.value)}
                placeholder="카테고리 직접 추가"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              />
              <button
                type="button"
                onClick={addCustomCategory}
                disabled={pendingTaxonomyCreateType === "category"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {pendingTaxonomyCreateType === "category" ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {availableThemeOptions.map((theme) => {
                const selected = selectedThemes.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => toggleTheme(theme)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selected
                        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                        : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newThemeInput}
                onChange={(event) => setNewThemeInput(event.target.value)}
                placeholder="테마 직접 추가 (예: 가족여행)"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              />
              <button
                type="button"
                onClick={addCustomTheme}
                disabled={pendingTaxonomyCreateType === "theme"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {pendingTaxonomyCreateType === "theme" ? "추가 중..." : "추가"}
              </button>
            </div>
            <p className="text-xs text-slate-500">선택된 테마: {selectedThemes.join(", ") || "-"}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <input
              value={form.image_url}
              onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
              required
              placeholder="이미지 URL (권장 1200x800)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
            <p className="text-xs text-slate-500">
              권장 사이즈: 1200x800px 이상 (3:2 비율). JPG/PNG/WebP 사용 가능
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs font-semibold text-emerald-700">관리자 전용 | 상품 원본주소</p>
            <input
              value={form.product_source_url}
              onChange={(event) => setForm((prev) => ({ ...prev, product_source_url: event.target.value }))}
              placeholder="상품 원본주소 (관리자 확인용 URL)"
              className="w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>
          <input
            value={form.price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, price: formatPriceWithCommas(event.target.value) }))
            }
            placeholder="가격(숫자)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <input
            value={form.duration}
            onChange={(event) => setForm((prev) => ({ ...prev, duration: event.target.value }))}
            placeholder="일정(예: 5일)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <textarea
            value={form.point_benefits}
            onChange={(event) => setForm((prev) => ({ ...prev, point_benefits: event.target.value }))}
            rows={3}
            placeholder="상품 포인트 - 혜택 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <textarea
            value={form.included_items}
            onChange={(event) => setForm((prev) => ({ ...prev, included_items: event.target.value }))}
            rows={3}
            placeholder="포함사항 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <textarea
            value={form.excluded_items}
            onChange={(event) => setForm((prev) => ({ ...prev, excluded_items: event.target.value }))}
            rows={3}
            placeholder="불포함사항 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <div className="space-y-3 rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[#1e3a8a]">항공편 정보</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">출발 항공편</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={form.departure_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 인천 ICN)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.departure_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.departure_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.departure_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.20(금))"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.departure_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 09:40)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.departure_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, departure_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 11:20)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                </div>
                <input
                  value={form.departure_flight_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, departure_flight_name: event.target.value }))
                  }
                  placeholder="항공편명 (예: 아시아나항공)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-700">도착 항공편</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={form.arrival_from_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_airport: event.target.value }))
                    }
                    placeholder="출발공항 (예: 미야자키 KMI)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.arrival_to_airport}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_airport: event.target.value }))
                    }
                    placeholder="도착공항 (예: 인천 ICN)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.arrival_from_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_date: event.target.value }))
                    }
                    placeholder="출발일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.arrival_to_date}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_date: event.target.value }))
                    }
                    placeholder="도착일자 (예: 2026.02.23(월))"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.arrival_from_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_from_time: event.target.value }))
                    }
                    placeholder="출발시각 (예: 12:30)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                  <input
                    value={form.arrival_to_time}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, arrival_to_time: event.target.value }))
                    }
                    placeholder="도착시각 (예: 14:10)"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                  />
                </div>
                <input
                  value={form.arrival_flight_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, arrival_flight_name: event.target.value }))
                  }
                  placeholder="항공편명 (예: 아시아나항공)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[#1e3a8a]">상세일정 작성 도우미</p>
                <p className="text-xs text-slate-500">일차별로 작성하면 자동으로 탭 형식으로 저장됩니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addScheduleDay}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                >
                  + 일차 추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawScheduleEditor((prev) => !prev)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {showRawScheduleEditor ? "원문 편집 숨기기" : "원문 직접 편집"}
                </button>
              </div>
            </div>

            {scheduleDrafts.length === 0 ? (
              <button
                type="button"
                onClick={addScheduleDay}
                className="w-full rounded-lg border border-dashed border-slate-300 bg-white px-3 py-6 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                일차를 추가하고 상세일정을 입력해 주세요
              </button>
            ) : (
              <div className="space-y-3">
                {scheduleDrafts.map((item, index) => (
                  <article key={`${item.label}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
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
                        className="w-28 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
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
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 disabled:opacity-40"
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
                          className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-700 disabled:opacity-40"
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
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
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
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          + {template.label}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {scheduleDrafts.length > 0 ? (
              <div className="rounded-xl border border-blue-100 bg-white p-4">
                <p className="mb-2 text-xs font-semibold text-blue-700">실시간 미리보기</p>
                <div className="mb-2 inline-flex items-center rounded-full bg-[#eff6ff] px-2.5 py-1 text-xs font-bold text-[#1d4ed8]">
                  {scheduleDrafts[activeSchedulePreviewIndex]?.label || `${activeSchedulePreviewIndex + 1}일차`}
                </div>
                <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                  {scheduleDrafts[activeSchedulePreviewIndex]?.content || "입력한 일정이 여기에 표시됩니다."}
                </p>
              </div>
            ) : null}

            {showRawScheduleEditor ? (
              <textarea
                value={form.detailed_schedule}
                onChange={(event) => setForm((prev) => ({ ...prev, detailed_schedule: event.target.value }))}
                rows={8}
                placeholder={"원문 직접 편집\n예시:\n[1일차]\n인천 출발 / 하노이 도착\n...\n\n[2일차]\n하노이 시내관광\n..."}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
              />
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-slate-700">상품 포인트 O/X 선택</p>
            <div className="grid gap-3 md:grid-cols-2">
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
                  <div key={field.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-700">{field.label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, [fieldKey]: "O" }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                          value === "O"
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
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
                            : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
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
          <textarea
            value={form.optional_tours}
            onChange={(event) => setForm((prev) => ({ ...prev, optional_tours: event.target.value }))}
            rows={4}
            placeholder="선택관광 목록 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <div className="space-y-2 rounded-lg border border-[#dbeafe] bg-[#f8fbff] p-3 md:col-span-2">
            <p className="text-sm font-semibold text-[#1e3a8a]">약관 및 참조사항 템플릿 적용</p>
            <select
              value={form.terms_template_type}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  terms_template_type: event.target.value as "" | TermsTemplateType,
                }))
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            >
              <option value="">직접 입력 (템플릿 미사용)</option>
              {TERMS_TEMPLATE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            {form.terms_template_type ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">선택 템플릿 미리보기</p>
                <p className="whitespace-pre-line text-xs leading-6 text-slate-600">
                  {selectedTermsTemplateContent.trim() || "템플릿 내용이 비어 있습니다. 아래에서 수정해 주세요."}
                </p>
              </div>
            ) : null}
            <textarea
              value={form.terms_and_notes}
              onChange={(event) => setForm((prev) => ({ ...prev, terms_and_notes: event.target.value }))}
              rows={4}
              placeholder="약관 및 참조사항 직접 입력 (템플릿 미사용 시 적용)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white/90 p-3 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">약관 템플릿 관리 (공통)</p>
              <button
                type="button"
                onClick={() => setIsTermsTemplatesPanelOpen((prev) => !prev)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {isTermsTemplatesPanelOpen ? "접기" : "펼치기"}
              </button>
            </div>
            {!isTermsTemplatesPanelOpen ? (
              <p className="text-xs text-slate-500">
                안전을 위해 기본 접힘 상태입니다. 수정이 필요할 때만 펼쳐서 사용해 주세요.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={saveTermsTemplates}
                    disabled={isTermsTemplatesLoading || isTermsTemplatesSaving}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {isTermsTemplatesSaving ? "저장 중..." : "템플릿 저장"}
                  </button>
                </div>
                {termsTemplatesErrorMessage ? (
                  <p className="text-xs text-rose-600">{termsTemplatesErrorMessage}</p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  {TERMS_TEMPLATE_OPTIONS.map((item) => (
                    <div key={item.value} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <p className="text-xs font-semibold text-slate-700">{item.label}</p>
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
                        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs leading-5 outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
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
            placeholder="SEO 메타 타이틀 (선택, 예시: 전 세계 맞춤 여행, 더올투어 / 패키지 골프여행 / 베트남 다낭 3박 5일 패키지 / No옵션 No쇼핑 특가)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <textarea
            value={form.meta_description}
            onChange={(event) => setForm((prev) => ({ ...prev, meta_description: event.target.value }))}
            rows={3}
            placeholder="SEO 메타 설명 (선택, 예시: 타깃층 문제해결 + 차별화된 혜택/신뢰 요소 + CTA포함)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <input
            value={form.sort_order}
            onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
            placeholder="노출 순서 (숫자 작을수록 먼저)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            상품 노출 활성화
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_featured_home}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_featured_home: event.target.checked }))
              }
              className="h-4 w-4 accent-[#1d4ed8]"
            />
            메인 추천상품 슬라이드 노출 (최대 {FEATURED_PRODUCT_LIMIT}개)
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#1d4ed8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:cursor-not-allowed disabled:bg-[#93c5fd]"
          >
            {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "상품 등록"}
          </button>
          <span className="text-xs text-slate-500">
            메인 추천 설정: {featuredCount}/{FEATURED_PRODUCT_LIMIT}
          </span>
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-[#1e3a8a]">상품 목록</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showFeaturedOnly}
                onChange={(event) => {
                  setShowFeaturedOnly(event.target.checked);
                  setPage(1);
                }}
                className="h-4 w-4 accent-[#1d4ed8]"
              />
              추천상품만 보기
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="상품 검색"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
            />
          </div>
        </div>
        {errorMessage ? <p className="text-sm text-red-500">{errorMessage}</p> : null}
        {isLoading ? (
          <p className="text-sm text-slate-500">상품 목록을 불러오는 중입니다...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] border-collapse text-sm">
              <thead className="bg-[#eff6ff] text-[#1e3a8a]">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">원본주소</th>
                  <th className="px-4 py-3 text-left font-semibold">상품명</th>
                  <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">카테고리</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">테마/배지</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">가격</th>
                  <th className="w-[170px] px-4 py-3 text-left font-semibold">노출순서</th>
                  <th className="w-[110px] px-4 py-3 text-left font-semibold whitespace-nowrap">활성화</th>
                  <th className="w-[92px] px-4 py-3 text-center font-semibold whitespace-nowrap">메인추천</th>
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      등록된 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((product) => (
                    <tr key={product.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 text-center">
                        {product.product_source_url ? (
                          <a
                            href={product.product_source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[#1d4ed8] underline-offset-2 hover:underline"
                          >
                            원본 보기
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="max-w-[270px] px-4 py-3 font-medium text-[#1e3a8a]">{product.title}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{product.category}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{product.theme ?? "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {typeof product.price === "number"
                          ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex min-w-8 justify-center rounded bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                            {typeof product.sort_order === "number" ? product.sort_order : "-"}
                          </span>
                          <button
                            type="button"
                            disabled={pendingMoveId === product.id}
                            onClick={() => moveSortOrder(product, "up")}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="위로 이동"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={pendingMoveId === product.id}
                            onClick={() => moveSortOrder(product, "down")}
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="아래로 이동"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {product.is_active === false ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                            비노출
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-700">
                            노출
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {product.is_featured_home ? (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                            추천
                          </span>
                        ) : (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                            일반
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={pendingToggleId === product.id}
                            onClick={() => quickToggleActive(product)}
                            className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                              product.is_active === false
                                ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            }`}
                          >
                            {product.is_active === false ? "활성화" : "비활성화"}
                          </button>
                          <button
                            type="button"
                            disabled={pendingFeaturedToggleId === product.id}
                            onClick={() => quickToggleFeaturedHome(product)}
                            className={`rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                              product.is_featured_home
                                ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            {product.is_featured_home ? "추천해제" : "추천등록"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(product.id);
                              setForm(mapProductToForm(product));
                              setActiveSchedulePreviewIndex(0);
                              setShowRawScheduleEditor(false);
                              setErrorMessage("");
                            }}
                            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between text-sm text-slate-600">
          <p>
            총 {filteredProducts.length}건 중 {filteredProducts.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
            -
            {Math.min(safePage * pageSize, filteredProducts.length)}건 표시
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => movePage(safePage - 1)}
              disabled={safePage <= 1}
              className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              이전
            </button>
            <span className="text-xs font-semibold">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => movePage(safePage + 1)}
              disabled={safePage >= totalPages}
              className="rounded border border-slate-300 px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50">
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
              toast.type === "success" ? "bg-[#16a34a]" : "bg-[#dc2626]"
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </div>
  );
}
