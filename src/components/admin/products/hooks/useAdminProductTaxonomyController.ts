"use client";

import { useEffect, useState } from "react";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import type { TaxonomyType } from "@/types/productTaxonomy";
import {
  fetchAdminProductTaxonomy,
  createAdminProductTaxonomy,
  updateAdminProductTaxonomy,
  deleteAdminProductTaxonomy,
} from "@/components/admin/products/api/adminProductTaxonomy.client";
import type { CreateAdminTaxonomyPayload } from "@/components/admin/products/api/adminProductTaxonomy.client";
import type { UpdateAdminTaxonomyPayload } from "@/components/admin/products/api/adminProductTaxonomy.client";

const TAXONOMY_TAB_TYPES: TaxonomyType[] = ["destination", "theme", "product_line", "campaign"];

export type UseAdminProductTaxonomyControllerParams = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
  onCategoryAdded?: (name: string) => void;
  onThemeAdded?: (name: string) => void;
};

const SUCCESS_MESSAGE_BY_TYPE: Record<TaxonomyType, string> = {
  destination: "지역을 추가했습니다.",
  theme: "테마를 추가했습니다.",
  product_line: "상품군을 추가했습니다.",
  campaign: "기획 항목을 추가했습니다.",
  tag: "태그를 추가했습니다.",
};

