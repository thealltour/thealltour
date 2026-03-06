"use client";

import { useEffect, useState } from "react";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import {
  fetchAdminProductTaxonomy,
  createAdminProductTaxonomy,
  deleteAdminProductTaxonomy,
} from "@/components/admin/products/api/adminProductTaxonomy.client";

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

export function useAdminProductTaxonomyController({
  showToast,
  confirm,
  onCategoryAdded,
  onThemeAdded,
}: UseAdminProductTaxonomyControllerParams) {
  const [taxonomyItems, setTaxonomyItems] = useState<ProductTaxonomyWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [newThemeInput, setNewThemeInput] = useState("");
  const [pendingCreateType, setPendingTaxonomyCreateType] = useState<"category" | "theme" | null>(
    null,
  );
  const [pendingDeleteId, setPendingTaxonomyDeleteId] = useState<string | null>(null);

  async function loadTaxonomies() {
    try {
      setErrorMessage("");
      setIsLoading(true);
      const result = await fetchAdminProductTaxonomy();
      setTaxonomyItems(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "분류 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomies();
  }, []);

  const categoryTaxonomies = taxonomyItems.filter((item) => item.type === "category");
  const themeTaxonomies = taxonomyItems.filter((item) => item.type === "theme");
  const hasFallbackItems = taxonomyItems.some((item) => item.id.startsWith("fallback-"));

  function addCustomCategory() {
    const value = newCategoryInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("category");
    createAdminProductTaxonomy({ type: "category", name: value })
      .then(() => {
        onCategoryAdded?.(value);
        setNewCategoryInput("");
        showToast("success", "카테고리를 추가했습니다.");
        return loadTaxonomies();
      })
      .catch((err) => {
        showToast("error", err instanceof Error ? err.message : "카테고리 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  function addCustomTheme() {
    const value = newThemeInput.trim();
    if (!value) return;
    setPendingTaxonomyCreateType("theme");
    createAdminProductTaxonomy({ type: "theme", name: value })
      .then(() => {
        onThemeAdded?.(value);
        setNewThemeInput("");
        showToast("success", "테마를 추가했습니다.");
        return loadTaxonomies();
      })
      .catch((err) => {
        showToast("error", err instanceof Error ? err.message : "테마 추가 중 오류가 발생했습니다.");
      })
      .finally(() => setPendingTaxonomyCreateType(null));
  }

  async function handleDeleteTaxonomy(item: ProductTaxonomyWithUsage) {
    const ok = await confirm({
      title: "삭제 확인",
      description: `'${item.name}' 항목을 삭제할까요?`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
    });
    if (!ok) return;
    setPendingTaxonomyDeleteId(item.id);
    try {
      await deleteAdminProductTaxonomy(item.id);
      showToast("success", "항목을 삭제했습니다.");
      await loadTaxonomies();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
    } finally {
      setPendingTaxonomyDeleteId(null);
    }
  }

  return {
    categoryTaxonomies,
    themeTaxonomies,
    hasFallbackItems,
    taxonomyItems,
    isLoading,
    errorMessage,
    newCategoryInput,
    newThemeInput,
    pendingCreateType,
    pendingDeleteId,
    setNewCategoryInput,
    setNewThemeInput,
    loadTaxonomies,
    addCustomCategory,
    addCustomTheme,
    handleDeleteTaxonomy,
  };
}
