"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types/product";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";

type ProductFormState = {
  title: string;
  description: string;
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

const initialFormState: ProductFormState = {
  title: "",
  description: "",
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

function mapProductToForm(product: Product): ProductFormState {
  return {
    title: product.title ?? "",
    description: product.description ?? "",
    image_url: product.image_url ?? "",
    category: product.category ?? "여행상품",
    theme: product.theme ?? "",
    price: typeof product.price === "number" ? String(product.price) : "",
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

  useEffect(() => {
    Promise.all([loadProducts(), loadTaxonomies()]);
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
      const payload = {
        title: form.title,
        description: form.description,
        image_url: form.image_url,
        category: form.category,
        theme: form.theme.trim() === "" ? null : form.theme,
        price: form.price.trim() === "" ? null : Number(form.price),
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
        product.description.toLowerCase().includes(q),
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
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            required
            rows={4}
            placeholder="상품 설명"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe] md:col-span-2"
          />
          <input
            value={form.price}
            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
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
            value={form.itinerary}
            onChange={(event) => setForm((prev) => ({ ...prev, itinerary: event.target.value }))}
            rows={3}
            placeholder="일정표 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
          />
          <textarea
            value={form.inclusions}
            onChange={(event) => setForm((prev) => ({ ...prev, inclusions: event.target.value }))}
            rows={3}
            placeholder="포함사항/불포함사항 (줄바꿈 가능)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#bfdbfe]"
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
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-[#eff6ff] text-[#1e3a8a]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">상품명</th>
                  <th className="px-4 py-3 text-left font-semibold">카테고리</th>
                  <th className="px-4 py-3 text-left font-semibold">테마/배지</th>
                  <th className="px-4 py-3 text-left font-semibold">가격</th>
                  <th className="w-[170px] px-4 py-3 text-left font-semibold">노출순서</th>
                  <th className="w-[110px] px-4 py-3 text-left font-semibold whitespace-nowrap">활성화</th>
                  <th className="px-4 py-3 text-left font-semibold">메인추천</th>
                  <th className="px-4 py-3 text-left font-semibold">작업</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.length === 0 ? (
                  <tr className="border-t border-slate-200">
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                      등록된 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pagedProducts.map((product) => (
                    <tr key={product.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-[#1e3a8a]">{product.title}</td>
                      <td className="px-4 py-3">{product.category}</td>
                      <td className="px-4 py-3">{product.theme ?? "-"}</td>
                      <td className="px-4 py-3">
                        {typeof product.price === "number"
                          ? `${new Intl.NumberFormat("ko-KR").format(product.price)}원`
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        {product.is_featured_home ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">추천</span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                            일반
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
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