export function useAdminProductTaxonomyController({
  showToast,
  confirm,
  onCategoryAdded,
  onThemeAdded,
}: UseAdminProductTaxonomyControllerParams) {
  const [activeTab, setActiveTab] = useState<TaxonomyType>("destination");
  const [taxonomyItems, setTaxonomyItems] = useState<ProductTaxonomyWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [newNameInput, setNewNameInput] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSortOrder, setNewSortOrder] = useState<string | number>("");
  const [newParentId, setNewParentId] = useState<string | null>(null);
  const [pendingCreateType, setPendingCreateType] = useState<TaxonomyType | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);

  async function loadTaxonomies(taxonomyType: TaxonomyType) {
    try {
      setErrorMessage("");
      setIsLoading(true);
      const result = await fetchAdminProductTaxonomy({ taxonomy_type: taxonomyType });
      setTaxonomyItems(result);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "분류 목록 조회 중 오류가 발생했습니다.",
      );
      setTaxonomyItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomies(activeTab);
  }, [activeTab]);

  const [destinationOptions, setDestinationOptions] = useState<ProductTaxonomyWithUsage[]>([]);
  const [themeOptions, setThemeOptions] = useState<ProductTaxonomyWithUsage[]>([]);
  const [productLineOptions, setProductLineOptions] = useState<ProductTaxonomyWithUsage[]>([]);
  const [campaignOptions, setCampaignOptions] = useState<ProductTaxonomyWithUsage[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
      fetchAdminProductTaxonomy({ taxonomy_type: "theme" }),
      fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
      fetchAdminProductTaxonomy({ taxonomy_type: "campaign" }),
    ]).then(([dest, theme, productLine, campaign]) => {
      if (!cancelled) {
        setDestinationOptions(dest);
        setThemeOptions(theme);
        setProductLineOptions(productLine);
        setCampaignOptions(campaign);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const hasFallbackItems = taxonomyItems.some((item) => item.id.startsWith("fallback-"));

  function addCustom() {
    const value = newNameInput.trim();
    if (!value) return;
    setPendingCreateType(activeTab);
    const payload: CreateAdminTaxonomyPayload = {
      taxonomy_type: activeTab,
      name: value,
      is_hub_visible: true,
      is_landing_enabled: false,
    };
    if (newSlug.trim()) payload.slug = newSlug.trim() || null;
    if (newSortOrder !== null && newSortOrder !== "") {
      const n = Number(newSortOrder);
      if (!Number.isNaN(n)) payload.sort_order = n;
    }
    if (activeTab === "destination" && newParentId) payload.parent_id = newParentId;
    if (activeTab === "theme" && newParentId) payload.parent_id = newParentId;
    createAdminProductTaxonomy(payload)
      .then(async () => {
        if (activeTab === "destination") onCategoryAdded?.(value);
        if (activeTab === "theme") onThemeAdded?.(value);
        setNewNameInput("");
        setNewSlug("");
        setNewSortOrder("");
        setNewParentId(null);
        showToast("success", SUCCESS_MESSAGE_BY_TYPE[activeTab]);
        await loadTaxonomies(activeTab);
        if (activeTab === "destination" || activeTab === "theme") {
          const [dest, theme] = await Promise.all([
            fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
            fetchAdminProductTaxonomy({ taxonomy_type: "theme" }),
          ]);
          setDestinationOptions(dest);
          setThemeOptions(theme);
        }
        if (activeTab === "product_line" || activeTab === "campaign") {
          const [productLine, campaign] = await Promise.all([
            fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
            fetchAdminProductTaxonomy({ taxonomy_type: "campaign" }),
          ]);
          setProductLineOptions(productLine);
          setCampaignOptions(campaign);
        }
      })
      .catch((err) => {
        showToast(
          "error",
          err instanceof Error ? err.message : "항목 추가 중 오류가 발생했습니다.",
        );
      })
      .finally(() => setPendingCreateType(null));
  }

  async function addCustomWithType(
    type: "destination" | "theme",
    name: string,
    slug?: string | null,
    sortOrder?: number | null,
  ) {
    const value = name.trim();
    if (!value) return;
    setPendingCreateType(type);
    const payload: CreateAdminTaxonomyPayload = {
      taxonomy_type: type,
      name: value,
      is_hub_visible: true,
      is_landing_enabled: false,
    };
    if (slug?.trim()) payload.slug = slug.trim() || null;
    if (sortOrder != null && !Number.isNaN(Number(sortOrder))) payload.sort_order = Number(sortOrder);
    try {
      await createAdminProductTaxonomy(payload);
      if (type === "destination") onCategoryAdded?.(value);
      if (type === "theme") onThemeAdded?.(value);
      showToast("success", SUCCESS_MESSAGE_BY_TYPE[type]);
      const [dest, theme] = await Promise.all([
        fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
        fetchAdminProductTaxonomy({ taxonomy_type: "theme" }),
      ]);
      setDestinationOptions(dest);
      setThemeOptions(theme);
      if (activeTab === type) await loadTaxonomies(activeTab);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "항목 추가 중 오류가 발생했습니다.",
      );
    } finally {
      setPendingCreateType(null);
    }
  }

  async function handleUpdateTaxonomy(
    item: ProductTaxonomyWithUsage,
    payload: UpdateAdminTaxonomyPayload,
  ) {
    if (!item?.id?.trim()) {
      showToast("error", "항목 ID가 없어 수정할 수 없습니다.");
      return;
    }
    setPendingUpdateId(item.id);
    try {
      await updateAdminProductTaxonomy(item.id, payload);
      showToast("success", "수정되었습니다.");
      await loadTaxonomies(activeTab);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "수정 중 오류가 발생했습니다.");
    } finally {
      setPendingUpdateId(null);
    }
  }

  async function handleDeleteTaxonomy(item: ProductTaxonomyWithUsage) {
    if (!item?.id?.trim()) {
      showToast("error", "항목 ID가 없어 삭제할 수 없습니다.");
      return;
    }
    const ok = await confirm({
      title: "삭제 확인",
      description: `'${item.name}' 항목을 삭제할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;
    setPendingDeleteId(item.id);
    try {
      await deleteAdminProductTaxonomy(item.id);
      showToast("success", "항목을 삭제했습니다.");
      await loadTaxonomies(activeTab);
      const typ = item.taxonomy_type;
      if (typ === "destination" || typ === "theme") {
        const [dest, theme] = await Promise.all([
          fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
          fetchAdminProductTaxonomy({ taxonomy_type: "theme" }),
        ]);
        setDestinationOptions(dest);
        setThemeOptions(theme);
      }
      if (typ === "product_line" || typ === "campaign") {
        const [productLine, campaign] = await Promise.all([
          fetchAdminProductTaxonomy({ taxonomy_type: "product_line" }),
          fetchAdminProductTaxonomy({ taxonomy_type: "campaign" }),
        ]);
        setProductLineOptions(productLine);
        setCampaignOptions(campaign);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return {
    activeTab,
    setActiveTab,
    taxonomyTabTypes: TAXONOMY_TAB_TYPES,
    taxonomyItems,
    destinationOptions,
    themeOptions,
    productLineOptions,
    campaignOptions,
    hasFallbackItems,
    isLoading,
    errorMessage,
    newNameInput,
    newSlug,
    newSortOrder,
    newParentId,
    pendingCreateType,
    pendingDeleteId,
    pendingUpdateId,
    setNewNameInput,
    setNewSlug,
    setNewSortOrder,
    setNewParentId,
    loadTaxonomies: () => loadTaxonomies(activeTab),
    addCustom,
    addCustomWithType,
    handleUpdateTaxonomy,
    handleDeleteTaxonomy,
  };
}
