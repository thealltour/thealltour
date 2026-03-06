"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types/product";
import type {
  HomeCuratedSettings,
  HomeCuratedSectionWithCount,
  SectionProductMappingRow,
} from "@/types/homeCurated";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  fetchAdminHomeCurated,
  updateAdminHomeCuratedSettings,
  createAdminHomeCuratedSection,
  updateAdminHomeCuratedSection,
  deleteAdminHomeCuratedSection,
  fetchAdminHomeCuratedSectionProducts,
  addAdminHomeCuratedSectionProduct,
  updateAdminHomeCuratedSectionProduct,
  deleteAdminHomeCuratedSectionProduct,
} from "@/components/admin/products/api/adminHomeCurated.client";
import { fetchAdminProducts } from "@/components/admin/products/api/adminProducts.client";
import HomeCuratedSettingsPanel from "@/components/admin/products/HomeCuratedSettingsPanel";
import HomeCuratedSectionsPanel from "@/components/admin/products/HomeCuratedSectionsPanel";
import HomeCuratedSectionProductsPanel from "@/components/admin/products/HomeCuratedSectionProductsPanel";

export default function AdminHomeCuratedManager() {
  const [featuredSettings, setFeaturedSettings] = useState<HomeCuratedSettings | null>(null);
  const [featuredSections, setFeaturedSections] = useState<HomeCuratedSectionWithCount[]>([]);
  const [selectedFeaturedSectionId, setSelectedFeaturedSectionId] = useState<string | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [featuredSaving, setFeaturedSaving] = useState(false);
  const [featuredError, setFeaturedError] = useState("");
  const [featuredSettingsForm, setFeaturedSettingsForm] = useState({
    section_label: "",
    section_title: "",
    section_description: "",
    catalog_button_label: "",
    catalog_button_href: "/products",
    is_active: true,
  });
  const [editingFeaturedSectionId, setEditingFeaturedSectionId] = useState<string | null>(null);
  const [editingFeaturedSectionForm, setEditingFeaturedSectionForm] = useState({
    title: "",
    description: "",
    sort_order: 0,
    max_items: 8,
    is_active: true,
  });
  const [pendingDeleteSectionId, setPendingDeleteSectionId] = useState<string | null>(null);
  const [featuredSectionProducts, setFeaturedSectionProducts] = useState<SectionProductMappingRow[]>([]);
  const [featuredSectionProductsLoading, setFeaturedSectionProductsLoading] = useState(false);
  const [featuredSectionProductsSaving, setFeaturedSectionProductsSaving] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
  const [productSearchTotal, setProductSearchTotal] = useState(0);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const productSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { showToast } = useAdminToast();

  async function loadHomeCuratedAdminData() {
    setFeaturedLoading(true);
    setFeaturedError("");
    try {
      const data = await fetchAdminHomeCurated();
      setFeaturedSettings(data.settings ?? null);
      setFeaturedSections(data.sections ?? []);
      if (data.settings) {
        setFeaturedSettingsForm({
          section_label: data.settings.section_label ?? "",
          section_title: data.settings.section_title ?? "",
          section_description: data.settings.section_description ?? "",
          catalog_button_label: data.settings.catalog_button_label ?? "",
          catalog_button_href: data.settings.catalog_button_href ?? "/products",
          is_active: data.settings.is_active ?? true,
        });
      }
    } catch (err) {
      setFeaturedError(err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.");
      setFeaturedSettings(null);
      setFeaturedSections([]);
    } finally {
      setFeaturedLoading(false);
    }
  }

  useEffect(() => {
    loadHomeCuratedAdminData();
  }, []);

  async function saveFeaturedSettings() {
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      const data = await updateAdminHomeCuratedSettings(featuredSettingsForm);
      setFeaturedSettings((prev) =>
        prev ? { ...prev, ...featuredSettingsForm } : null,
      );
      showToast("success", data.message ?? "설정이 저장되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "설정 저장에 실패했습니다.";
      setFeaturedError(msg);
      showToast("error", msg);
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function addFeaturedSection() {
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      const data = await createAdminHomeCuratedSection({
        title: "새 섹션",
        description: "",
        sort_order: featuredSections.length,
        max_items: 8,
        is_active: true,
      });
      setFeaturedSections((prev) =>
        [...prev, data].sort((a, b) => a.sort_order - b.sort_order),
      );
      showToast("success", "섹션이 추가되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "섹션 추가에 실패했습니다.";
      setFeaturedError(msg);
      showToast("error", msg);
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function updateFeaturedSection(id: string) {
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      const data = await updateAdminHomeCuratedSection(id, editingFeaturedSectionForm);
      setFeaturedSections((prev) =>
        prev.map((s) => (s.id === id ? data : s)).sort((a, b) => a.sort_order - b.sort_order),
      );
      setEditingFeaturedSectionId(null);
      showToast("success", "섹션이 수정되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "섹션 수정에 실패했습니다.";
      setFeaturedError(msg);
      showToast("error", msg);
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function deleteFeaturedSection(id: string) {
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      const data = await deleteAdminHomeCuratedSection(id);
      setFeaturedSections((prev) => prev.filter((s) => s.id !== id));
      setSelectedFeaturedSectionId((prev) => (prev === id ? null : prev));
      setEditingFeaturedSectionId((prev) => (prev === id ? null : prev));
      setPendingDeleteSectionId(null);
      showToast("success", data.message ?? "섹션이 삭제되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "섹션 삭제에 실패했습니다.";
      setFeaturedError(msg);
      showToast("error", msg);
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function moveFeaturedSection(id: string, direction: "up" | "down") {
    const idx = featuredSections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= featuredSections.length) return;
    const a = featuredSections[idx];
    const b = featuredSections[swapIdx];
    setFeaturedSaving(true);
    setFeaturedError("");
    try {
      await updateAdminHomeCuratedSection(a.id, { sort_order: b.sort_order });
      await updateAdminHomeCuratedSection(b.id, { sort_order: a.sort_order });
      await loadHomeCuratedAdminData();
      showToast("success", "순서가 변경되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "순서 변경에 실패했습니다.";
      setFeaturedError(msg);
      showToast("error", msg);
    } finally {
      setFeaturedSaving(false);
    }
  }

  async function loadFeaturedSectionProducts(sectionId: string) {
    setFeaturedSectionProductsLoading(true);
    try {
      const data = await fetchAdminHomeCuratedSectionProducts(sectionId);
      setFeaturedSectionProducts(data ?? []);
    } catch {
      setFeaturedSectionProducts([]);
    } finally {
      setFeaturedSectionProductsLoading(false);
    }
  }

  useEffect(() => {
    if (selectedFeaturedSectionId) {
      loadFeaturedSectionProducts(selectedFeaturedSectionId);
    } else {
      setFeaturedSectionProducts([]);
    }
  }, [selectedFeaturedSectionId]);

  useEffect(() => {
    if (!productSearchQuery.trim()) {
      setProductSearchResults([]);
      setProductSearchTotal(0);
      return;
    }
    if (productSearchDebounceRef.current) {
      clearTimeout(productSearchDebounceRef.current);
    }
    productSearchDebounceRef.current = setTimeout(() => {
      productSearchDebounceRef.current = null;
      setProductSearchLoading(true);
      fetchAdminProducts({
        page: 1,
        pageSize: 12,
        sortField: "sort_order",
        sortDirection: "asc",
        q: productSearchQuery.trim(),
      })
        .then((data) => {
          setProductSearchResults(Array.isArray(data.items) ? data.items : []);
          setProductSearchTotal(typeof data.total === "number" ? data.total : 0);
        })
        .catch(() => {
          setProductSearchResults([]);
          setProductSearchTotal(0);
        })
        .finally(() => setProductSearchLoading(false));
    }, 300);
    return () => {
      if (productSearchDebounceRef.current) clearTimeout(productSearchDebounceRef.current);
    };
  }, [productSearchQuery]);

  async function addProductToFeaturedSection(productId: string) {
    if (!selectedFeaturedSectionId) return;
    setFeaturedSectionProductsSaving(true);
    try {
      await addAdminHomeCuratedSectionProduct(selectedFeaturedSectionId, { productId });
      await loadFeaturedSectionProducts(selectedFeaturedSectionId);
      setFeaturedSections((prev) =>
        prev.map((s) =>
          s.id === selectedFeaturedSectionId
            ? { ...s, product_count: s.product_count + 1 }
            : s,
        ),
      );
      showToast("success", "상품이 추가되었습니다.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "상품 추가 중 오류가 발생했습니다.");
    } finally {
      setFeaturedSectionProductsSaving(false);
    }
  }

  async function removeProductFromFeaturedSection(mappingId: string) {
    if (!selectedFeaturedSectionId) return;
    setFeaturedSectionProductsSaving(true);
    try {
      await deleteAdminHomeCuratedSectionProduct(selectedFeaturedSectionId, mappingId);
      await loadFeaturedSectionProducts(selectedFeaturedSectionId);
      setFeaturedSections((prev) =>
        prev.map((s) =>
          s.id === selectedFeaturedSectionId
            ? { ...s, product_count: Math.max(0, s.product_count - 1) }
            : s,
        ),
      );
      showToast("success", "상품이 제거되었습니다.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "상품 제거 중 오류가 발생했습니다.");
    } finally {
      setFeaturedSectionProductsSaving(false);
    }
  }

  async function moveFeaturedSectionProduct(mappingId: string, direction: "up" | "down") {
    if (!selectedFeaturedSectionId) return;
    const idx = featuredSectionProducts.findIndex((m) => m.id === mappingId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= featuredSectionProducts.length) return;
    const a = featuredSectionProducts[idx];
    const b = featuredSectionProducts[swapIdx];
    setFeaturedSectionProductsSaving(true);
    try {
      await updateAdminHomeCuratedSectionProduct(
        selectedFeaturedSectionId,
        a.id,
        { sort_order: b.sort_order },
      );
      await updateAdminHomeCuratedSectionProduct(
        selectedFeaturedSectionId,
        b.id,
        { sort_order: a.sort_order },
      );
      await loadFeaturedSectionProducts(selectedFeaturedSectionId);
      showToast("success", "순서가 변경되었습니다.");
    } catch {
      showToast("error", "순서 변경 중 오류가 발생했습니다.");
    } finally {
      setFeaturedSectionProductsSaving(false);
    }
  }

  return (
    <section className="space-y-6 rounded-xl bg-[var(--surface-muted)] p-6 ring-1 ring-[var(--border)]">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-[var(--primary)]">메인 추천상품 관리</h3>
        <p className="text-sm text-[var(--text-muted)]">
          메인 홈 추천 섹션/상품을 관리하는 화면입니다.
        </p>
      </div>

      {featuredError ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
          {featuredError}
        </div>
      ) : null}

      {featuredLoading ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중...</p>
      ) : (
        <>
          <HomeCuratedSettingsPanel
            settings={featuredSettingsForm}
            isSaving={featuredSaving}
            onChangeField={(name, value) =>
              setFeaturedSettingsForm((prev) => ({ ...prev, [name]: value }))
            }
            onSave={saveFeaturedSettings}
          />

          <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
            <HomeCuratedSectionsPanel
              sections={featuredSections}
              selectedSectionId={selectedFeaturedSectionId}
              editingSectionId={editingFeaturedSectionId}
              editingForm={editingFeaturedSectionForm}
              pendingDeleteSectionId={pendingDeleteSectionId}
              isSaving={featuredSaving}
              onSelectSection={setSelectedFeaturedSectionId}
              onCreateSection={addFeaturedSection}
              onStartEdit={(sectionId) => {
                const sec = featuredSections.find((s) => s.id === sectionId);
                if (sec) {
                  setEditingFeaturedSectionId(sec.id);
                  setEditingFeaturedSectionForm({
                    title: sec.title,
                    description: sec.description,
                    sort_order: sec.sort_order,
                    max_items: sec.max_items,
                    is_active: sec.is_active,
                  });
                }
              }}
              onCancelEdit={() => setEditingFeaturedSectionId(null)}
              onChangeEditingField={(name, value) =>
                setEditingFeaturedSectionForm((prev) => ({ ...prev, [name]: value }))
              }
              onUpdateSection={updateFeaturedSection}
              onRequestDelete={setPendingDeleteSectionId}
              onConfirmDelete={deleteFeaturedSection}
              onCancelDelete={() => setPendingDeleteSectionId(null)}
              onMoveSectionUp={(id) => moveFeaturedSection(id, "up")}
              onMoveSectionDown={(id) => moveFeaturedSection(id, "down")}
            />

            <HomeCuratedSectionProductsPanel
              selectedSection={
                selectedFeaturedSectionId
                  ? featuredSections.find((s) => s.id === selectedFeaturedSectionId) ?? null
                  : null
              }
              sectionProducts={featuredSectionProducts}
              productSearchKeyword={productSearchQuery}
              productSearchResults={productSearchResults}
              isLoadingProducts={featuredSectionProductsLoading}
              isSearchingProducts={productSearchLoading}
              isSaving={featuredSectionProductsSaving}
              onChangeSearchKeyword={setProductSearchQuery}
              onAddProduct={addProductToFeaturedSection}
              onRemoveProduct={removeProductFromFeaturedSection}
              onMoveProductUp={(mappingId) => moveFeaturedSectionProduct(mappingId, "up")}
              onMoveProductDown={(mappingId) => moveFeaturedSectionProduct(mappingId, "down")}
            />
          </div>
        </>
      )}
    </section>
  );
}
