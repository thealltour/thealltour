"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import { fetchAdminProductTaxonomy } from "@/components/admin/products/api/adminProductTaxonomy.client";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  parseProductsCollectionPopularCampaignIds,
  parseProductsCollectionRecommendCampaignIds,
} from "@/lib/siteSettings";
import type { SiteSettings } from "@/lib/siteSettings";

/**
 * `/products?collection=recommend|popular` 노출 기준.
 * 기획(taxonomy_type=campaign)을 고르면, 해당 이름이 상품 `기획/추천`에 붙은 상품이 컬렉션에 포함됩니다.
 * DB `is_recommend` / `is_popular` 와는 OR 관계입니다.
 */
export default function AdminProductsCollectionCampaignsManager() {
  const [campaigns, setCampaigns] = useState<ProductTaxonomyWithUsage[]>([]);
  const [recommendIds, setRecommendIds] = useState<string[]>([]);
  const [popularIds, setPopularIds] = useState<string[]>([]);
  const [addRecommend, setAddRecommend] = useState("");
  const [addPopular, setAddPopular] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();

  const loadData = useCallback(async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      const [campaignList, settingsRes] = await Promise.all([
        fetchAdminProductTaxonomy({ taxonomy_type: "campaign" }),
        fetch("/api/admin/site-settings", { cache: "no-store" }),
      ]);
      const active = (campaignList ?? []).filter((t) => t.is_active);
      setCampaigns(active);

      const settingsData = (await settingsRes.json()) as Record<string, string> | { message?: string };
      if (settingsRes.ok && settingsData && !("message" in settingsData)) {
        const raw = settingsData as Record<string, string>;
        const partial = {
          products_collection_recommend_campaign_ids:
            raw.products_collection_recommend_campaign_ids ?? "[]",
          products_collection_popular_campaign_ids:
            raw.products_collection_popular_campaign_ids ?? "[]",
        } as Pick<
          SiteSettings,
          | "products_collection_recommend_campaign_ids"
          | "products_collection_popular_campaign_ids"
        >;
        setRecommendIds(parseProductsCollectionRecommendCampaignIds(partial));
        setPopularIds(parseProductsCollectionPopularCampaignIds(partial));
      } else {
        setRecommendIds([]);
        setPopularIds([]);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "데이터를 불러오지 못했습니다.");
      setCampaigns([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const move = (which: "recommend" | "popular", index: number, dir: "up" | "down") => {
    const set = which === "recommend" ? setRecommendIds : setPopularIds;
    set((prev) => {
      const next = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (which: "recommend" | "popular", index: number) => {
    const set = which === "recommend" ? setRecommendIds : setPopularIds;
    set((prev) => prev.filter((_, i) => i !== index));
  };

  const addId = (which: "recommend" | "popular", id: string) => {
    if (!id) return;
    const set = which === "recommend" ? setRecommendIds : setPopularIds;
    set((prev) => (prev.includes(id) ? prev : [...prev, id]));
    if (which === "recommend") setAddRecommend("");
    else setAddPopular("");
  };

  const save = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products_collection_recommend_campaign_ids: JSON.stringify(recommendIds),
          products_collection_popular_campaign_ids: JSON.stringify(popularIds),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data?.message ?? "저장에 실패했습니다.");
      showToast("success", "추천·인기 컬렉션 기준이 저장되었습니다. 잠시 후 공개 목록에 반영됩니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      setErrorMessage(msg);
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const idToCampaign = new Map(campaigns.map((c) => [c.id, c]));

  function renderColumn(
    title: string,
    description: string,
    which: "recommend" | "popular",
    orderedIds: string[],
    addValue: string,
    setAddValue: (v: string) => void,
  ) {
    const selected = new Set(orderedIds);
    const available = campaigns.filter((c) => !selected.has(c.id));
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"
            aria-label={`${title} 기획 추가`}
          >
            <option value="">기획 선택 후 추가</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addValue && addId(which, addValue)}
            disabled={!addValue}
            className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
          >
            추가
          </button>
        </div>
        {orderedIds.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">선택된 기획이 없습니다. 비어 있으면 DB 플래그만 사용합니다.</p>
        ) : (
          <ul className="space-y-2">
            {orderedIds.map((id, index) => {
              const c = idToCampaign.get(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 font-medium text-[var(--text-primary)]">
                    {c?.name ?? id}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => move(which, index, "up")}
                      disabled={index === 0}
                      className="rounded border border-[var(--border)] p-1 disabled:opacity-40"
                      aria-label="위로"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(which, index, "down")}
                      disabled={index === orderedIds.length - 1}
                      className="rounded border border-[var(--border)] p-1 disabled:opacity-40"
                      aria-label="아래로"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(which, index)}
                      className="rounded border border-[var(--border)] p-1 text-[var(--danger)]"
                      aria-label="제거"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center gap-2 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">추천·인기 상품 목록 (/products 컬렉션)</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          <code className="text-xs">/products?collection=recommend</code> ·{" "}
          <code className="text-xs">popular</code> 에 노출할 상품을 정합니다. 아래에서 고른{" "}
          <strong>기획</strong> 이름이 상품 편집 화면의 &quot;기획/추천&quot;에 포함된 상품이 목록에 나갑니다.
          (Supabase <code className="text-xs">is_recommend</code> / <code className="text-xs">is_popular</code> 가
          켜진 상품도 함께 포함됩니다.)
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">{errorMessage}</p>
      ) : null}

      {campaigns.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          등록된 기획(campaign) 분류가 없습니다. 카테고리/테마 관리에서 기획 항목을 먼저 만든 뒤, 상품에 기획을 연결해 주세요.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {renderColumn(
            "추천 컬렉션",
            "선택한 기획이 붙은 상품 + 추천 플래그 상품",
            "recommend",
            recommendIds,
            addRecommend,
            setAddRecommend,
          )}
          {renderColumn(
            "인기 컬렉션",
            "선택한 기획이 붙은 상품 + 인기 플래그 상품",
            "popular",
            popularIds,
            addPopular,
            setAddPopular,
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
        >
          {isSaving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}
